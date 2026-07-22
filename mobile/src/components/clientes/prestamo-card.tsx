import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { BorderRadius, FontSize, FontWeight, IoniconsName, Shadows, Spacing, scale} from '@/constants/theme';
import { formatCurrency, formatDate } from '@/utils/formatters';
import type { Prestamo } from '@/types/cliente.types';
import { useTheme } from '@/components/ui/theme-provider';
import { usePrestamoEstados } from '@/hooks/use-prestamo-estados';

interface PrestamoCardProps {
  prestamo: Prestamo;
  onPress: () => void;
}

function calcularSaldoReal(prestamo: Prestamo): number {
  if (prestamo.saldoPendiente > 0) return prestamo.saldoPendiente;
  if (prestamo.cuotas?.length) {
    return prestamo.cuotas.reduce((sum, c) => sum + (c.monto || 0) + (c.mora || 0), 0);
  }
  return prestamo.saldoPendiente ?? 0;
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

function PrestamoCardBase({ prestamo, onPress }: PrestamoCardProps) {
  const { colors } = useTheme();
  const estados = usePrestamoEstados();
  const config = estados[prestamo.estado] || estados.ACTIVO;
  const saldoReal = calcularSaldoReal(prestamo);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Préstamo de ${nombreCliente(prestamo)}, monto ${formatCurrency(prestamo.monto)}, estado ${config.label}`}
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
        <View style={styles.amountBlock}>
          <Text style={[styles.amountLabel, { color: colors.textTertiary }]}>
            Monto
          </Text>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[styles.amountValue, { color: colors.text }]}>
            {formatCurrency(prestamo.monto)}
          </Text>
        </View>
        <View style={styles.amountBlock}>
          <Text style={[styles.amountLabel, { color: colors.textTertiary }]}>
            Saldo
          </Text>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[styles.amountValue, { color: colors.primary }]}>
            {formatCurrency(saldoReal)}
          </Text>
        </View>
        <View style={styles.amountBlock}>
          <Text style={[styles.amountLabel, { color: colors.textTertiary }]}>
            Cuota
          </Text>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[styles.amountValue, { color: colors.text }]}>
            {formatCurrency(prestamo.cuotaMensual)}
          </Text>
        </View>
      </View>

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <View style={styles.footerItem}>
          <Ionicons name="calendar-outline" size={scale(12)} color={colors.textTertiary} />
          <Text style={[styles.footerText, { color: colors.textTertiary }]}>
            Vence: {formatDate(prestamo.fechaVencimiento)}
          </Text>
        </View>
      </View>
    </Pressable>
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
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  amountBlock: {
    flex: 1,
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: FontSize.xs,
    marginBottom: scale(2),
    textAlign: 'center',
  },
  amountValue: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    flexShrink: 1,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  footerText: {
    fontSize: FontSize.xs,
  },
});

const PrestamoCard = memo(PrestamoCardBase);
PrestamoCard.displayName = 'PrestamoCard';

export default PrestamoCard;
