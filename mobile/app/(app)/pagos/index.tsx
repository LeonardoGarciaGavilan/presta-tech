import { useCallback, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, RefreshControl, Text, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ui/screen-container';
import { AppButton } from '@/components/ui/app-button';
import SearchBar from '@/components/ui/search-bar';
import EmptyState from '@/components/ui/empty-state';
import LoadingScreen from '@/components/ui/loading-screen';
import { useTodosPagos, usePago, useResumenPagos } from '@/hooks/use-pagos';
import { usePrestamos } from '@/hooks/use-prestamos';
import { AppStyles, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { formatCurrency, formatDate, formatDateTime } from '@/utils/formatters';
import { guardarReciboPDF } from '@/utils/recibo-pdf';
import { useToast } from '@/components/ui/toast';
import { useTheme } from '@/components/ui/theme-provider';
import { METODO_PAGO_LABELS } from '@/constants/pagos.constants';

export default function PagosScreen() {
  const { colorScheme, colors } = useTheme();
  const [search, setSearch] = useState('');
  const [selectedPagoId, setSelectedPagoId] = useState<string | null>(null);

  const { data: resumen, isLoading: loadingResumen } = useResumenPagos();
  const { data: pagos, isLoading: loadingPagos, refetch } = useTodosPagos();

  const { data: pagoDetalle, isLoading: loadingDetalle } = usePago(selectedPagoId || '');

  const { showToast } = useToast();

  const filteredPagos = useMemo(() => {
    if (!pagos) return [];
    if (!search.trim()) return pagos;
    const q = search.toLowerCase();
    return pagos.filter((p: any) => {
      const cliente = p.prestamo?.cliente;
      const nombre = `${cliente?.nombre || ''} ${cliente?.apellido || ''}`.toLowerCase();
      const cedula = cliente?.cedula || '';
      return nombre.includes(q) || cedula.includes(q) || p.id.toLowerCase().includes(q);
    });
  }, [pagos, search]);

  const renderPagoCard = useCallback(({ item }: { item: any }) => {
    const cliente = item.prestamo?.cliente;
    return (
      <Pressable
        onPress={() => setSelectedPagoId(item.id)}
        style={[styles.pagoCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
      >
        <View style={styles.pagoCardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.pagoCliente, { color: colors.text }]} numberOfLines={1}>
              {cliente?.nombre} {cliente?.apellido || ''}
            </Text>
            <Text style={[styles.pagoDate, { color: colors.textTertiary }]}>
              {formatDateTime(item.createdAt)}
            </Text>
          </View>
          <View style={[styles.pagoMetodoBadge, { backgroundColor: colors.primaryLight }]}>
            <Text style={[styles.pagoMetodoText, { color: colors.primary }]}>
              {METODO_PAGO_LABELS[item.metodo] || item.metodo}
            </Text>
          </View>
        </View>
        <View style={styles.pagoCardBody}>
          <View style={styles.pagoAmounts}>
            <Text style={[styles.pagoAmountLabel, { color: colors.textTertiary }]}>Capital</Text>
            <Text style={[styles.pagoAmountValue, { color: colors.text }]}>{formatCurrency(item.capital)}</Text>
          </View>
          <View style={styles.pagoAmounts}>
            <Text style={[styles.pagoAmountLabel, { color: colors.textTertiary }]}>Interés</Text>
            <Text style={[styles.pagoAmountValue, { color: colors.warning }]}>{formatCurrency(item.interes)}</Text>
          </View>
          <View style={styles.pagoAmounts}>
            <Text style={[styles.pagoAmountLabel, { color: colors.textTertiary }]}>Mora</Text>
            <Text style={[styles.pagoAmountValue, { color: item.mora > 0 ? colors.error : colors.textTertiary }]}>
              {item.mora > 0 ? formatCurrency(item.mora) : '—'}
            </Text>
          </View>
          <View style={styles.pagoAmounts}>
            <Text style={[styles.pagoAmountLabel, { color: colors.textTertiary }]}>Total</Text>
            <Text style={[styles.pagoAmountValue, { color: colors.text, fontWeight: FontWeight.bold }]}>
              {formatCurrency(item.montoTotal)}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  }, [colors]);

  return (
    <ScreenContainer style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Pagos',
          headerTintColor: colors.primary,
          headerStyle: { backgroundColor: colors.background },
        }}
      />

      <FlatList
        data={filteredPagos}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={loadingPagos} onRefresh={refetch} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <>
            {/* Summary Cards */}
            {resumen && (
              <View style={styles.resumenRow}>
                <View style={[styles.resumenCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.resumenValue, { color: colors.primary }]}>
                    {formatCurrency(resumen.cobradoHoy)}
                  </Text>
                  <Text style={[styles.resumenLabel, { color: colors.textTertiary }]}>Hoy</Text>
                </View>
                <View style={[styles.resumenCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.resumenValue, { color: colors.primary }]}>
                    {formatCurrency(resumen.cobradoMes)}
                  </Text>
                  <Text style={[styles.resumenLabel, { color: colors.textTertiary }]}>Este mes</Text>
                </View>
                <View style={[styles.resumenCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.resumenValue, { color: colors.text, fontSize: FontSize.lg }]}>
                    {resumen.pagosHoy}
                  </Text>
                  <Text style={[styles.resumenLabel, { color: colors.textTertiary }]}>Pagos hoy</Text>
                </View>
              </View>
            )}

            {/* Search */}
            <SearchBar
              value={search}
              onSearch={setSearch}
              placeholder="Buscar por cliente o recibo..."
            />
          </>
        }
        ListEmptyComponent={
          loadingPagos ? (
            <LoadingScreen message="Cargando pagos..." />
          ) : (
            <EmptyState
              icon="cash-outline"
              title="Sin pagos registrados"
              subtitle={search ? 'No hay resultados para esta búsqueda' : 'Aún no se han registrado pagos'}
            />
          )
        }
        renderItem={renderPagoCard}
      />

      {/* Pago Detail Modal */}
      <Modal
        visible={!!selectedPagoId}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPagoId(null)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalCard, { backgroundColor: colors.surfaceElevated }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Detalle del Pago</Text>
              <Pressable onPress={() => setSelectedPagoId(null)} hitSlop={8}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            {loadingDetalle ? (
              <LoadingScreen message="Cargando..." />
            ) : pagoDetalle ? (
              <View style={styles.modalBody}>
                <View style={styles.reciboField}>
                  <Text style={[styles.reciboFieldLabel, { color: colors.textTertiary }]}>Recibo #</Text>
                  <Text style={[styles.reciboFieldValue, { color: colors.text }]}>
                    {pagoDetalle?.pago?.id?.slice(-8).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.reciboField}>
                  <Text style={[styles.reciboFieldLabel, { color: colors.textTertiary }]}>Fecha</Text>
                  <Text style={[styles.reciboFieldValue, { color: colors.text }]}>
                    {formatDateTime(pagoDetalle?.pago?.createdAt)}
                  </Text>
                </View>

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                <View style={styles.reciboField}>
                  <Text style={[styles.reciboFieldLabel, { color: colors.textTertiary }]}>Cliente</Text>
                  <Text style={[styles.reciboFieldValue, { color: colors.text }]}>
                    {pagoDetalle?.cliente?.nombre} {pagoDetalle?.cliente?.apellido || ''}
                  </Text>
                </View>
                <View style={styles.reciboField}>
                  <Text style={[styles.reciboFieldLabel, { color: colors.textTertiary }]}>Cédula</Text>
                  <Text style={[styles.reciboFieldValue, { color: colors.text }]}>
                    {pagoDetalle?.cliente?.cedula}
                  </Text>
                </View>

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                <View style={styles.reciboGrid}>
                  <View style={styles.reciboGridItem}>
                    <Text style={[styles.reciboGridLabel, { color: colors.textTertiary }]}>Capital</Text>
                    <Text style={[styles.reciboGridValue, { color: colors.text }]}>
                      {formatCurrency(pagoDetalle?.pago?.capital || 0)}
                    </Text>
                  </View>
                  <View style={styles.reciboGridItem}>
                    <Text style={[styles.reciboGridLabel, { color: colors.textTertiary }]}>Interés</Text>
                    <Text style={[styles.reciboGridValue, { color: colors.warning }]}>
                      {formatCurrency(pagoDetalle?.pago?.interes || 0)}
                    </Text>
                  </View>
                  <View style={styles.reciboGridItem}>
                    <Text style={[styles.reciboGridLabel, { color: colors.textTertiary }]}>Mora</Text>
                    <Text style={[styles.reciboGridValue, { color: colors.error }]}>
                      {formatCurrency(pagoDetalle?.pago?.mora || 0)}
                    </Text>
                  </View>
                </View>

                <View style={[styles.totalRow, { backgroundColor: colors.primaryLight }]}>
                  <Text style={[styles.totalLabel, { color: colors.primary }]}>Total</Text>
                  <Text style={[styles.totalValue, { color: colors.primary }]}>
                    {formatCurrency(pagoDetalle?.pago?.montoTotal || 0)}
                  </Text>
                </View>

                <View style={styles.reciboField}>
                  <Text style={[styles.reciboFieldLabel, { color: colors.textTertiary }]}>Método</Text>
                  <Text style={[styles.reciboFieldValue, { color: colors.text }]}>
                    {METODO_PAGO_LABELS[pagoDetalle?.pago?.metodo] || pagoDetalle?.pago?.metodo}
                  </Text>
                </View>

                <View style={styles.reciboField}>
                  <Text style={[styles.reciboFieldLabel, { color: colors.textTertiary }]}>Registrado por</Text>
                  <Text style={[styles.reciboFieldValue, { color: colors.text }]}>
                    {pagoDetalle?.usuario?.nombre || 'Sistema'}
                  </Text>
                </View>

                <View style={{ gap: Spacing.sm, marginTop: Spacing.md }}>
                  <AppButton
                    title="Reimprimir"
                    onPress={async () => {
                      if (!pagoDetalle) return;
                      try {
                        await guardarReciboPDF(pagoDetalle);
                        showToast(`PDF guardado: recibo_${(pagoDetalle?.pago?.id?.slice(-8) ?? '').toUpperCase()}.pdf`, 'success');
                      } catch (err: any) {
                        showToast(err?.message || 'Error al generar PDF', 'error');
                      }
                    }}
                    variant="secondary"
                    icon="download-outline"
                  />
                  <AppButton
                    title="Cerrar"
                    onPress={() => setSelectedPagoId(null)}
                    variant="ghost"
                  />
                </View>
              </View>
            ) : (
              <View style={styles.modalBody}>
                <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No se encontró el pago</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = {
  screen: { flex: 1 },
  listContent: { padding: Spacing.md, paddingBottom: Spacing.xxl } as AppStyles,
  resumenRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  } as AppStyles,
  resumenCard: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    alignItems: 'center',
  } as AppStyles,
  resumenValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  resumenLabel: { fontSize: FontSize.xs, marginTop: 2 },
  pagoCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  } as AppStyles,
  pagoCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  } as AppStyles,
  pagoCliente: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  pagoDate: { fontSize: FontSize.xs, marginTop: 1 },
  pagoMetodoBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  } as AppStyles,
  pagoMetodoText: { fontSize: 10, fontWeight: FontWeight.bold },
  pagoCardBody: {
    flexDirection: 'row',
    gap: Spacing.xs,
  } as AppStyles,
  pagoAmounts: { flex: 1, alignItems: 'center' } as AppStyles,
  pagoAmountLabel: { fontSize: 9 },
  pagoAmountValue: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, marginTop: 1 },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  } as AppStyles,
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  } as AppStyles,
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  } as AppStyles,
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  modalBody: { padding: Spacing.md },
  reciboField: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  } as AppStyles,
  reciboFieldLabel: { fontSize: FontSize.xs, flex: 1 },
  reciboFieldValue: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, flex: 2, textAlign: 'right' },
  divider: { height: 1, marginVertical: Spacing.md } as AppStyles,
  reciboGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  } as AppStyles,
  reciboGridItem: { flex: 1, alignItems: 'center' } as AppStyles,
  reciboGridLabel: { fontSize: FontSize.xs, marginBottom: 2 },
  reciboGridValue: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  } as AppStyles,
  totalLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  totalValue: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  emptyText: { textAlign: 'center', paddingVertical: Spacing.xl },
} as const;
