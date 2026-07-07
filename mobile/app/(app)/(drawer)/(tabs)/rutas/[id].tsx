import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useVistaDia,
  useRuta,
  useMarcarVisitado,
  useResetVisitados } from '@/hooks/use-rutas';
import { useRegistrarPago } from '@/hooks/use-pagos';
import { useAuthStore } from '@/store/auth.store';
import { useToast } from '@/components/ui/toast';
import AppMapView from '@/components/clientes/map-view';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import { ScreenContainer } from '@/components/ui/screen-container';
import { AppButton } from '@/components/ui/app-button';
import LoadingScreen from '@/components/ui/loading-screen';
import EmptyState from '@/components/ui/empty-state';
import { SkeletonCard } from '@/components/ui/skeleton';
import { FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { formatCurrency } from '@/utils/formatters';
import { guardarReciboPDF } from '@/utils/recibo-pdf';
import type { ReciboData } from '@/utils/recibo-pdf';
import type { ClienteVistaDia, ResumenVistaDia } from '@/types/rutas.types';
import { useTheme } from '@/components/ui/theme-provider';

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function displayDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('es-DO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function VistaDiaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colorScheme, colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.rol === 'SUPERADMIN' || user?.rol === 'ADMIN';
  const { showToast } = useToast();

  const today = formatDate(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [filter, setFilter] = useState<'todos' | 'pendientes' | 'visitados'>('todos');
  const [sortByCercania, setSortByCercania] = useState(false);

  const [cobroCliente, setCobroCliente] = useState<ClienteVistaDia | null>(null);
  const [pagoMonto, setPagoMonto] = useState('');
  const [pagoMetodo, setPagoMetodo] = useState<'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA' | 'CHEQUE'>('EFECTIVO');
  const [pagoRef, setPagoRef] = useState('');

  const { data: ruta } = useRuta(id ?? '');
  const {
    data: vistaDia,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useVistaDia(id ?? '', selectedDate);

  const { mutateAsync: marcarVisitado, isPending: marcando } = useMarcarVisitado();
  const { mutateAsync: resetVisitados, isPending: reseteando } = useResetVisitados();
  const { mutateAsync: registrarPago, isPending: pagando } = useRegistrarPago();

  const [resetConfirm, setResetConfirm] = useState(false);

  const clientes = useMemo(() => {
    if (!vistaDia?.clientes) return [];
    let items = [...vistaDia.clientes];
    if (sortByCercania) {
      items.sort((a, b) => {
        const la = a.cliente.latitud ?? 0;
        const lb = b.cliente.latitud ?? 0;
        if (la !== lb) return lb - la;
        return (a.cliente.longitud ?? 0) - (b.cliente.longitud ?? 0);
      });
    } else {
      items.sort((a, b) => a.orden - b.orden);
    }
    if (filter === 'pendientes') items = items.filter((c) => !c.visitadoHoy);
    if (filter === 'visitados') items = items.filter((c) => c.visitadoHoy);
    return items;
  }, [vistaDia, filter, sortByCercania]);

  const handleToggleVisita = useCallback(
    async (rcId: string, currentState: boolean) => {
      try {
        await marcarVisitado({ rcId, visitado: !currentState });
        showToast(!currentState ? 'Visitado' : 'Desmarcado', 'success');
      } catch (err: any) {
        showToast(err?.message || 'Error al marcar visita', 'error');
      }
    },
    [marcarVisitado, showToast],
  );

  const handleReset = useCallback(async () => {
    try {
      await resetVisitados();
      showToast('Visitados reseteado', 'success');
      setResetConfirm(false);
    } catch (err: any) {
      showToast(err?.message || 'Error al resetear', 'error');
    }
  }, [resetVisitados, showToast]);

  const handleCobroRapido = useCallback((item: ClienteVistaDia) => {
    setCobroCliente(item);
    setPagoMonto(item.totalACobrar.toFixed(2));
    setPagoMetodo('EFECTIVO');
    setPagoRef('');
  }, []);

  const handleProcesarPago = useCallback(async () => {
    if (!cobroCliente) return;
    const prestamo = cobroCliente.prestamos?.[0];
    if (!prestamo?.proximaCuota) {
      showToast('Sin cuotas pendientes', 'error');
      return;
    }
    try {
      const result = await registrarPago({
        prestamoId: prestamo.id,
        cuotaId: prestamo.proximaCuota.id,
        montoPagado: parseFloat(pagoMonto) || cobroCliente.totalACobrar,
        metodo: pagoMetodo,
        referencia: pagoRef || undefined,
      });
      await marcarVisitado({ rcId: cobroCliente.rutaClienteId, visitado: true });
      setCobroCliente(null);
      showToast('Pago registrado', 'success');
      refetch();
      guardarReciboPDF(result as ReciboData);
    } catch (err: any) {
      showToast(err?.message || 'Error al procesar pago', 'error');
    }
  }, [cobroCliente, pagoMonto, pagoMetodo, pagoRef, registrarPago, marcarVisitado, showToast, refetch]);

  const navigateDate = useCallback((delta: number) => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    setSelectedDate(formatDate(d));
  }, [selectedDate]);

  const resumen: ResumenVistaDia | null = vistaDia?.resumen ?? null;
  const progress = resumen && resumen.totalClientes > 0
    ? (resumen.visitadosHoy / resumen.totalClientes) * 100
    : 0;

  if (isLoading) {
    return <LoadingScreen message="Cargando ruta..." />;
  }

  if (error) {
    return (
      <ScreenContainer>
        <EmptyState
          icon="alert-circle-outline"
          title="Error"
          subtitle={error?.message || 'Error al cargar la ruta'}
          actionLabel="Reintentar"
          onAction={() => refetch()}
        />
      </ScreenContainer>
    );
  }

  if (!vistaDia || !ruta) return null;

  const mapMarkers = vistaDia.clientes
    .filter((c) => c.cliente.latitud && c.cliente.longitud)
    .map((c) => ({
      id: c.rutaClienteId,
      latitude: c.cliente.latitud!,
      longitude: c.cliente.longitud!,
      title: `${c.cliente.nombre} ${c.cliente.apellido || ''}`,
      description: `RD$ ${formatCurrency(c.totalACobrar)}`,
      order: c.orden,
      isVisited: c.visitadoHoy,
      isOverdue: c.tieneAtrasados,
    }));

  return (
    <ScreenContainer>
      <Stack.Screen
        options={{
          headerShown: true,
          title: ruta.nombre,
          headerTintColor: colors.primary,
          headerStyle: { backgroundColor: colors.background },
        }}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={refetch}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Date Navigation */}
        <View style={[styles.dateRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Pressable onPress={() => navigateDate(-1)} hitSlop={8}>
            <Ionicons name="chevron-back" size={20} color={colors.primary} />
          </Pressable>
          <Pressable onPress={() => setSelectedDate(today)}>
            <Text style={[styles.dateText, { color: colors.text }]}>
              {displayDate(selectedDate)}
            </Text>
          </Pressable>
          <Pressable onPress={() => navigateDate(1)} hitSlop={8}>
            <Ionicons name="chevron-forward" size={20} color={colors.primary} />
          </Pressable>
        </View>

        {/* Stats Cards */}
        {resumen && (
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
        )}

        {/* Progress Bar */}
        {resumen && resumen.totalClientes > 0 && (
          <View style={styles.progressSection}>
            <View style={styles.progressLabelRow}>
              <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
                Progreso del día
              </Text>
              <Text style={[styles.progressPct, { color: colors.primary }]}>
                {Math.round(progress)}%
              </Text>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: progress === 100 ? colors.success : colors.primary,
                    width: `${Math.min(progress, 100)}%`,
                  },
                ]}
              />
            </View>
          </View>
        )}

        {/* View Mode Toggle + Filter */}
        <View style={styles.toolbar}>
          <View style={styles.filterRow}>
            {(['todos', 'pendientes', 'visitados'] as const).map((f) => (
              <Pressable
                key={f}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: filter === f ? colors.primaryLight : colors.surface,
                    borderColor: filter === f ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setFilter(f)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: filter === f ? colors.primary : colors.textSecondary },
                  ]}
                >
                  {f === 'todos' ? 'Todos' : f === 'pendientes' ? 'Pendientes' : 'Visitados'}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.toolRight}>
            <Pressable
              style={[styles.viewToggle, {
                backgroundColor: sortByCercania ? colors.primaryLight : colors.surface,
                borderColor: sortByCercania ? colors.primary : colors.border,
              }]}
              onPress={() => setSortByCercania((p) => !p)}
            >
              <Ionicons
                name="navigate-outline"
                size={16}
                color={sortByCercania ? colors.primary : colors.textTertiary}
              />
            </Pressable>
            <Pressable
              style={[styles.viewToggle, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setViewMode(viewMode === 'list' ? 'map' : 'list')}
            >
              <Ionicons
                name={viewMode === 'list' ? 'map-outline' : 'list-outline'}
                size={16}
                color={colors.primary}
              />
            </Pressable>
          </View>
        </View>

        {/* Map View */}
        {viewMode === 'map' && (
          <View style={{ marginBottom: Spacing.md }}>
            {mapMarkers.length > 0 ? (
              <AppMapView
                markers={mapMarkers}
                readOnly
                height={400}
                showPolyline
                fitToMarkers
              />
            ) : (
              <View style={[styles.noMap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="map-outline" size={32} color={colors.textTertiary} />
                <Text style={[styles.noMapText, { color: colors.textTertiary }]}>
                  Sin ubicaciones en esta ruta
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Client List */}
        {viewMode === 'list' && (
          <View style={styles.clientList}>
            {clientes.length === 0 ? (
              <EmptyState
                icon="checkmark-circle-outline"
                title={filter === 'visitados' ? 'Sin visitados' : filter === 'pendientes' ? 'Todo visitado' : 'Sin clientes'}
                subtitle={filter !== 'todos' ? 'Cambia el filtro para ver más' : 'No hay clientes en esta ruta para esta fecha'}
              />
            ) : (
              clientes.map((item) => (
                <ClienteCardItem
                  key={item.rutaClienteId}
                  item={item}
                  colors={colors}
                  onToggleVisita={handleToggleVisita}
                  onCobroRapido={handleCobroRapido}
                  marcando={marcando}
                  isAdmin={isAdmin}
                />
              ))
            )}
          </View>
        )}

        {/* Bottom Actions */}
        {vistaDia && (
          <View style={styles.actions}>
            <AppButton
              title="Generar Día"
              variant="outline"
              icon="calendar-outline"
              onPress={() => router.push(`/rutas/generar-dia/${id}`)}
            />
            {isAdmin && (
              <AppButton
                title="Gestión"
                variant="outline"
                icon="settings-outline"
                onPress={() => router.push(`/rutas/gestion/${id}`)}
              />
            )}
            <AppButton
              title="Reset visitados"
              variant="ghost"
              icon="refresh-outline"
              loading={reseteando}
              onPress={() => setResetConfirm(true)}
            />
          </View>
        )}
      </ScrollView>

      <ConfirmDialog
        visible={resetConfirm}
        title="Resetear visitas"
        message="¿Marcar todos los clientes como NO visitados hoy?"
        confirmLabel="Resetear"
        destructive
        onConfirm={handleReset}
        onCancel={() => setResetConfirm(false)}
      />

      {/* Cobro Rápido Modal */}
      <Modal
        visible={!!cobroCliente}
        transparent
        animationType="slide"
        onRequestClose={() => setCobroCliente(null)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
        <Pressable style={styles.modalOverlay} onPress={() => setCobroCliente(null)}>
          <Pressable style={[styles.cobroModal, { backgroundColor: colors.surfaceElevated }]} onPress={() => {}}>
            <View style={styles.cobroModalHeader}>
              <Text style={[styles.cobroModalTitle, { color: colors.text }]}>Cobro Rápido</Text>
              <Pressable onPress={() => setCobroCliente(null)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>

            {cobroCliente && (
              <>
                <Text style={[styles.cobroClienteName, { color: colors.text }]}>
                  {cobroCliente.cliente.nombre} {cobroCliente.cliente.apellido || ''}
                </Text>
                {cobroCliente.cliente.telefono && (
                  <Text style={[styles.cobroClientePhone, { color: colors.textTertiary }]}>
                    {cobroCliente.cliente.telefono}
                  </Text>
                )}

                {/* Cuotas pendientes */}
                {cobroCliente.prestamos?.map((p) => p.proximaCuota).filter(Boolean).length > 0 && (
                  <View style={styles.cobroCuotasSection}>
                    <Text style={[styles.cobroSectionLabel, { color: colors.textSecondary }]}>Cuotas pendientes</Text>
                    {cobroCliente.prestamos.map((p) => p.proximaCuota && (
                      <View key={p.proximaCuota.id} style={[styles.cobroCuotaRow, { borderColor: colors.border }]}>
                        <Text style={[styles.cobroCuotaNum, { color: colors.text }]}>
                          Cuota #{p.proximaCuota.numero}
                        </Text>
                        <View>
                          <Text style={[styles.cobroCuotaMonto, { color: colors.text }]}>
                            RD$ {formatCurrency(p.proximaCuota.total)}
                          </Text>
                          {p.proximaCuota.mora > 0 && (
                            <Text style={[styles.cobroCuotaMora, { color: colors.error }]}>
                              Mora: RD$ {formatCurrency(p.proximaCuota.mora)}
                            </Text>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Total */}
                <View style={[styles.cobroTotalRow, { borderTopColor: colors.border }]}>
                  <Text style={[styles.cobroTotalLabel, { color: colors.text }]}>Total a cobrar</Text>
                  <Text style={[styles.cobroTotalAmount, { color: colors.primary }]}>
                    RD$ {formatCurrency(cobroCliente.totalACobrar)}
                  </Text>
                </View>

                {/* Payment method selector */}
                <Text style={[styles.cobroSectionLabel, { color: colors.textSecondary }]}>Método de pago</Text>
                <View style={styles.metodoRow}>
                  {(['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'CHEQUE'] as const).map((m) => (
                    <Pressable
                      key={m}
                      style={[styles.metodoChip, {
                        backgroundColor: pagoMetodo === m ? colors.primaryLight : colors.surface,
                        borderColor: pagoMetodo === m ? colors.primary : colors.border,
                      }]}
                      onPress={() => setPagoMetodo(m)}
                    >
                      <Text style={[styles.metodoChipText, {
                        color: pagoMetodo === m ? colors.primary : colors.textSecondary,
                        fontWeight: pagoMetodo === m ? '600' : '400',
                      }]}>
                        {m === 'EFECTIVO' ? 'Efectivo' : m === 'TRANSFERENCIA' ? 'Transferencia' : m === 'TARJETA' ? 'Tarjeta' : 'Cheque'}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {/* Referencia */}
                <TextInput
                  style={[styles.cobroRefInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                  placeholder="Referencia (opcional)"
                  placeholderTextColor={colors.textTertiary}
                  value={pagoRef}
                  onChangeText={setPagoRef}
                />

                {/* Actions */}
                <View style={styles.cobroActions}>
                  <AppButton
                    title="Cancelar"
                    variant="ghost"
                    onPress={() => setCobroCliente(null)}
                  />
                  <AppButton
                    title="Cobrar"
                    loading={pagando}
                    disabled={!cobroCliente.totalACobrar}
                    onPress={handleProcesarPago}
                    icon="cash-outline"
                  />
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenContainer>
  );
}

function ClienteCardItem({
  item,
  colors,
  onToggleVisita,
  onCobroRapido,
  marcando,
  isAdmin,
}: {
  item: ClienteVistaDia;
  colors: any;
  onToggleVisita: (rcId: string, visitadoHoy: boolean) => void;
  onCobroRapido: (item: ClienteVistaDia) => void;
  marcando: boolean;
  isAdmin: boolean;
}) {
  const {
    rutaClienteId,
    orden,
    observacion,
    visitadoHoy,
    cliente,
    debeVisitar,
    tieneAtrasados,
    totalACobrar,
  } = item;

  return (
    <View
      style={[
        styles.clientCard,
        {
          backgroundColor: visitadoHoy ? colors.successLight : colors.surface,
          borderColor: visitadoHoy ? colors.success : colors.border,
          opacity: visitadoHoy ? 0.85 : 1,
        },
      ]}
    >
      {/* Order Badge */}
      <View style={styles.cardRow}>
        <View style={[styles.orderCircle, { backgroundColor: colors.routeBg }]}>
          <Text style={[styles.orderNumber, { color: colors.route }]}>{orden}</Text>
        </View>

        {/* Visit Toggle */}
        <Pressable
          onPress={() => onToggleVisita(rutaClienteId, visitadoHoy)}
          disabled={marcando}
          hitSlop={8}
          style={[styles.visitCheckbox, {
            backgroundColor: visitadoHoy ? colors.success : 'transparent',
            borderColor: visitadoHoy ? colors.success : colors.border,
          }]}
        >
          {visitadoHoy && <Ionicons name="checkmark" size={14} color="#FFF" />}
        </Pressable>

        {/* Client Info */}
        <Pressable
          style={styles.clientInfo}
          onPress={() => router.push(`/clientes/${cliente.id}?from=rutas`)}
        >
          <View style={styles.clientNameRow}>
            <Text style={[styles.clientName, { color: colors.text }]} numberOfLines={1}>
              {cliente.nombre} {cliente.apellido || ''}
            </Text>
            {tieneAtrasados && (
              <View style={[styles.atrasadoBadge, { backgroundColor: colors.errorLight }]}>
                <Text style={[styles.atrasadoText, { color: colors.error }]}>Atrasado</Text>
              </View>
            )}
          </View>
          {cliente.telefono && (
            <Text style={[styles.clientPhone, { color: colors.textTertiary }]}>
              {cliente.telefono}
            </Text>
          )}
          {observacion && (
            <Text style={[styles.clientObs, { color: colors.textSecondary }]} numberOfLines={1}>
              📝 {observacion}
            </Text>
          )}
        </Pressable>
      </View>

      {/* Amount Due + Cobrar */}
      {debeVisitar && (
        <View style={[styles.cobroRow, { borderTopColor: colors.border }]}>
          <View>
            <Text style={[styles.cobroLabel, { color: colors.textTertiary }]}>A cobrar</Text>
            <Text style={[styles.cobroAmount, { color: colors.text }]}>
              RD$ {formatCurrency(totalACobrar)}
            </Text>
          </View>
          <Pressable
            style={[styles.cobrarBtn, { backgroundColor: colors.primary }]}
            onPress={() => onCobroRapido(item)}
          >
            <Ionicons name="cash-outline" size={16} color="#FFF" />
            <Text style={styles.cobrarText}>Cobrar</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  dateText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
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
  progressSection: {
    marginBottom: Spacing.md,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: FontSize.xs,
  },
  progressPct: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    flex: 1,
  },
  filterChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  viewToggle: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clientList: {
    gap: Spacing.sm,
  },
  clientCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  orderCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderNumber: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  visitCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clientInfo: {
    flex: 1,
  },
  clientNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  clientName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    flexShrink: 1,
  },
  atrasadoBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: BorderRadius.sm,
  },
  atrasadoText: {
    fontSize: 9,
    fontWeight: FontWeight.bold,
  },
  clientPhone: {
    fontSize: FontSize.xs,
    marginTop: 1,
  },
  clientObs: {
    fontSize: FontSize.xs,
    marginTop: 1,
    fontStyle: 'italic',
  },
  cobroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  cobroLabel: {
    fontSize: FontSize.xs,
  },
  cobroAmount: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  cobrarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  cobrarText: {
    color: '#FFF',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  toolRight: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  noMap: {
    height: 200,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  noMapText: {
    fontSize: FontSize.sm,
  },
  actions: {
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  cobroModal: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    maxHeight: '80%',
    gap: Spacing.md,
  },
  cobroModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cobroModalTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  cobroClienteName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  cobroClientePhone: {
    fontSize: FontSize.sm,
  },
  cobroCuotasSection: {
    gap: Spacing.xs,
  },
  cobroSectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cobroCuotaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingVertical: Spacing.xs,
  },
  cobroCuotaNum: {
    fontSize: FontSize.sm,
  },
  cobroCuotaMonto: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    textAlign: 'right',
  },
  cobroCuotaMora: {
    fontSize: FontSize.xs,
    textAlign: 'right',
  },
  cobroTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: Spacing.sm,
  },
  cobroTotalLabel: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  cobroTotalAmount: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  metodoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  metodoChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  metodoChipText: {
    fontSize: FontSize.xs,
  },
  cobroRefInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.sm,
  },
  cobroActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
});
