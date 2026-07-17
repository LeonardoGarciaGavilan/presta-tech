import { Ionicons } from '@expo/vector-icons';

import type { IoniconsName } from '@/constants/theme';

export const METODO_PAGO_LABELS: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  TARJETA: 'Tarjeta',
  CHEQUE: 'Cheque',
};

export const METODO_PAGO_OPTIONS = Object.entries(METODO_PAGO_LABELS).map(
  ([value, label]) => ({ value, label }),
);

export const METODO_PAGO_ICONS: Record<string, IoniconsName> = {
  EFECTIVO: 'cash-outline',
  TRANSFERENCIA: 'swap-horizontal-outline',
  TARJETA: 'card-outline',
  CHEQUE: 'document-text-outline',
};
