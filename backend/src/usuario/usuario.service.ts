import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { registrarAuditoria } from '../common/utils/auditoria.utils';
import { QuotaService } from '../common/quota/quota.service';
import {
  PERMISOS,
  MODULOS,
  permisosBasePorRol,
  type Permiso,
} from '../common/permisos/permisos.constants';
import * as bcrypt from 'bcrypt';
import {
  generarPasswordTemporal,
  validarPasswordOPopThrow,
} from '../common/passwords/password-policy';

@Injectable()
export class UsuarioService {
  constructor(
    private prisma: PrismaService,
    private quotaService: QuotaService,
  ) {}

  // ─── CREAR empleado ───────────────────────────────────────────────────────
  async crearEmpleado(
    admin: any,
    data: { nombre: string; email: string; rol?: string },
  ) {
    if (admin.rol !== 'ADMIN') {
      throw new ForbiddenException('Solo ADMIN puede crear empleados');
    }

    const existe = await this.prisma.usuario.findFirst({
      where: { email: data.email, empresaId: admin.empresaId },
    });
    if (existe)
      throw new BadRequestException('Ya existe un usuario con ese correo');

    const cuota = await this.quotaService.verificar(
      admin.empresaId,
      'usuarios',
    );

    const passwordTemporal = generarPasswordTemporal();
    const hashedPassword = await bcrypt.hash(passwordTemporal, 10);

    const usuario = await this.prisma.usuario.create({
      data: {
        nombre: data.nombre,
        email: data.email,
        password: hashedPassword,
        rol: (data.rol as any) ?? 'EMPLEADO',
        empresaId: admin.empresaId,
        debeCambiarPassword: true,
        activo: true,
      },
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        activo: true,
        debeCambiarPassword: true,
        createdAt: true,
      },
    });

    return {
      ...usuario,
      passwordTemporal,
      mensaje: `Usuario creado correctamente. Contraseña temporal: ${passwordTemporal}`,
      ...(cuota.advertencia && { advertenciaCuota: cuota }),
    };
  }

  // ─── LISTAR usuarios de la empresa ────────────────────────────────────────
  async listarUsuarios(admin: any) {
    if (admin.rol !== 'ADMIN') {
      throw new ForbiddenException('Solo ADMIN puede ver usuarios');
    }

    return this.prisma.usuario.findMany({
      where: { empresaId: admin.empresaId },
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        activo: true,
        debeCambiarPassword: true,
        permisos: true,
        permisosNegados: true,
        createdAt: true,
      },
      orderBy: [{ activo: 'desc' }, { createdAt: 'desc' }],
    });
  }

  // ─── ACTUALIZAR usuario (nombre, rol, activo) ─────────────────────────────
  async actualizarUsuario(
    admin: any,
    id: string,
    data: { nombre?: string; rol?: string; activo?: boolean },
  ) {
    if (admin.rol !== 'ADMIN') {
      throw new ForbiddenException('Solo ADMIN puede editar usuarios');
    }

    const usuario = await this.prisma.usuario.findFirst({
      where: { id, empresaId: admin.empresaId },
    });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    // No puede desactivarse a sí mismo
    if (id === admin.userId && data.activo === false) {
      throw new BadRequestException('No puedes desactivar tu propia cuenta');
    }

    return this.prisma.usuario.update({
      where: { id },
      data: {
        ...(data.nombre !== undefined && { nombre: data.nombre }),
        ...(data.rol !== undefined && { rol: data.rol as any }),
        ...(data.activo !== undefined && { activo: data.activo }),
        authVersion: { increment: 1 },
      },
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        activo: true,
        debeCambiarPassword: true,
        createdAt: true,
      },
    });
  }

  // ─── RESET de contraseña (admin reinicia a temporal) ──────────────────────
  async resetPassword(admin: any, id: string) {
    if (admin.rol !== 'ADMIN') {
      throw new ForbiddenException('Solo ADMIN puede resetear contraseñas');
    }

    const usuario = await this.prisma.usuario.findFirst({
      where: { id, empresaId: admin.empresaId },
    });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    const passwordTemporal = generarPasswordTemporal();
    const hash = await bcrypt.hash(passwordTemporal, 10);

    await this.prisma.usuario.update({
      where: { id },
      data: { password: hash, debeCambiarPassword: true },
    });

    return {
      mensaje: `Contraseña restablecida correctamente`,
      passwordTemporal,
    };
  }

  // ─── CAMBIAR contraseña propia (primer login) ─────────────────────────────
  async cambiarPassword(user: any, nuevaPassword: string) {
    validarPasswordOPopThrow(nuevaPassword);

    const hashed = await bcrypt.hash(nuevaPassword, 10);

    await this.prisma.usuario.update({
      where: { id: user.userId },
      data: { password: hashed, debeCambiarPassword: false },
    });

    return { mensaje: 'Password actualizada correctamente' };
  }

  // ─── REGISTRAR push token ─────────────────────────────────────────────────
  async registrarPushToken(usuarioId: string, pushToken: string) {
    return this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { pushToken },
      select: { id: true, pushToken: true },
    });
  }

  // ─── LIMPIAR push token (logout) ──────────────────────────────────────────
  async limpiarPushToken(usuarioId: string) {
    return this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { pushToken: null },
      select: { id: true },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PERMISOS POR USUARIO (matriz tri-estado: default / permitir / denegar)
  // ═══════════════════════════════════════════════════════════════════════════

  private async findEditable(admin: any, id: string) {
    if (admin.rol !== 'ADMIN') {
      throw new ForbiddenException(
        'Solo el administrador puede gestionar permisos',
      );
    }

    const usuario = await this.prisma.usuario.findFirst({
      where: { id, empresaId: admin.empresaId },
    });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    if (usuario.rol === 'SUPERADMIN') {
      throw new ForbiddenException(
        'No puedes modificar los permisos del Super Admin',
      );
    }
    if (id === admin.userId) {
      throw new BadRequestException('No puedes modificar tus propios permisos');
    }
    return usuario;
  }

  private limpiarPermisos(v: unknown): {
    validos: string[];
    invalidos: string[];
  } {
    if (!Array.isArray(v)) return { validos: [], invalidos: [] };
    const unicos = [...new Set(v)];
    const invalidos = unicos.filter(
      (p) => typeof p !== 'string' || !PERMISOS.includes(p as Permiso),
    );
    const validos = unicos.filter(
      (p): p is string =>
        typeof p === 'string' && PERMISOS.includes(p as Permiso),
    );
    return { validos, invalidos };
  }

  // GET /usuarios/:id/permisos — base por rol + matriz actual + catálogo
  async obtenerPermisos(admin: any, id: string) {
    const usuario = await this.findEditable(admin, id);

    return {
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        activo: usuario.activo,
      },
      base: permisosBasePorRol(usuario.rol),
      permisos: usuario.permisos,
      permisosNegados: usuario.permisosNegados,
      modulos: MODULOS,
      catalogo: PERMISOS,
    };
  }

  // PUT /usuarios/:id/permisos — actualiza matriz, bump authVersion, auditoría
  async actualizarPermisos(
    admin: any,
    id: string,
    datos: { permisos?: string[]; permisosNegados?: string[] },
  ) {
    const usuario = await this.findEditable(admin, id);

    const { validos: permisos, invalidos: invP } = this.limpiarPermisos(
      datos.permisos,
    );
    const { validos: permisosNegados, invalidos: invN } = this.limpiarPermisos(
      datos.permisosNegados,
    );
    if (invP.length > 0 || invN.length > 0) {
      throw new BadRequestException(
        `Permisos inválidos: ${[...invP, ...invN].join(', ')}`,
      );
    }

    const conflictivos = permisos.filter((p) => permisosNegados.includes(p));
    if (conflictivos.length > 0) {
      throw new BadRequestException(
        `Un permiso no puede estar permitido y denegado a la vez: ${conflictivos.join(', ')}`,
      );
    }

    const actualizado = await this.prisma.usuario.update({
      where: { id },
      data: {
        permisos,
        permisosNegados,
        authVersion: { increment: 1 },
      },
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        permisos: true,
        permisosNegados: true,
        authVersion: true,
      },
    });

    await registrarAuditoria(this.prisma, {
      empresaId: admin.empresaId,
      usuarioId: admin.userId,
      tipo: 'PERMISOS',
      accion: 'PERMISOS_ACTUALIZADOS',
      descripcion: `Permisos actualizados para ${usuario.nombre} (${usuario.email})`,
      referenciaId: usuario.id,
      referenciaTipo: 'USUARIO',
      datosAnteriores: {
        permisos: usuario.permisos,
        permisosNegados: usuario.permisosNegados,
      },
      datosNuevos: { permisos, permisosNegados },
      nivel: 'INFO',
    });

    return {
      usuario: actualizado,
      mensaje: 'Permisos actualizados correctamente',
    };
  }
}
