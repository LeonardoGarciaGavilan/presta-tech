import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import type { CajaActiva } from '@/types/dashboard.types';
import { useTheme } from '@/components/ui/theme-provider';

interface DashboardHeroProps {
  nombre: string;
  caja: CajaActiva | null;
}

export function DashboardHero({ nombre, caja }: DashboardHeroProps) {
  const { colorScheme, colors } = useTheme();

  const fecha = new Date().toLocaleDateString('es-DO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <View style={styles.container}>
      <View style={styles.greeting}>
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
          ¡Hola, {nombre}!
        </Text>
        <Text style={[styles.date, { color: colors.textSecondary }]}>
          {fecha.charAt(0).toUpperCase() + fecha.slice(1)}
        </Text>
      </View>

      {caja ? (
        <View style={[styles.cajaCard, { backgroundColor: colors.successLight, borderColor: colors.success }]}>
          <View style={styles.cajaHeader}>
            <Ionicons name="wallet" size={20} color={colors.success} />
            <Text style={[styles.cajaLabel, { color: colors.success }]}>
              Caja abierta
            </Text>
          </View>
          <Text style={[styles.cajaMonto, { color: colors.success }]}>
            ${caja.totalIngresos.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          <Text style={[styles.cajaSubtext, { color: colors.success }]}>
            Ingresos de hoy
          </Text>
        </View>
      ) : (
        <View style={[styles.cajaCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cajaHeader}>
            <Ionicons name="wallet-outline" size={20} color={colors.textTertiary} />
            <Text style={[styles.cajaLabel, { color: colors.textTertiary }]}>
              Caja cerrada
            </Text>
          </View>
          <Text style={[styles.cajaSubtext, { color: colors.textTertiary }]}>
            Abre caja para registrar pagos
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  greeting: {
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
  },
  date: {
    fontSize: FontSize.sm,
    marginTop: Spacing.xs,
  },
  cajaCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
  },
  cajaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  cajaLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  cajaMonto: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
  },
  cajaSubtext: {
    fontSize: FontSize.xs,
    marginTop: 2,
  },
});
