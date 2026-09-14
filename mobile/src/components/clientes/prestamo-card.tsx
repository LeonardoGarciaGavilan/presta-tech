import { memo, useCallback, useRef } from 'react';
import { Animated as RNAnimated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';

import { BorderRadius, FontSize, FontWeight, IoniconsName, Shadows, Spacing, scale} from '@/constants/theme';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { m } from '@/utils/money';
import type { Prestamo } from '@/types/cliente.types';
import { useTheme } from '@/components/ui/theme-provider';
import { usePrestamoEstados } from '@/hooks/use-prestamo-estados';

export interface SwipeAction {
  id: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  backgroundColor: string;
  onPress: () => void;
  accessibilityLabel?: string;
}

export interface PrestamoAccion {
  id: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  color: string;
  esPrimaria?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}

interface PrestamoCardProps {
  prestamo: Prestamo;
  onPress: () => void;
  swipeActions?: SwipeAction[];
  acciones?: PrestamoAccion[];
}

function calcularSaldoReal(prestamo: Prestamo): number {
  if (m(prestamo.saldoPendiente) > 0) return m(prestamo.saldoPendiente);
  if (prestamo.cuotas?.length) {
    return prestamo.cuotas
      .filter((c) => !c.pagada)
      .reduce((sum, c) => sum + m(c.monto) + m(c.mora), 0);
  }
  return m(prestamo.saldoPendiente);
}

const ESTADOS_CON_PROGRESO = new Set(['ACTIVO', 'ATRASADO', 'RENOVADO', 'PAGADO']);

function calcularCuotaProgreso(prestamo: Prestamo): {
  total: number;
  pendientes: number;
  pagadas: number;
  proceso: number;
  siguiente: number;
} {
  const total = prestamo.numeroCuotas || 0;
  const pendientesArr = (prestamo.cuotas ?? [])
    .filter((c) => !c.pagada)
    .sort((a, b) => (a.numero ?? 0) - (b.numero ?? 0));
  const pendientes = pendientesArr.length;
  const pagadas = Math.max(0, total - pendientes);
  const proceso = total > 0 ? Math.round((pagadas / total) * 100) : 0;
  const siguiente = pendientesArr[0]?.numero ?? total;
  return { total, pendientes, pagadas, proceso, siguiente };
}

function formatFrecuencia(f: string | undefined): string {
  if (!f) return '';
  const map: Record<string, string> = {
    DIARIO: 'Diario',
    SEMANAL: 'Semanal',
    QUINCENAL: 'Quincenal',
    MENSUAL: 'Mensual',
  };
  return map[f] || f;
}

function nombreCliente(prestamo: Prestamo): string {
  if (!prestamo.cliente) return '';
  const c = prestamo.cliente;
  return `${c.nombre}${c.apellido ? ` ${c.apellido}` : ''}`;
}

function PrestamoCardBase({ prestamo, onPress, swipeActions = [], acciones = [] }: PrestamoCardProps) {
  const { colors } = useTheme();
  const estados = usePrestamoEstados();
  const config = estados[prestamo.estado] || estados.ACTIVO;
  const saldoReal = calcularSaldoReal(prestamo);
  const {
    proceso,
    total: totalCuotas,
    siguiente: proximaCuotaNum,
    pendientes,
  } = calcularCuotaProgreso(prestamo);
  const mostrarProgreso =
    ESTADOS_CON_PROGRESO.has(prestamo.estado) &&
    (prestamo.estado === 'PAGADO' ? totalCuotas > 0 : pendientes > 0);
  const swipeableRef = useRef<Swipeable>(null);

  const closeSwipe = useCallback(() => {
    swipeableRef.current?.close();
  }, []);

  const renderRightActions = (
    progress: RNAnimated.AnimatedInterpolation<number>,
  ) => {
    if (swipeActions.length === 0) return null;

    const translateX = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [swipeActions.length * 72, 0],
    });

    return (
      <View style={styles.swipeActions}>
        {swipeActions.map((action) => (
          <RNAnimated.View
            key={action.id}
            style={[styles.swipeAction, { transform: [{ translateX }] }]}
          >
            <Pressable
              onPress={() => {
                closeSwipe();
                action.onPress();
              }}
              style={[styles.swipeBtn, { backgroundColor: action.backgroundColor }]}
              accessibilityRole="button"
              accessibilityLabel={action.accessibilityLabel ?? action.label}
            >
              {action.icon && (
                <Ionicons name={action.icon} size={scale(18)} color="#FFFFFF" />
              )}
              <Text style={styles.swipeBtnText}>{action.label}</Text>
            </Pressable>
          </RNAnimated.View>
        ))}
      </View>
    );
  };

  const cardContent = (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Préstamo de ${nombreCliente(prestamo)}, monto ${formatCurrency(prestamo.monto)}, estado ${config.label}`}
      accessibilityHint={
        swipeActions.length > 0
          ? 'Desliza a la izquierda para ver más acciones.'
          : undefined
      }
      style={({ pressed }) => [
        styles.card,
        Shadows.sm,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: config.bg }]}>
          <Ionicons name={config.icon as IoniconsName} size={scale(14)} color={config.color} />
          <Text style={[styles.badgeText, { color: config.color }]}>
            {config.label}
          </Text>
        </View>
        <Text style={[styles.frecuencia, { color: colors.textTertiary }]}>
          {formatFrecuencia(prestamo.frecuenciaPago)}
        </Text>
      </View>

      {prestamo.cliente && (
        <View style={styles.clientRow}>
          <View style={styles.clientInfo}>
            <Ionicons name="person-outline" size={scale(13)} color={colors.textSecondary} />
            <Text style={[styles.clientName, { color: colors.text }]} numberOfLines={1}>
              {nombreCliente(prestamo)}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={scale(16)} color={colors.textTertiary} />
        </View>
      )}

      <View style={styles.amounts}>
        <View style={styles.amountCol}>
          <Text style={[styles.amountLabel, { color: colors.textTertiary }]}>
            Saldo
          </Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            style={[styles.amountMainValue, { color: colors.primary }]}
          >
            {formatCurrency(saldoReal)}
          </Text>
        </View>
        <View style={styles.amountCol}>
          <Text style={[styles.amountLabel, { color: colors.textTertiary }]}>
            Cuota
          </Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            style={[styles.amountValue, { color: colors.text }]}
          >
            {prestamo.cuotaMensual != null ? formatCurrency(prestamo.cuotaMensual) : '—'}
          </Text>
        </View>
        <View style={styles.amountCol}>
          <Text style={[styles.amountLabel, { color: colors.textTertiary }]}>
            Monto inicial
          </Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            style={[styles.amountMontoValue, { color: colors.textTertiary }]}
          >
            {formatCurrency(prestamo.monto)}
          </Text>
        </View>
      </View>

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        {mostrarProgreso && (
          <View style={styles.footerProgress}>
            <View
              style={[styles.progressBar, { backgroundColor: colors.borderLight }]}
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={`Cuota ${proximaCuotaNum} de ${totalCuotas}`}
              accessibilityValue={{ min: 0, max: 100, now: proceso }}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${proceso}%`,
                    backgroundColor:
                      proceso >= 100 ? colors.success : colors.primary,
                  },
                ]}
              />
            </View>
            <Text style={[styles.progressText, { color: colors.textTertiary }]}>
              Cuota {proximaCuotaNum} de {totalCuotas}
            </Text>
          </View>
        )}
        <View style={styles.footerItem}>
          <Ionicons name="calendar-outline" size={scale(12)} color={colors.textTertiary} />
          <Text style={[styles.footerText, { color: colors.textTertiary }]}>
            Vence: {formatDate(prestamo.fechaVencimiento)}
          </Text>
        </View>
      </View>

      {acciones.length > 0 && (
        <View style={styles.accionesRow}>
          {acciones.map((accion) => {
            const esPrimaria = accion.esPrimaria !== false;
            return (
              <Pressable
                key={accion.id}
                onPress={accion.onPress}
                accessible
                accessibilityRole="button"
                accessibilityLabel={accion.accessibilityLabel ?? accion.label}
                style={({ pressed }) => [
                  styles.accionBtn,
                  esPrimaria
                    ? [styles.accionBtnPrimary, { backgroundColor: accion.color, borderColor: accion.color }]
                    : [styles.accionBtnOutline, { borderColor: `${accion.color}66` }],
                  pressed && { opacity: 0.75 },
                ]}
              >
                {accion.icon && (
                  <Ionicons
                    name={accion.icon}
                    size={scale(15)}
                    color={esPrimaria ? '#FFFFFF' : accion.color}
                  />
                )}
                <Text
                  style={[
                    styles.accionLabel,
                    { color: esPrimaria ? '#FFFFFF' : accion.color },
                  ]}
                >
                  {accion.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </Pressable>
  );

  if (swipeActions.length === 0) {
    return cardContent;
  }

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}
    >
      {cardContent}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    paddingHorizontal: Spacing.sm,
    paddingVertical: scale(3),
    borderRadius: BorderRadius.sm,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  frecuencia: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    textTransform: 'capitalize',
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  clientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    flex: 1,
  },
  clientName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    flex: 1,
  },
  amounts: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  amountCol: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  amountLabel: {
    fontSize: FontSize.xs,
    marginBottom: scale(2),
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  amountMainValue: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    flexShrink: 1,
  },
  amountValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    flexShrink: 1,
  },
  amountMontoValue: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.regular,
    flexShrink: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  footerProgress: {
    flex: 1,
    gap: scale(3),
  },
  progressBar: {
    height: scale(4),
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: FontSize.xs,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  footerText: {
    fontSize: FontSize.xs,
  },
  accionesRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  accionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(6),
    minHeight: scale(44),
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
  },
  accionBtnPrimary: {
    paddingHorizontal: Spacing.md,
  },
  accionBtnOutline: {
    backgroundColor: 'transparent',
  },
  accionLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  swipeActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  swipeAction: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: 72,
    height: '100%',
    gap: scale(2),
  },
  swipeBtnText: {
    fontSize: 10,
    fontWeight: FontWeight.semibold,
    color: '#FFFFFF',
  },
});

const PrestamoCard = memo(PrestamoCardBase);
PrestamoCard.displayName = 'PrestamoCard';

export default PrestamoCard;
