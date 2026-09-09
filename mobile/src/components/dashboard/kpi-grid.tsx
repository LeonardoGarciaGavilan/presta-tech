import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { FontSize, FontWeight, Spacing, BorderRadius, scale } from '@/constants/theme';
import type { Portfolio, Today } from '@/types/dashboard.types';
import { formatCurrency } from '@/utils/formatters';
import { useTheme } from '@/components/ui/theme-provider';

interface KPIGridProps {
  portfolio: Portfolio;
  today: Today;
}

interface KPICardProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  bgColor: string;
  value: string;
  label: string;
}

function KPICard({ icon, iconColor, bgColor, value, label }: KPICardProps) {
  const { colorScheme, colors } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.kpiBackground }]}>
      <View style={[styles.iconWrap, { backgroundColor: bgColor }]}>
        <Ionicons name={icon} size={scale(20)} color={iconColor} />
      </View>
      <Text style={[styles.value, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit accessibilityRole="text">
        {value}
      </Text>
      <Text style={[styles.label, { color: colors.textSecondary }]} accessibilityRole="text">{label}</Text>
    </View>
  );
}

export function KPIGrid({ portfolio, today }: KPIGridProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.grid}>
      <KPICard
        icon="briefcase"
        iconColor={colors.primary}
        bgColor={colors.primaryLight}
        value={portfolio.activos.toString()}
        label="Cartera activa"
      />
      <KPICard
        icon="warning"
        iconColor={colors.warning}
        bgColor={colors.warningLight}
        value={today.cuotasPendientesHoy.toString()}
        label="Vencen hoy"
      />
      <KPICard
        icon="trending-up"
        iconColor={colors.success}
        bgColor={colors.successLight}
        value={formatCurrency(today.cobradoHoy)}
        label="Cobrado hoy"
      />
      <KPICard
        icon="flame"
        iconColor={colors.error}
        bgColor={colors.errorLight}
        value={today.prestamosMoraCritica.toString()}
        label="Mora crítica"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(12),
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  card: {
    width: '47%',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
  },
  iconWrap: {
    width: scale(40),
    height: scale(40),
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  value: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    marginBottom: scale(2),
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
});
