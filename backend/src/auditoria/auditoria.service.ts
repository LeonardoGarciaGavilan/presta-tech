// src/auditoria/auditoria.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface FindAllOptions {
  user: any;
  empresaId: string;
  empresaFiltro?: string;
  tipo?: string;
  desde?: string;
  hasta?: string;
}

@Injectable()
export class AuditoriaService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(options: FindAllOptions) {
    const { user, empresaId, empresaFiltro, tipo, desde, hasta } = options;
    
    const isSuperAdmin = user.rol === 'SUPERADMIN';
    
    // Construir filtro de empresa
    let empresaFilter: string | undefined;
    if (isSuperAdmin) {
      // SUPERADMIN: puede ver todos o filtrar por empresa específica
      empresaFilter = empresaFiltro;
    } else {
      // ADMIN/EMPLEADO: solo puede ver su empresa
      empresaFilter = empresaId;
    }

    const where: any = {};

    // Aplicar filtro de empresa
    if (empresaFilter) {
      where.empresaId = empresaFilter;
    }

    // Filtro por tipo de evento
    if (tipo) {
      where.tipo = tipo;
    }

    // Filtro por rango de fechas
    if (desde || hasta) {
      where.createdAt = {};
      if (desde) where.createdAt.gte = new Date(`${desde}T00:00:00`);
      if (hasta) where.createdAt.lte = new Date(`${hasta}T23:59:59`);
    }

    return this.prisma.auditoria.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        usuario: {
          select: {
            nombre: true,
            email: true,
          },
        },
        empresa: {
          select: {
            nombre: true,
          },
        },
      },
    });
  }
}