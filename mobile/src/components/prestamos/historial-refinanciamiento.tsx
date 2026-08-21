import { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/components/ui/theme-provider';
import { formatCurrency, formatDate, formatDateTime } from '@/utils/formatters';
import { BorderRadius, FontSize, FontWeight, Spacing, scale } from '@/constants/theme';

export interface RegistroRefinanciamiento {
  fecha?: string;
  usuarioId?: string;
  motivo?: string | null;
  cuotasPendientesAntes?: number;
  saldoAntes?: number;
  tasaAntes?: number;
  frecuenciaAntes?: string;
  nuevasCuotas?: number;
  nuevaTasa?: number;
  nuevaFrecuencia?: string;
  nuevaFechaPago?: string | null;
  saldoRefinanciado?: number;
  nuevaCuotaMensual?: number;
  nuevoMontoTotal?: number;
  interesPerdido?: number;
  cuotasEliminadas?: Array<Record<string, any>>;
}

interface HistorialRefinanciamientoProps {
  historial: any | null | undefined;
}

function esArrayHistorial(h: any): h is RegistroRefinanciamiento[] {
  return Array.isArray(h) && h.length > 0;
}

const FREQ_LABEL: Record<string, string> = {
  DIARIO: 'Diario',
  SEMANAL: 'Semanal',
  QUINCENAL: 'Quincenal',
  MENSUAL: 'Mensual',
};

const freqLabel = (f?: string) => (f ? FREQ_LABEL[f] ?? f : '—');

const HistorialRefinanciamientoBase = ({ historial }: HistorialRefinanciamientoProps) => {
  const { colors } = useTheme();
  const [expandido, setExpandido] = useState(false);
  const [detalleIdx, setDetalleIdx] = useState<number | null>(null);

  if (!esArrayHistorial(historial)) return null;

  const registros = [...historial].reverse(); // más reciente primero

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Pressable
        onPress={() => setExpandido((v) => !v)}
        style={styles.header}
        accessibilityRole="button"
        accessibilityLabel="Historial de refinanciamientos"
      >
        <Ionicons name="git-branch-outline" size={scale(16)} color={colors.info} />
        <Text style={[styles.title, { color: colors.text }]}>
          Historial de refinanciamientos ({historial.length})
        </Text>
        <Ionicons
          name={expandido ? 'chevron-up' : 'chevron-down'}
          size={scale(16)}
          color={colors.textTertiary}
        />
      </Pressable>

      {expandido &&
        registros.map((r, idx) => (
          <View
            key={`${r.fecha ?? 'ref'}-${idx}`}
            style={[styles.registro, { borderBottomColor: colors.borderLight }]}
          >
            <View style={styles.registroHeader}>
              <Text style={[styles.fecha, { color: colors.textTertiary }]}>
                {formatDateTime(r.fecha ?? null)}
              </Text>
              {(r as any).usuarioNombre || r.usuarioId ? (
                <Text style={[styles.usuario, { color: colors.textTertiary }]} numberOfLines={1}>
                  {(r as any).usuarioNombre ?? r.usuarioId?.slice(0, 8)}
                </Text>
              ) : null}
            </View>

            <View style={styles.fila}>
              <Text style={[styles.label, { color: colors.textTertiary }]}>Saldo refinanciado</Text>
              <Text style={[styles.valor, { color: colors.text }]}>
                {formatCurrency(r.saldoAntes ?? 0)} → {formatCurrency(r.saldoRefinanciado ?? 0)}
              </Text>
            </View>
            <View style={styles.fila}>
              <Text style={[styles.label, { color: colors.textTertiary }]}>Cuotas</Text>
              <Text style={[styles.valor, { color: colors.text }]}>
                {r.cuotasPendientesAntes ?? '—'} pendientes → {r.nuevasCuotas ?? '—'} nuevas
              </Text>
            </View>
            <View style={styles.fila}>
              <Text style={[styles.label, { color: colors.textTertiary }]}>Tasa</Text>
              <Text style={[styles.valor, { color: colors.text }]}>
                {r.tasaAntes ?? '—'}% → {r.nuevaTasa ?? '—'}%
              </Text>
            </View>
            <View style={styles.fila}>
              <Text style={[styles.label, { color: colors.textTertiary }]}>Frecuencia</Text>
              <Text style={[styles.valor, { color: colors.text }]}>
                {freqLabel(r.frecuenciaAntes)} → {freqLabel(r.nuevaFrecuencia)}
              </Text>
            </View>
            {typeof r.interesPerdido === 'number' && r.interesPerdido > 0 && (
              <View style={styles.fila}>
                <Text style={[styles.label, { color: colors.textTertiary }]}>Interés no refinanciado</Text>
                <Text style={[styles.valor, { color: colors.warning }]}>{formatCurrency(r.interesPerdido)}</Text>
              </View>
            )}
            {r.motivo ? (
              <View style={styles.fila}>
                <Text style={[styles.label, { color: colors.textTertiary }]}>Motivo</Text>
                <Text style={[styles.valor, { color: colors.text }]} numberOfLines={2}>
                  {r.motivo}
                </Text>
              </View>
            ) : null}

            {Array.isArray(r.cuotasEliminadas) && r.cuotasEliminadas.length > 0 && (
              <>
                <Pressable
                  onPress={() => setDetalleIdx(detalleIdx === idx ? null : idx)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel="Ver cuotas originales eliminadas"
                >
                  <Text style={[styles.detalleToggle, { color: colors.info }]}>
                    {detalleIdx === idx ? 'Ocultar' : 'Ver'} cuotas originales ({r.cuotasEliminadas.length})
                  </Text>
                </Pressable>
                {detalleIdx === idx && (
                  <View style={[styles.cuotasBox, { backgroundColor: colors.background, borderColor: colors.borderLight }]}>
                    {r.cuotasEliminadas.map((c, i) => (
                      <Text key={i} style={[styles.cuotaLinea, { color: colors.textSecondary }]}>
                        #{c.numero} · {formatDate(c.fechaVencimiento ?? null)} · {formatCurrency(c.monto)} (cap {formatCurrency(c.capital)} + int {formatCurrency(c.interes)}
                        {c.mora ? ` + mora ${formatCurrency(c.mora)}` : ''})
                      </Text>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>
        ))}
    </View>
  );
};

const HistorialRefinanciamiento = memo(HistorialRefinanciamientoBase);
HistorialRefinanciamiento.displayName = 'HistorialRefinanciamiento';

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginTop: Spacing.md,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    padding: Spacing.md,
  },
  title: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, flex: 1 },
  registro: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    marginBottom: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.xs,
  },
  registroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fecha: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  usuario: { fontSize: FontSize.xs, maxWidth: '40%' },
  fila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  label: { fontSize: FontSize.xs, flexShrink: 0 },
  valor: { fontSize: FontSize.xs, textAlign: 'right', flexShrink: 1 },
  detalleToggle: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, marginTop: 2 },
  cuotasBox: {
    borderRadius: BorderRadius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.xs,
    gap: 2,
  },
  cuotaLinea: { fontSize: scale(10) },
});

export default HistorialRefinanciamiento;
