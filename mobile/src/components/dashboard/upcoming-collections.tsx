import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import type { ProximoCobro, Today } from '@/types/dashboard.types';
import { useTheme } from '@/components/ui/theme-provider';

interface UpcomingCollectionsProps {
  cobros: ProximoCobro[];
  today: Today;
}

export function UpcomingCollections({ cobros, today }: UpcomingCollectionsProps) {
  const { colorScheme, colors } = useTheme();

  if (cobros.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Cobros de hoy
        </Text>
        <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="checkmark-circle" size={32} color={colors.success} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No hay cobros pendientes hoy
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Cobros de hoy
        </Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
          ${today.montoEsperadoHoy.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} esperados
        </Text>
      </View>

      <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {cobros.map((cobro, index) => (
          <TouchableOpacity
            key={cobro.cuotaId}
            style={[
              styles.item,
              index < cobros.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
            ]}
            activeOpacity={0.6}
            onPress={() => router.push(`/pagos/prestamo/${cobro.prestamoId}`)}
          >
            <View style={styles.itemLeft}>
              <Text style={[styles.clienteNombre, { color: colors.text }]}>
                {cobro.nombre} {cobro.apellido ?? ''}
              </Text>
              <View style={styles.itemMeta}>
                {cobro.telefono && (
                  <View style={styles.metaRow}>
                    <Ionicons name="call-outline" size={12} color={colors.textTertiary} />
                    <Text style={[styles.metaText, { color: colors.textTertiary }]}>
                      {cobro.telefono}
                    </Text>
                  </View>
                )}
                <View style={styles.metaRow}>
                  <Ionicons name="receipt-outline" size={12} color={colors.textTertiary} />
                  <Text style={[styles.metaText, { color: colors.textTertiary }]}>
                    Cuota #{cobro.numero}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.itemRight}>
              <Text style={[styles.monto, { color: colors.text }]}>
                ${cobro.monto.toLocaleString('es-DO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </Text>
              {cobro.mora > 0 && (
                <Text style={[styles.mora, { color: colors.error }]}>
                  +${cobro.mora.toLocaleString('es-DO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} mora
                </Text>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.verTodos, { borderColor: colors.border }]}
        activeOpacity={0.6}
        onPress={() => router.push('/caja/pago')}
      >
        <Text style={[styles.verTodosText, { color: colors.primary }]}>
          Ver todos los cobros
        </Text>
        <Ionicons name="chevron-forward" size={16} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  sectionHeader: {
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  sectionSubtitle: {
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  listCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  itemLeft: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  clienteNombre: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  itemMeta: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: FontSize.xs,
  },
  itemRight: {
    alignItems: 'flex-end',
  },
  monto: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  mora: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    marginTop: 2,
  },
  verTodos: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
  },
  verTodosText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  emptyCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyText: {
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
});
