import { db } from './index';
import { configuracion } from './schema';
import { toCents, fromCents } from '@/utils/money';
import type { ConfiguracionResponse } from '@/api/configuracion.api';

function rowToConfig(row: typeof configuracion.$inferSelect): ConfiguracionResponse {
  return {
    id: row.id,
    tasaInteresBase: row.tasaInteresBase,
    moraPorcentajeMensual: row.moraPorcentajeMensual,
    diasGracia: row.diasGracia,
    permitirAbonoCapital: row.permitirAbonoCapital ?? true,
    montoMinimoPrestamo: fromCents(row.montoMinimoPrestamo ?? 0),
    montoMaximoPrestamo:
      row.montoMaximoPrestamo === null ? null : fromCents(row.montoMaximoPrestamo),
    montoMaximoPago:
      row.montoMaximoPago === null ? null : fromCents(row.montoMaximoPago),
    cuotasRestantesParaRenovar: row.cuotasRestantesParaRenovar ?? 0,
    maxRefinanciamientosPorPrestamo: row.maxRefinanciamientosPorPrestamo ?? 0,
    permitirRefinanciamiento: row.permitirRefinanciamiento ?? true,
    maxPrestamosActivosPorCliente: row.maxPrestamosActivosPorCliente ?? 0,
    permitirRenovacion: row.permitirRenovacion ?? false,
    maxCuotasRestantesParaRenovacion: row.maxCuotasRestantesParaRenovacion ?? 0,
    incluirInteresEnRenovacion: row.incluirInteresEnRenovacion ?? true,
    porcentajeMaximoSaldoAplicado: row.porcentajeMaximoSaldoAplicado ?? 100,
    maxRenovacionesConsecutivas: row.maxRenovacionesConsecutivas ?? 0,
    empresaId: row.empresaId,
    existe: row.existe ?? true,
  };
}

export function setConfiguracion(config: ConfiguracionResponse): void {
  const row = {
    id: config.id ?? 'default',
    tasaInteresBase: config.tasaInteresBase,
    moraPorcentajeMensual: config.moraPorcentajeMensual,
    diasGracia: config.diasGracia,
    permitirAbonoCapital: config.permitirAbonoCapital,
    montoMinimoPrestamo: toCents(config.montoMinimoPrestamo ?? 0),
    montoMaximoPrestamo:
      config.montoMaximoPrestamo === null ? null : toCents(config.montoMaximoPrestamo),
    montoMaximoPago:
      config.montoMaximoPago === null ? null : toCents(config.montoMaximoPago),
    cuotasRestantesParaRenovar: config.cuotasRestantesParaRenovar ?? 0,
    maxRefinanciamientosPorPrestamo: config.maxRefinanciamientosPorPrestamo ?? 0,
    permitirRefinanciamiento: config.permitirRefinanciamiento ?? true,
    maxPrestamosActivosPorCliente: config.maxPrestamosActivosPorCliente ?? 0,
    permitirRenovacion: config.permitirRenovacion ?? false,
    maxCuotasRestantesParaRenovacion: config.maxCuotasRestantesParaRenovacion ?? 0,
    incluirInteresEnRenovacion: config.incluirInteresEnRenovacion ?? true,
    porcentajeMaximoSaldoAplicado: config.porcentajeMaximoSaldoAplicado ?? 100,
    maxRenovacionesConsecutivas: config.maxRenovacionesConsecutivas ?? 0,
    empresaId: config.empresaId,
    existe: config.existe,
  };

  db.insert(configuracion)
    .values(row)
    .onConflictDoUpdate({ target: configuracion.id, set: row })
    .run();
}

export function getConfiguracion(): ConfiguracionResponse | null {
  const row = db.select().from(configuracion).limit(1).get();
  return row ? rowToConfig(row) : null;
}

export function clearConfiguracion(): void {
  db.delete(configuracion).run();
}
