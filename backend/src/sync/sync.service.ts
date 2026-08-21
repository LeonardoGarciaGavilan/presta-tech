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
  rutasAjenas: string[];
  configuracion: any;
}

/**
 * Permisos efectivos del usuario para acotar el payload offline:
 * solo se descargan los datos de los módulos que el usuario puede ver.
 */
export interface SyncPermisos {
  clientes: boolean;
  prestamos: boolean;
  pagos: boolean;
  rutas: boolean;
  configuracion: boolean;
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
    options: { isAdmin: boolean; usuarioId?: string; permisos: SyncPermisos },
    desde?: Date,
  ): Promise<CambiosResult> {
    const { isAdmin, usuarioId, permisos } = options;

    // El cursor se captura ANTES de ejecutar las queries. Si se capturara
    // después, un registro actualizado entre la lectura y la captura tendría
    // updatedAt < serverTime y se perdería para siempre en el siguiente delta.
    // Con la captura previa, cualquier cambio posterior tiene updatedAt >
    // serverTime y entra en el siguiente delta (at-least-once).
    const serverTime = new Date().toISOString();

    const updatedSince = desde ? { updatedAt: { gt: desde } } : undefined;

    // Paridad con rutas.findAll: para no-admins, solo las rutas del usuario.
    // Sin filtro `activa` para que las desactivaciones viajen en el delta/snapshot.
    const rutaWhere: Prisma.RutaWhereInput = {
      empresaId,
      ...(updatedSince ?? {}),
      ...(!isAdmin && usuarioId ? { usuarioId } : {}),
    };

    // RutaCliente no tiene empresaId: se filtra por la relación con las rutas de la empresa.
    // Sin filtro `activa` para que la desactivación de una ruta también propague sus
    // rutaClientes (que además dejan de viajar al filtrar la ruta padre).
    const rutaClienteWhere: Prisma.RutaClienteWhereInput = {
      ruta: {
        empresaId,
        ...(!isAdmin && usuarioId ? { usuarioId } : {}),
      },
      ...(updatedSince ?? {}),
    };

    const prestamoInclude: Prisma.PrestamoInclude = {
      cliente: { select: CLIENTE_RESUMEN_SELECT },
      garante: { select: CLIENTE_RESUMEN_SELECT },
      cuotas: { orderBy: { numero: 'asc' } },
      ...(permisos.pagos
        ? {
            pagos: {
              include: { usuario: { select: { id: true, nombre: true } } },
              orderBy: { createdAt: 'desc' },
            },
          }
        : {}),
    };

    const [clientes, prestamosRaw, rutas, rutaClientes, rutasAjenasRaw] =
      await Promise.all([
        permisos.clientes
          ? this.prisma.cliente.findMany({
              // Sin filtro `activo` para que las desactivaciones viajen en el delta.
              where: { empresaId, ...(updatedSince ?? {}) },
              orderBy: { updatedAt: 'desc' },
            })
          : Promise.resolve([]),
        permisos.prestamos
          ? this.prisma.prestamo.findMany({
              where: { empresaId, ...(updatedSince ?? {}) },
              include: prestamoInclude,
            })
          : Promise.resolve([]),
        permisos.rutas
          ? this.prisma.ruta.findMany({
              where: rutaWhere,
              include: {
                usuario: { select: { id: true, nombre: true } },
                clientes: {
                  where: { eliminado: false },
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
            })
          : Promise.resolve([]),
        permisos.rutas
          ? this.prisma.rutaCliente.findMany({
              where: rutaClienteWhere,
              orderBy: { updatedAt: 'desc' },
            })
          : Promise.resolve([]),
        // Rutas de OTROS usuarios de la empresa que cambiaron después del cursor.
        // Para no-admins: si una ruta ajena fue desactivada o reasignada a otro
        // usuario, el móvil debe retirarla de su cache local (no viaja en `rutas`
        // porque el delta ya no la incluye para ese usuario).
        !isAdmin && usuarioId && permisos.rutas
          ? this.prisma.ruta.findMany({
              where: {
                empresaId,
                usuarioId: { not: usuarioId },
                ...(updatedSince ?? {}),
              },
              select: { id: true },
            })
          : Promise.resolve([]),
      ]);

    const configuracion = permisos.configuracion
      ? await this.getConfiguracion(empresaId)
      : null;

    // Paridad con prestamos.listar/findOne: saldoPendiente y moraAcumulada se
    // calculan desde las cuotas pendientes (la columna no es fuente de verdad).
    const prestamos = prestamosRaw.map((p) => {
      const { saldoPendiente, moraAcumulada } = calcularDesdeObjeto(p);
      return { ...p, saldoPendiente, moraAcumulada };
    });

    return {
      serverTime,
      clientes,
      prestamos,
      rutas,
      rutaClientes,
      rutasAjenas: rutasAjenasRaw.map((r) => r.id),
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
