import type { ClienteVistaDia } from '@/types/rutas.types';
import { roundMoney } from '@/utils/money';

export function getCuotaACobrar(cliente: Pick<ClienteVistaDia, 'prestamos'>) {
  return cliente.prestamos?.[0]?.proximaCuota ?? null;
}

export function getMontoCuotaACobrar(cliente: Pick<ClienteVistaDia, 'prestamos'>): number {
  const cuota = getCuotaACobrar(cliente);
  if (!cuota) return 0;
  return roundMoney((cuota.monto + (cuota.mora || 0)));
}
