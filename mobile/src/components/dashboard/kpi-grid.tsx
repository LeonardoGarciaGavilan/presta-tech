import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import type { Portfolio, Today } from '@/types/dashboard.types';
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
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <Text style={[styles.value, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit accessibilityRole="text">
        {value}
      </Text>
      <Text style={[styles.label, { color: colors.textSecondary }]} accessibilityRole="text">{label}</Text>
    </View>
  );
}

export function KPIGrid({ portfolio, today }: KPIGridProps) {
  return (
    <View style={styles.grid}>
      <KPICard
        icon="briefcase"
        iconColor="#2563EB"
        bgColor="#EFF6FF"
        value={portfolio.activos.toString()}
        label="Cartera activa"
      />
      <KPICard
        icon="warning"
        iconColor="#D97706"
        bgColor="#FFFBEB"
        value={today.cuotasPendientesHoy.toString()}
        label="Vencen hoy"
      />
      <KPICard
        icon="trending-up"
        iconColor="#16A34A"
        bgColor="#F0FDF4"
        value={`$${today.cobradoHoy.toLocaleString('es-DO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
        label="Cobrado hoy"
      />
      <KPICard
        icon="flame"
        iconColor="#DC2626"
        bgColor="#FEF2F2"
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
    gap: 12,
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
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  value: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    marginBottom: 2,
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
});
