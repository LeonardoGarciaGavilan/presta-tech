import { useCallback } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ui/screen-container';
import EmptyState from '@/components/ui/empty-state';
import LoadingScreen from '@/components/ui/loading-screen';
import { usePagosDePrestamo } from '@/hooks/use-pagos';
import { usePrestamo } from '@/hooks/use-prestamos';
import { AppStyles, FontSize, FontWeight, Spacing, BorderRadius, scale} from '@/constants/theme';
import { formatCurrency, formatDateTime } from '@/utils/formatters';
import { useTheme } from '@/components/ui/theme-provider';
import { METODO_PAGO_LABELS } from '@/constants/pagos.constants';

export default function PagosPrestamoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colorScheme, colors } = useTheme();

  const { data: prestamo } = usePrestamo(id!);
  const { data: pagos, isLoading, refetch } = usePagosDePrestamo(id!);

  const renderPago = useCallback(({ item }: { item: any }) => (
    <View
      style={[styles.pagoCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
    >
      <View style={styles.pagoCardHeader}>
        <Text style={[styles.pagoDate, { color: colors.text }]}>
          {formatDateTime(item.createdAt)}
        </Text>
        <View style={[styles.pagoMetodoBadge, { backgroundColor: colors.primaryLight }]}>
          <Text style={[styles.pagoMetodoText, { color: colors.primary }]}>
            {METODO_PAGO_LABELS[item.metodo] || item.metodo}
          </Text>
        </View>
      </View>
      <View style={styles.pagoAmountsRow}>
        <View style={styles.pagoAmountItem}>
          <Text style={[styles.pagoAmountLabel, { color: colors.textTertiary }]}>Capital</Text>
          <Text style={[styles.pagoAmountValue, { color: colors.text }]}>{formatCurrency(item.capital)}</Text>
        </View>
        <View style={styles.pagoAmountItem}>
          <Text style={[styles.pagoAmountLabel, { color: colors.textTertiary }]}>Interés</Text>
          <Text style={[styles.pagoAmountValue, { color: colors.warning }]}>{formatCurrency(item.interes)}</Text>
        </View>
        <View style={styles.pagoAmountItem}>
          <Text style={[styles.pagoAmountLabel, { color: colors.textTertiary }]}>Mora</Text>
          <Text style={[styles.pagoAmountValue, { color: item.mora > 0 ? colors.error : colors.textTertiary }]}>
            {item.mora > 0 ? formatCurrency(item.mora) : '—'}
          </Text>
        </View>
      </View>
      <View style={[styles.pagoTotalRow, { borderTopColor: colors.borderLight }]}>
        <Text style={[styles.pagoTotalLabel, { color: colors.textTertiary }]}>Total pagado</Text>
        <Text style={[styles.pagoTotalValue, { color: colors.text }]}>
          {formatCurrency(item.montoTotal)}
        </Text>
      </View>
      {item.usuario && (
        <Text style={{ fontSize: scale(10), color: colors.textTertiary, marginTop: Spacing.xs }}>
          Registrado por: {item.usuario.nombre}
        </Text>
      )}
    </View>
  ), [colors]);

  return (
    <ScreenContainer style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: `Pagos - ${prestamo?.cliente?.nombre || ''}`,
          headerTintColor: colors.primary,
          headerStyle: { backgroundColor: colors.background },
        }}
      />

      <FlatList
        data={pagos}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          prestamo ? (
            <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>
                Préstamo #{prestamo.id.slice(0, 8).toUpperCase()}
              </Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>
                {formatCurrency(prestamo.monto)} — {prestamo.numeroCuotas} cuotas
              </Text>
              <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>
                Saldo pendiente: {formatCurrency(prestamo.saldoPendiente)}
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          isLoading ? (
            <LoadingScreen message="Cargando pagos..." />
          ) : (
            <EmptyState
              icon="cash-outline"
              title="Sin pagos registrados"
              subtitle="Este préstamo no tiene pagos registrados aún"
            />
          )
        }
        renderItem={renderPago}
      />
    </ScreenContainer>
  );
}

const styles = {
  screen: { flex: 1 },
  listContent: { padding: Spacing.md, paddingBottom: Spacing.xxl } as AppStyles,
  summaryCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  } as AppStyles,
  summaryLabel: { fontSize: FontSize.xs },
  summaryValue: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  pagoCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  } as AppStyles,
  pagoCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  } as AppStyles,
  pagoDate: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  pagoMetodoBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: scale(2),
    borderRadius: BorderRadius.sm,
  } as AppStyles,
  pagoMetodoText: { fontSize: scale(10), fontWeight: FontWeight.bold },
  pagoAmountsRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  } as AppStyles,
  pagoAmountItem: { flex: 1, alignItems: 'center' } as AppStyles,
  pagoAmountLabel: { fontSize: scale(9) },
  pagoAmountValue: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, marginTop: scale(1) },
  pagoTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    marginTop: Spacing.xs,
    paddingTop: Spacing.xs,
  } as AppStyles,
  pagoTotalLabel: { fontSize: FontSize.xs },
  pagoTotalValue: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
};
