import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getInicioDiaRD, getFinDiaRD } from '../common/utils/fecha.utils';
import { getFechaRD } from '../common/utils/fecha.utils';
import { startOfMonth, subDays } from 'date-fns';
import type {
  DashboardMobileResponseDto,
  PortfolioDto,
  TodayDto,
  CajaActivaDto,
  ProximoCobroDto,
} from './dto/dashboard-mobile.dto';

@Injectable()
export class DashboardMobileService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardMobile(
    empresaId: string,
    usuarioId: string,
  ): Promise<DashboardMobileResponseDto> {
    const hoy = getInicioDiaRD();
    const finHoy = getFinDiaRD();
    const inicioMes = startOfMonth(new Date());
    const fechaRD = getFechaRD();
    const hace30Dias = subDays(new Date(), 30);

    const sql = `
      WITH
      portfolio AS (
        SELECT
          COALESCE(COUNT(*) FILTER (WHERE estado = 'ACTIVO'), 0)::int AS activos,
          COALESCE(COUNT(*) FILTER (WHERE estado = 'ATRASADO'), 0)::int AS atrasados,
          COALESCE(SUM(monto) FILTER (WHERE estado IN ('ACTIVO', 'ATRASADO')), 0)::float AS monto_total_prestado
        FROM "Prestamo"
        WHERE "empresaId" = $1
      ),
      saldo_real AS (
        SELECT COALESCE(SUM(c.capital + c.interes + COALESCE(c.mora, 0)), 0)::float AS saldo_pendiente_total
        FROM "Cuota" c
        INNER JOIN "Prestamo" p ON p.id = c."prestamoId"
        WHERE c.pagada = false
          AND p."empresaId" = $1
          AND p.estado IN ('ACTIVO', 'ATRASADO')
      ),
      pagos_del_dia AS (
        SELECT
          COALESCE(SUM(pa."montoTotal"), 0)::float AS cobrado_hoy,
          COUNT(*)::int AS pagos_hoy
        FROM "Pago" pa
        INNER JOIN "Prestamo" p ON p.id = pa."prestamoId"
        WHERE p."empresaId" = $1
          AND pa."createdAt" >= $2::timestamptz
          AND pa."createdAt" <= $3::timestamptz
      ),
      pagos_del_mes AS (
        SELECT COALESCE(SUM(pa."montoTotal"), 0)::float AS cobrado_mes
        FROM "Pago" pa
        INNER JOIN "Prestamo" p ON p.id = pa."prestamoId"
        WHERE p."empresaId" = $1
          AND pa."createdAt" >= $4::timestamptz
          AND pa."createdAt" <= $3::timestamptz
      ),
      cuotas_hoy AS (
        SELECT
          COUNT(*)::int AS cuotas_pendientes_hoy,
          COALESCE(SUM(c.monto), 0)::float AS monto_esperado_hoy
        FROM "Cuota" c
        INNER JOIN "Prestamo" p ON p.id = c."prestamoId"
        WHERE c.pagada = false
          AND p."empresaId" = $1
          AND p.estado IN ('ACTIVO', 'ATRASADO')
          AND c."fechaVencimiento" >= $2::timestamptz
          AND c."fechaVencimiento" <= $3::timestamptz
      ),
      mora_critica AS (
        SELECT COUNT(DISTINCT c."prestamoId")::int AS prestamos_mora_critica
        FROM "Cuota" c
        INNER JOIN "Prestamo" p ON p.id = c."prestamoId"
        WHERE c.pagada = false
          AND p."empresaId" = $1
          AND p.estado = 'ATRASADO'
          AND c."fechaVencimiento" <= $5::timestamptz
      ),
      proximos_cobros AS (
        SELECT
          c.id AS "cuotaId",
          c.numero,
          c.monto,
          COALESCE(c.mora, 0) AS mora,
          p.id AS "prestamoId",
          cl.id AS "clienteId",
          cl.nombre,
          cl.apellido,
          cl.telefono
        FROM "Cuota" c
        INNER JOIN "Prestamo" p ON p.id = c."prestamoId"
        INNER JOIN "Cliente" cl ON cl.id = p."clienteId"
        WHERE c.pagada = false
          AND p."empresaId" = $1
          AND p.estado IN ('ACTIVO', 'ATRASADO')
          AND c."fechaVencimiento" >= $2::timestamptz
          AND c."fechaVencimiento" <= $3::timestamptz
        ORDER BY c."fechaVencimiento" ASC, cl.nombre ASC
        LIMIT 10
      ),
      caja_activa AS (
        SELECT
          id,
          "montoInicial",
          "totalIngresos",
          "createdAt"
        FROM "CajaSesion"
        WHERE "empresaId" = $1
          AND "usuarioId" = $6
          AND "fecha" = $7
          AND "estado" = 'ABIERTA'
        LIMIT 1
      )
      SELECT
        row_to_json(portfolio.*) AS portfolio,
        row_to_json(saldo_real.*) AS saldo_real,
        row_to_json(pagos_del_dia.*) AS pagos_del_dia,
        row_to_json(pagos_del_mes.*) AS pagos_del_mes,
        row_to_json(cuotas_hoy.*) AS cuotas_hoy,
        row_to_json(mora_critica.*) AS mora_critica,
        (SELECT json_agg(row_to_json(pc.*)) FROM proximos_cobros pc) AS proximos_cobros,
        (SELECT row_to_json(ca.*) FROM caja_activa ca) AS caja_activa
    `;

    const rows: unknown[] = await this.prisma.$queryRawUnsafe(sql, empresaId, hoy, finHoy, inicioMes, hace30Dias, usuarioId, fechaRD);

    const raw = rows[0] as Record<string, unknown>;

    const portfolio = raw.portfolio as PortfolioDto;
    const saldoReal = raw.saldo_real as { saldo_pendiente_total: number };
    const pagosDia = raw.pagos_del_dia as { cobrado_hoy: number; pagos_hoy: number };
    const pagosMes = raw.pagos_del_mes as { cobrado_mes: number };
    const cuotasHoyRaw = raw.cuotas_hoy as { cuotas_pendientes_hoy: number; monto_esperado_hoy: number };
    const moraCritica = raw.mora_critica as { prestamos_mora_critica: number };
    const proximosCobrosRaw = raw.proximos_cobros as ProximoCobroDto[] | null;
    const cajaRaw = raw.caja_activa as CajaActivaDto | null;

    return {
      portfolio: {
        activos: portfolio.activos,
        atrasados: portfolio.atrasados,
        montoTotalPrestado: Math.round(portfolio.montoTotalPrestado * 100) / 100,
        saldoPendienteTotal: Math.round(saldoReal.saldo_pendiente_total * 100) / 100,
      },
      today: {
        cobradoHoy: Math.round(pagosDia.cobrado_hoy * 100) / 100,
        pagosHoy: pagosDia.pagos_hoy,
        cobradoMes: Math.round(pagosMes.cobrado_mes * 100) / 100,
        cuotasPendientesHoy: cuotasHoyRaw.cuotas_pendientes_hoy,
        montoEsperadoHoy: Math.round(cuotasHoyRaw.monto_esperado_hoy * 100) / 100,
        prestamosMoraCritica: moraCritica.prestamos_mora_critica,
      },
      caja: cajaRaw
        ? {
            id: cajaRaw.id,
            montoInicial: Math.round(cajaRaw.montoInicial * 100) / 100,
            totalIngresos: Math.round(cajaRaw.totalIngresos * 100) / 100,
            createdAt: cajaRaw.createdAt,
          }
        : null,
      proximosCobros: (proximosCobrosRaw ?? []).map((c) => ({
        cuotaId: c.cuotaId,
        numero: c.numero,
        monto: Math.round(c.monto * 100) / 100,
        mora: Math.round(c.mora * 100) / 100,
        prestamoId: c.prestamoId,
        clienteId: c.clienteId,
        nombre: c.nombre,
        apellido: c.apellido,
        telefono: c.telefono,
      })),
    };
  }
}
