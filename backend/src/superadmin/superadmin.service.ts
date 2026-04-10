// src/superadmin/superadmin.service.ts
import {
  Injectable, ForbiddenException, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class SuperAdminService {
  constructor(private readonly prisma: PrismaService) {}

  private assertSuperAdmin(user: any) {
    if (user.rol !== 'SUPERADMIN') throw new ForbiddenException('Acceso denegado');
  }

  // ─── LISTAR TODAS LAS EMPRESAS (SOLO METADATA) ────────────────────────────

  async listarEmpresas(user: any) {
    this.assertSuperAdmin(user);

    return this.prisma.empresa.findMany({
      select: {
        id: true,
        nombre: true,
        activa: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── DETALLE BÁSICO DE UNA EMPRESA ────────────────────────────────────────

  async detalleEmpresa(user: any, empresaId: string) {
    this.assertSuperAdmin(user);

    const empresa = await this.prisma.empresa.findUnique({
      where: { id: empresaId },
      select: {
        id: true,
        nombre: true,
        activa: true,
        createdAt: true,
      },
    });

    if (!empresa) throw new NotFoundException('Empresa no encontrada');

    return { empresa };
  }

  // ─── LISTAR USUARIOS DE UNA EMPRESA (SOLO METADATA) ─────────────────────────

  async listarUsuariosEmpresa(user: any, empresaId: string) {
    this.assertSuperAdmin(user);

    const empresa = await this.prisma.empresa.findUnique({
      where: { id: empresaId },
      select: { id: true, nombre: true },
    });

    if (!empresa) throw new NotFoundException('Empresa no encontrada');

    const usuarios = await this.prisma.usuario.findMany({
      where: { empresaId },
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        activo: true,
        createdAt: true,
      },
      orderBy: [{ activo: 'desc' }, { createdAt: 'asc' }],
    });

    return { empresa: { id: empresa.id, nombre: empresa.nombre }, usuarios };
  }

  // ─── CREAR EMPRESA ────────────────────────────────────────────────────────

  async crearEmpresa(user: any, datos: {
    nombreEmpresa: string; nombreAdmin: string; emailAdmin: string;
    passwordAdmin: string; tasaInteresBase?: number;
    moraPorcentajeMensual?: number; diasGracia?: number;
  }) {
    this.assertSuperAdmin(user);

    const emailExiste = await this.prisma.usuario.findUnique({ where: { email: datos.emailAdmin } });
    if (emailExiste) throw new BadRequestException('Ya existe un usuario con ese email');

    const hashedPassword = await bcrypt.hash(datos.passwordAdmin, 10);

    const resultado = await this.prisma.$transaction(async (tx) => {
      const empresa = await tx.empresa.create({ data: { nombre: datos.nombreEmpresa, activa: true } });
      await tx.configuracion.create({
        data: {
          empresaId: empresa.id,
          tasaInteresBase:       datos.tasaInteresBase       ?? 10,
          moraPorcentajeMensual: datos.moraPorcentajeMensual ?? 5,
          diasGracia:            datos.diasGracia            ?? 5,
          permitirAbonoCapital:  true,
        },
      });
      const admin = await tx.usuario.create({
        data: {
          nombre: datos.nombreAdmin, email: datos.emailAdmin,
          password: hashedPassword, rol: 'ADMIN',
          empresaId: empresa.id, debeCambiarPassword: false,
        },
      });
      return { empresa, admin };
    });

    return { mensaje: 'Empresa creada correctamente', empresa: resultado.empresa, adminEmail: resultado.admin.email };
  }

  // ─── EDITAR NOMBRE DE EMPRESA ─────────────────────────────────────────────

  async editarEmpresa(user: any, empresaId: string, nombre: string) {
    this.assertSuperAdmin(user);

    const empresa = await this.prisma.empresa.findUnique({ where: { id: empresaId } });
    if (!empresa) throw new NotFoundException('Empresa no encontrada');
    if (!nombre?.trim()) throw new BadRequestException('El nombre no puede estar vacío');

    return this.prisma.empresa.update({
      where: { id: empresaId },
      data:  { nombre: nombre.trim() },
    });
  }

  // ─── ACTIVAR / DESACTIVAR EMPRESA ────────────────────────────────────────

  async toggleEmpresa(user: any, empresaId: string, activa: boolean) {
    this.assertSuperAdmin(user);

    const empresa = await this.prisma.empresa.findUnique({ where: { id: empresaId } });
    if (!empresa) throw new NotFoundException('Empresa no encontrada');

    await this.prisma.empresa.update({ where: { id: empresaId }, data: { activa } });
    await this.prisma.usuario.updateMany({ where: { empresaId }, data: { activo: activa } });

    return { mensaje: activa ? 'Empresa activada' : 'Empresa desactivada' };
  }

  // ─── RESETEAR CONTRASEÑA DE UN USUARIO ───────────────────────────────────

  async resetearPassword(user: any, usuarioId: string, nuevaPassword: string) {
    this.assertSuperAdmin(user);

    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    if (!nuevaPassword || nuevaPassword.length < 8) {
      throw new BadRequestException('La contraseña debe tener mínimo 8 caracteres');
    }

    const hashed = await bcrypt.hash(nuevaPassword, 10);
    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data:  { password: hashed, debeCambiarPassword: true },
    });

    return { mensaje: `Contraseña de ${usuario.nombre} reseteada. Deberá cambiarla al iniciar sesión.` };
  }

  // ─── ESTADÍSTICAS GLOBALES DEL SISTEMA (SOLO METADATA) ────────────────────

  async estadisticasGlobales(user: any) {
    this.assertSuperAdmin(user);

    const [totalEmpresas, empresasActivas, totalUsuarios] = await Promise.all([
      this.prisma.empresa.count(),
      this.prisma.empresa.count({ where: { activa: true } }),
      this.prisma.usuario.count({ where: { rol: { not: 'SUPERADMIN' } } }),
    ]);

    return {
      totalEmpresas,
      empresasActivas,
      empresasInactivas: totalEmpresas - empresasActivas,
      totalUsuarios,
    };
  }
}