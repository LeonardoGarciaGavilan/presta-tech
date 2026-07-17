import { Text, View, StyleSheet } from 'react-native';
import { FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { formatCurrency } from '@/utils/formatters';
import type { ResumenVistaDia } from '@/types/rutas.types';

interface RutaStatsGridProps {
  resumen: ResumenVistaDia;
  colors: any;
}

export function RutaStatsGrid({ resumen, colors }: RutaStatsGridProps) {
  return (
    <View style={styles.statsGrid}>
      <View style={[styles.statCard, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
        <Text style={[styles.statValue, { color: colors.primary }]}>{resumen.aVisitarHoy}</Text>
        <Text style={[styles.statLabel, { color: colors.primary }]}>A visitar</Text>
      </View>
      <View style={[styles.statCard, { backgroundColor: colors.successLight, borderColor: colors.success }]}>
        <Text style={[styles.statValue, { color: colors.success }]}>{resumen.visitadosHoy}</Text>
        <Text style={[styles.statLabel, { color: colors.success }]}>Visitados</Text>
      </View>
      <View style={[styles.statCard, { backgroundColor: colors.errorLight, borderColor: colors.error }]}>
        <Text style={[styles.statValue, { color: colors.error }]}>{resumen.conAtrasados}</Text>
        <Text style={[styles.statLabel, { color: colors.error }]}>Atrasados</Text>
      </View>
      <View style={[styles.statCard, { backgroundColor: colors.infoLight, borderColor: colors.info }]}>
        <Text style={[styles.statValue, { color: colors.info }]}>
          {formatCurrency(resumen.totalACobrarHoy)}
        </Text>
        <Text style={[styles.statLabel, { color: colors.info }]}>A cobrar</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statCard: {
    flex: 1,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.sm,
    alignItems: 'center',
  },
  statValue: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  statLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    marginTop: 1,
  },
});
