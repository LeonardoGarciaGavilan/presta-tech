import {
  Injectable, ForbiddenException, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsuarioService {
  constructor(private prisma: PrismaService) {}

  // ─── Contraseña temporal aleatoria ───────────────────────────────────────
  private generarPasswordTemporal(): string {
    return Math.random().toString(36).slice(-8) + 'A1*';
  }

  // ─── CREAR empleado ───────────────────────────────────────────────────────
  async crearEmpleado(admin: any, data: { nombre: string; email: string; rol?: string }) {
    if (admin.rol !== 'ADMIN') {
      throw new ForbiddenException('Solo ADMIN puede crear empleados');
    }

    const existe = await this.prisma.usuario.findFirst({
      where: { email: data.email, empresaId: admin.empresaId },
    });
    if (existe) throw new BadRequestException('Ya existe un usuario con ese correo');

    const passwordTemporal = this.generarPasswordTemporal();
    const hashedPassword   = await bcrypt.hash(passwordTemporal, 10);

    const usuario = await this.prisma.usuario.create({
      data: {
        nombre:              data.nombre,
        email:               data.email,
        password:            hashedPassword,
        rol:                 (data.rol as any) ?? 'EMPLEADO',
        empresaId:           admin.empresaId,
        debeCambiarPassword: true,
        activo:              true,
      },
      select: {
        id: true, nombre: true, email: true,
        rol: true, activo: true,
        debeCambiarPassword: true, createdAt: true,
      },
    });

    return {
      ...usuario,
      passwordTemporal,
      mensaje: `Usuario creado correctamente. Contraseña temporal: ${passwordTemporal}`,
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
        id: true, nombre: true, email: true,
        rol: true, activo: true,
        debeCambiarPassword: true, createdAt: true,
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
        ...(data.rol    !== undefined && { rol:    data.rol as any }),
        ...(data.activo !== undefined && { activo: data.activo }),
      },
      select: {
        id: true, nombre: true, email: true,
        rol: true, activo: true,
        debeCambiarPassword: true, createdAt: true,
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

    const passwordTemporal = this.generarPasswordTemporal();
    const hash             = await bcrypt.hash(passwordTemporal, 10);

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
    const hashed = await bcrypt.hash(nuevaPassword, 10);

    await this.prisma.usuario.update({
      where: { id: user.userId },
      data: { password: hashed, debeCambiarPassword: false },
    });

    return { mensaje: 'Password actualizada correctamente' };
  }
}