import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import type { TipoAlerta, Alerta } from '@/types/prestamo.types';
import { FontSize, FontWeight, Spacing, BorderRadius, scale} from '@/constants/theme';
import { useTheme } from '@/components/ui/theme-provider';

const ALERTA_COLORS: Record<TipoAlerta, string> = {
  SOLICITUD: '#0EA5E9',
  REFINANCIAMIENTO: '#8B5CF6',
  CAMBIO_FRECUENCIA: '#F59E0B',
  CAMBIO_TASA: '#3B82F6',
  CAMBIO_CUOTAS: '#10B981',
  CAMBIO_FECHA_PAGO: '#EC4899',
  CANCELACION: '#EF4444',
  CAMBIO_ESTADO: '#6366F1',
};

const ALERTA_ICONS: Record<TipoAlerta, keyof typeof Ionicons.glyphMap> = {
  SOLICITUD: 'document-text-outline',
  REFINANCIAMIENTO: 'git-network-outline',
  CAMBIO_FRECUENCIA: 'swap-horizontal-outline',
  CAMBIO_TASA: 'options-outline',
  CAMBIO_CUOTAS: 'grid-outline',
  CAMBIO_FECHA_PAGO: 'calendar-outline',
  CANCELACION: 'close-circle-outline',
  CAMBIO_ESTADO: 'shuffle-outline',
};

const TIPO_LABELS: Record<TipoAlerta, string> = {
  SOLICITUD: 'Solicitud',
  REFINANCIAMIENTO: 'Refinanciamiento',
  CAMBIO_FRECUENCIA: 'Cambio frec.',
  CAMBIO_TASA: 'Cambio tasa',
  CAMBIO_CUOTAS: 'Cambio cuotas',
  CAMBIO_FECHA_PAGO: 'Cambio fecha',
  CANCELACION: 'Cancelacion',
  CAMBIO_ESTADO: 'Cambio estado',
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Ahora';
  if (diffMins < 60) return `Hace ${diffMins}min`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays < 7) return `Hace ${diffDays}d`;

  const isThisYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString('es-DO', {
    day: '2-digit',
    month: 'short',
    ...(isThisYear ? {} : { year: 'numeric' }),
  });
}

function extractContext(tipo: TipoAlerta, detalle: Record<string, any> | null): string | null {
  if (!detalle) return null;

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(n);

  switch (tipo) {
    case 'SOLICITUD':
      if (detalle.monto != null && detalle.numeroCuotas != null) {
        return `${fmt(detalle.monto)} · ${detalle.numeroCuotas} cuotas`;
      }
      return null;
    case 'CAMBIO_ESTADO':
      if (detalle.estadoAnterior && detalle.estadoNuevo) {
        return `${detalle.estadoAnterior} → ${detalle.estadoNuevo}`;
      }
      return null;
    case 'CANCELACION':
      if (detalle.monto != null) return `Monto: ${fmt(detalle.monto)}`;
      return null;
    case 'REFINANCIAMIENTO':
      if (detalle.saldoRefinanciado != null && detalle.nuevasCuotas != null) {
        return `${fmt(detalle.saldoRefinanciado)} → ${detalle.nuevasCuotas} cuotas`;
      }
      return null;
    case 'CAMBIO_TASA':
      if (detalle.tasaAnterior != null && detalle.tasaNueva != null) {
        return `${detalle.tasaAnterior}% → ${detalle.tasaNueva}%`;
      }
      return null;
    case 'CAMBIO_CUOTAS':
      if (detalle.cuotasAntes != null && detalle.cuotasNuevas != null) {
        return `${detalle.cuotasAntes} → ${detalle.cuotasNuevas} cuotas`;
      }
      return null;
    case 'CAMBIO_FRECUENCIA':
      if (detalle.frecuenciaAnterior && detalle.frecuenciaNueva) {
        return `${detalle.frecuenciaAnterior} → ${detalle.frecuenciaNueva}`;
      }
      return null;
    case 'CAMBIO_FECHA_PAGO':
      if (detalle.nuevaFecha) return `Nueva fecha: ${detalle.nuevaFecha}`;
      return null;
    default:
      return null;
  }
}

interface AlertaCardProps {
  alerta: Alerta;
  onPress: (alerta: Alerta) => void;
  onMarkRead?: (alerta: Alerta) => void;
  onGoToLoan?: (prestamoId: string) => void;
}

function AlertaCardInner({ alerta, onPress, onMarkRead, onGoToLoan }: AlertaCardProps) {
  const { colors } = useTheme();
  const isUnread = !alerta.leida;
  const tipoColor = ALERTA_COLORS[alerta.tipo] ?? colors.primary;
  const icon = ALERTA_ICONS[alerta.tipo] ?? 'alert-circle-outline';
  const context = extractContext(alerta.tipo, alerta.detalle);

  const renderRightActions = () => {
    if (!isUnread || !onMarkRead) return null;
    return (
      <Pressable
        onPress={() => onMarkRead(alerta)}
        style={[styles.swipeAction, { backgroundColor: colors.success }]}
      >
        <Ionicons name="checkmark-done" size={scale(22)} color="#FFFFFF" />
        <Text style={styles.swipeActionText}>Leida</Text>
      </Pressable>
    );
  };

  return (
    <Swipeable renderRightActions={renderRightActions} overshootRight={false}>
      <Pressable
        onPress={() => onPress(alerta)}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: isUnread ? colors.surface : colors.surfaceElevated,
            borderColor: isUnread ? tipoColor + '30' : colors.border,
            opacity: pressed ? 0.85 : 1,
          },
          isUnread && { borderLeftWidth: 3, borderLeftColor: tipoColor },
        ]}
      >
        <View style={styles.topRow}>
          <View style={[styles.iconWrap, { backgroundColor: tipoColor + '18' }]}>
            <Ionicons name={icon} size={scale(20)} color={tipoColor} />
          </View>
          <View style={styles.info}>
            <Text
              style={[
                styles.clienteName,
                { color: colors.text, fontWeight: isUnread ? FontWeight.semibold : FontWeight.medium },
              ]}
              numberOfLines={1}
            >
              {alerta.clienteNombre}
            </Text>
            <Text
              style={[styles.descripcion, { color: isUnread ? colors.textSecondary : colors.textTertiary }]}
              numberOfLines={2}
            >
              {alerta.descripcion}
            </Text>
          </View>
          {isUnread && <View style={[styles.dot, { backgroundColor: tipoColor }]} />}
        </View>

        {context && (
          <View style={[styles.contextRow, { backgroundColor: tipoColor + '08' }]}>
            <Ionicons name="information-circle-outline" size={scale(14)} color={tipoColor} />
            <Text style={[styles.contextText, { color: tipoColor }]} numberOfLines={1}>
              {context}
            </Text>
          </View>
        )}

        <View style={styles.bottomRow}>
          <Text style={[styles.meta, { color: colors.textTertiary }]}>
            {alerta.usuarioNombre !== 'Sistema' ? `${alerta.usuarioNombre} · ` : ''}
            {formatDate(alerta.createdAt)}
          </Text>
          <View style={styles.bottomActions}>
            <View style={[styles.tipoBadge, { backgroundColor: tipoColor + '18' }]}>
              <Text style={[styles.tipoBadgeText, { color: tipoColor }]}>
                {TIPO_LABELS[alerta.tipo]}
              </Text>
            </View>
            {onGoToLoan && (
              <Pressable
                onPress={() => onGoToLoan(alerta.prestamoId)}
                hitSlop={6}
                style={styles.linkButton}
              >
                <Ionicons name="open-outline" size={scale(16)} color={colors.primary} />
              </Pressable>
            )}
          </View>
        </View>
      </Pressable>
    </Swipeable>
  );
}

export const AlertaCard = memo(AlertaCardInner);

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    marginHorizontal: Spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  iconWrap: {
    width: scale(40),
    height: scale(40),
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
  },
  clienteName: {
    fontSize: FontSize.md,
    marginBottom: scale(2),
  },
  descripcion: {
    fontSize: FontSize.sm,
    lineHeight: scale(20),
  },
  dot: {
    width: scale(8),
    height: scale(8),
    borderRadius: 4,
    marginTop: scale(4),
  },
  contextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.sm,
  },
  contextText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    flex: 1,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'transparent',
  },
  meta: {
    fontSize: FontSize.xs,
    flex: 1,
  },
  bottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  tipoBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: scale(2),
    borderRadius: BorderRadius.sm,
  },
  tipoBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  linkButton: {
    padding: Spacing.xs,
  },
  swipeAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: scale(80),
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  swipeActionText: {
    color: '#FFFFFF',
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    marginTop: scale(2),
  },
});
