import {
  Injectable, NotFoundException, BadRequestException, UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePerfilDto, CambiarPasswordDto, UpdateEmpresaDto } from './dto/perfil.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PerfilService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Obtener perfil completo ──────────────────────────────────────────────

  async getPerfil(usuarioId: string, empresaId: string) {
    const [usuario, empresa] = await Promise.all([
      this.prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: {
          id: true, nombre: true, email: true,
          rol: true, activo: true, createdAt: true,
          debeCambiarPassword: true,
        },
      }),
      this.prisma.empresa.findUnique({
        where: { id: empresaId },
        select: { id: true, nombre: true, activa: true, createdAt: true },
      }),
    ]);

    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    if (!empresa) throw new NotFoundException('Empresa no encontrada');

    return { usuario, empresa };
  }

  // ─── Actualizar nombre del usuario ───────────────────────────────────────

  async updatePerfil(usuarioId: string, dto: UpdatePerfilDto) {
    return this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { nombre: dto.nombre },
      select: {
        id: true, nombre: true, email: true, rol: true,
      },
    });
  }

  // ─── Cambiar contraseña ───────────────────────────────────────────────────

  async cambiarPassword(usuarioId: string, dto: CambiarPasswordDto) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { password: true },
    });

    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    const valida = await bcrypt.compare(dto.passwordActual, usuario.password);
    if (!valida) throw new UnauthorizedException('La contraseña actual es incorrecta');

    if (dto.passwordActual === dto.passwordNuevo) {
      throw new BadRequestException('La nueva contraseña debe ser diferente a la actual');
    }

    const hash = await bcrypt.hash(dto.passwordNuevo, 10);

    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { password: hash, debeCambiarPassword: false },
    });

    return { message: 'Contraseña actualizada correctamente' };
  }

  // ─── Actualizar nombre de la empresa (solo ADMIN) ────────────────────────

  async updateEmpresa(empresaId: string, dto: UpdateEmpresaDto) {
    return this.prisma.empresa.update({
      where: { id: empresaId },
      data: { nombre: dto.nombre },
      select: { id: true, nombre: true },
    });
  }
}