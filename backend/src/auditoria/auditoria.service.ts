// src/auditoria/auditoria.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getInicioDiaRD, getFinDiaRD } from '../common/utils/fecha.utils';

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
      if (desde) where.createdAt.gte = getInicioDiaRD(desde);
      if (hasta) where.createdAt.lte = getFinDiaRD(hasta);

      console.log('DEBUG AUDITORIA RANGO:', { desde: getInicioDiaRD(desde).toISOString(), hasta: getFinDiaRD(hasta).toISOString() });
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