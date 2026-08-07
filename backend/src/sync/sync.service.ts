// src/sync/sync.service.ts
import { Injectable } from '@nestjs/common';
import type { Prisma, Cliente, RutaCliente } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { calcularDesdeObjeto } from '../common/utils/prestamo.utils';

const CLIENTE_RESUMEN_SELECT = {
  id: true,
  nombre: true,
  apellido: true,
  cedula: true,
  telefono: true,
  celular: true,
} as const;

type PrestamoSync = Prisma.PrestamoGetPayload<{
  include: {
    cliente: { select: typeof CLIENTE_RESUMEN_SELECT };
    garante: { select: typeof CLIENTE_RESUMEN_SELECT };
    cuotas: { orderBy: { numero: 'asc' } };
    pagos: {
      include: { usuario: { select: { id: true; nombre: true } } };
      orderBy: { createdAt: 'desc' };
    };
  };
}>;

type RutaSync = Prisma.RutaGetPayload<{
  include: {
    usuario: { select: { id: true; nombre: true } };
    clientes: {
      select: {
        id: true;
        clienteId: true;
        orden: true;
        observacion: true;
        visitadoHoy: true;
        ultimaVisita: true;
        fechaRuta: true;
      };
    };
  };
}>;

export interface CambiosResult {
  serverTime: string;
  clientes: Cliente[];
  prestamos: PrestamoSync[];
  rutas: RutaSync[];
  rutaClientes: RutaCliente[];
  configuracion: any;
}

/**
 * Descarga de datos para modo offline, incremental o completa.
 *
 * - `desde` definido → solo registros con `updatedAt > desde` (deltas).
 * - `desde` nulo → snapshot completo (lo usa el botón "Forzar recarga").
 *
 * Devuelve `serverTime` como nuevo cursor de sincronización: la app lo guarda y
 * lo envía en la siguiente petición para no volver a descargar lo que ya tiene.
 */
@Injectable()
export class SyncService {
  constructor(private readonly prisma: PrismaService) {}

  async cambios(
    empresaId: string,
    options: { isAdmin: boolean; usuarioId?: string },
    desde?: Date,
  ): Promise<CambiosResult> {
    const { isAdmin, usuarioId } = options;

    const updatedSince = desde ? { updatedAt: { gt: desde } } : undefined;

    // Paridad con rutas.findAll: solo rutas activas y, para no-admins, solo las del usuario.
    const rutaWhere: Prisma.RutaWhereInput = {
      empresaId,
      activa: true,
      ...(updatedSince ?? {}),
      ...(!isAdmin && usuarioId ? { usuarioId } : {}),
    };

    // RutaCliente no tiene empresaId: se filtra por la relación con las rutas de la empresa.
    const rutaClienteWhere: Prisma.RutaClienteWhereInput = {
      ruta: {
        empresaId,
        activa: true,
        ...(!isAdmin && usuarioId ? { usuarioId } : {}),
      },
      ...(updatedSince ?? {}),
    };

    const [clientes, prestamosRaw, rutas, rutaClientes] = await Promise.all([
      this.prisma.cliente.findMany({
        where: { empresaId, activo: true, ...(updatedSince ?? {}) },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.prestamo.findMany({
        where: { empresaId, ...(updatedSince ?? {}) },
        include: {
          cliente: { select: CLIENTE_RESUMEN_SELECT },
          garante: { select: CLIENTE_RESUMEN_SELECT },
          cuotas: { orderBy: { numero: 'asc' } },
          pagos: {
            include: { usuario: { select: { id: true, nombre: true } } },
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      this.prisma.ruta.findMany({
        where: rutaWhere,
        include: {
          usuario: { select: { id: true, nombre: true } },
          clientes: {
            select: {
              id: true,
              clienteId: true,
              orden: true,
              observacion: true,
              visitadoHoy: true,
              ultimaVisita: true,
              fechaRuta: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.rutaCliente.findMany({
        where: rutaClienteWhere,
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    const configuracion = await this.getConfiguracion(empresaId);

    // Paridad con prestamos.listar/findOne: saldoPendiente y moraAcumulada se
    // calculan desde las cuotas pendientes (la columna no es fuente de verdad).
    const prestamos = prestamosRaw.map((p) => {
      const { saldoPendiente, moraAcumulada } = calcularDesdeObjeto(p);
      return { ...p, saldoPendiente, moraAcumulada };
    });

    return {
      serverTime: new Date().toISOString(),
      clientes,
      prestamos,
      rutas,
      rutaClientes,
      configuracion,
    };
  }

  // Mismo shape que ConfiguracionService.findOne para que la app persista igual.
  private async getConfiguracion(empresaId: string) {
    const config = await this.prisma.configuracion.findUnique({
      where: { empresaId },
    });

    if (!config) {
      return {
        tasaInteresBase: 0,
        moraPorcentajeMensual: 0,
        diasGracia: 5,
        permitirAbonoCapital: true,
        montoMinimoPrestamo: 500,
        montoMaximoPrestamo: null,
        montoMaximoPago: null,
        empresaId,
        existe: false,
      };
    }

    return {
      ...config,
      existe: true,
      montoMinimoPrestamo: config.montoMinimoPrestamo ?? 500,
      montoMaximoPrestamo: config.montoMaximoPrestamo ?? null,
      montoMaximoPago: config.montoMaximoPago ?? null,
    };
  }
}
