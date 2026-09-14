import { useTheme } from '@/components/ui/theme-provider';
import type { Colors } from '@/constants/theme';

type ThemeColors = typeof Colors.light;

export interface EstadoConfig {
  label: string;
  color: string;
  bg: string;
  icon: string;
  text: string;
  border: string;
}

const ESTADO_MAP: Record<string, { label: string; icon: string; colorKey: keyof ThemeColors; bgKey: keyof ThemeColors; borderKey: keyof ThemeColors }> = {
  SOLICITADO: { label: 'Solicitado', icon: 'time-outline', colorKey: 'info', bgKey: 'infoLight', borderKey: 'info' },
  EN_REVISION: { label: 'En Revisión', icon: 'search-outline', colorKey: 'info', bgKey: 'infoLight', borderKey: 'info' },
  APROBADO: { label: 'Aprobado', icon: 'checkmark-circle-outline', colorKey: 'success', bgKey: 'successLight', borderKey: 'success' },
  RECHAZADO: { label: 'Rechazado', icon: 'close-circle-outline', colorKey: 'error', bgKey: 'errorLight', borderKey: 'error' },
  ACTIVO: { label: 'Activo', icon: 'checkmark-circle', colorKey: 'success', bgKey: 'successLight', borderKey: 'success' },
  RENOVADO: { label: 'Renovado', icon: 'refresh-circle', colorKey: 'teal', bgKey: 'tealLight', borderKey: 'teal' },
  ATRASADO: { label: 'Atrasado', icon: 'alert-circle', colorKey: 'error', bgKey: 'errorLight', borderKey: 'error' },
  PAGADO: { label: 'Pagado', icon: 'checkmark-done-circle', colorKey: 'textTertiary', bgKey: 'surface', borderKey: 'border' },
  CANCELADO: { label: 'Cancelado', icon: 'ban-outline', colorKey: 'info', bgKey: 'infoLight', borderKey: 'info' },
};

export function usePrestamoEstados() {
  const { colors } = useTheme();

  const config: Record<string, EstadoConfig> = {};
  for (const [key, def] of Object.entries(ESTADO_MAP)) {
    config[key] = {
      label: def.label,
      icon: def.icon,
      color: colors[def.colorKey],
      bg: colors[def.bgKey],
      text: colors[def.colorKey],
      border: colors[def.borderKey],
    };
  }

  return config;
}

export const ACCIONES_FLOW_CONFIG: Record<string, { titulo: string; desc: string; icon: string; colorKey: keyof ThemeColors; pedirMotivo: boolean }> = {
  EN_REVISION: { titulo: 'Poner en Revisión', desc: 'El préstamo pasará a estado EN REVISIÓN.', icon: 'search-outline', colorKey: 'info', pedirMotivo: false },
  APROBADO: { titulo: 'Aprobar Préstamo', desc: 'El préstamo quedará APROBADO y pendiente de desembolso.', icon: 'checkmark-circle-outline', colorKey: 'success', pedirMotivo: false },
  RECHAZADO: { titulo: 'Rechazar Préstamo', desc: 'El préstamo será RECHAZADO. Esta acción no se puede deshacer.', icon: 'close-circle-outline', colorKey: 'error', pedirMotivo: true },
  DESEMBOLSAR: { titulo: 'Desembolsar', desc: 'Se generarán las cuotas, el monto saldrá de tu caja.', icon: 'cash', colorKey: 'primary', pedirMotivo: false },
};

export function useAccionesFlow() {
  const { colors } = useTheme();

  const config: Record<string, { titulo: string; desc: string; icon: string; color: string; pedirMotivo: boolean }> = {};
  for (const [key, def] of Object.entries(ACCIONES_FLOW_CONFIG)) {
    config[key] = {
      titulo: def.titulo,
      desc: def.desc,
      icon: def.icon,
      color: colors[def.colorKey],
      pedirMotivo: def.pedirMotivo,
    };
  }

  return config;
}

export type TipoAccionPrestamo = 'revisar' | 'aprobar' | 'desembolsar' | 'rechazar';

export interface AccionPrestamo {
  id: string;
  tipo: TipoAccionPrestamo;
  label: string;
  icon: string;
  color: string;
  esPrimaria: boolean;
}

const ACCIONES_BY_TIPO: Record<TipoAccionPrestamo, { label: string; icon: string }> = {
  revisar: { label: 'Revisar', icon: 'search-outline' },
  aprobar: { label: 'Aprobar', icon: 'checkmark-circle-outline' },
  desembolsar: { label: 'Desembolsar', icon: 'cash' },
  rechazar: { label: 'Rechazar', icon: 'close-circle-outline' },
};

export function obtenerAccionesPorEstado(opts: {
  estado: string;
  puedeRevisar: boolean;
  puedeAprobar: boolean;
  puedeDesembolsar: boolean;
  colores: { info: string; success: string; error: string; primary: string };
}): AccionPrestamo[] {
  const { estado, puedeRevisar, puedeAprobar, puedeDesembolsar, colores } = opts;

  const colorDe: Record<TipoAccionPrestamo, string> = {
    revisar: colores.info,
    aprobar: colores.success,
    desembolsar: colores.primary,
    rechazar: colores.error,
  };

  const definir = (tipo: TipoAccionPrestamo, id: string, esPrimaria: boolean): AccionPrestamo => ({
    id,
    tipo,
    esPrimaria,
    color: colorDe[tipo],
    ...ACCIONES_BY_TIPO[tipo],
  });

  const acciones: AccionPrestamo[] = [];

  if (estado === 'SOLICITADO' && puedeRevisar) {
    acciones.push(definir('rechazar', 'rechazar-solicitado', false));
    acciones.push(definir('revisar', 'revisar', true));
  } else if (estado === 'EN_REVISION' && (puedeRevisar || puedeAprobar)) {
    if (puedeRevisar) acciones.push(definir('rechazar', 'rechazar-en-revision', false));
    if (puedeAprobar) acciones.push(definir('aprobar', 'aprobar', true));
  } else if (estado === 'APROBADO' && (puedeRevisar || puedeDesembolsar)) {
    if (puedeRevisar) acciones.push(definir('rechazar', 'rechazar-aprobado', false));
    if (puedeDesembolsar) acciones.push(definir('desembolsar', 'desembolsar', true));
  }

  return acciones;
}
