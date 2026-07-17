import { memo, useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
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
import { PageHeader } from '@/components/ui/page-header';
import { AppButton } from '@/components/ui/app-button';
import LoadingScreen from '@/components/ui/loading-screen';
import EmptyState from '@/components/ui/empty-state';
import { FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { formatCurrency } from '@/utils/formatters';
import { guardarReciboPDF } from '@/utils/recibo-pdf';
import type { ReciboData } from '@/utils/recibo-pdf';
import type { ClienteVistaDia, ResumenVistaDia } from '@/types/rutas.types';
import { useTheme } from '@/components/ui/theme-provider';
import { dateToISO } from '@/utils/formatters';
import CobroRapidoModal from '@/components/rutas/cobro-rapido-modal';
import { DateNavigator } from '@/components/rutas/date-navigator';
import { RutaStatsGrid } from '@/components/rutas/ruta-stats-grid';
import { RutaToolbar } from '@/components/rutas/ruta-toolbar';

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

  const today = dateToISO(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [filter, setFilter] = useState<'todos' | 'pendientes' | 'visitados'>('todos');
  const [sortByCercania, setSortByCercania] = useState(false);

  const [cobroCliente, setCobroCliente] = useState<ClienteVistaDia | null>(null);

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
  }, []);

  const handleProcesarPago = useCallback(async (data: { metodo: 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA' | 'CHEQUE'; referencia?: string }) => {
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
        montoPagado: cobroCliente.totalACobrar,
        metodo: data.metodo,
        referencia: data.referencia,
      });
      await marcarVisitado({ rcId: cobroCliente.rutaClienteId, visitado: true });
      setCobroCliente(null);
      showToast('Pago registrado', 'success');
      refetch();
      guardarReciboPDF(result as ReciboData);
    } catch (err: any) {
      showToast(err?.message || 'Error al procesar pago', 'error');
    }
  }, [cobroCliente, registrarPago, marcarVisitado, showToast, refetch]);

  const navigateDate = useCallback((delta: number) => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    setSelectedDate(dateToISO(d));
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
      <PageHeader title={ruta.nombre} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        nestedScrollEnabled
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={refetch}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <DateNavigator
          selectedDate={selectedDate}
          displayDate={displayDate(selectedDate)}
          colors={colors}
          onNavigate={navigateDate}
          onToday={() => setSelectedDate(today)}
        />

        {resumen && <RutaStatsGrid resumen={resumen} colors={colors} />}

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
            <View style={[styles.progressTrack, { backgroundColor: colors.border }]} accessibilityRole="progressbar" accessibilityValue={{ now: Math.round(progress), min: 0, max: 100 }}>
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

        <RutaToolbar
          filter={filter}
          viewMode={viewMode}
          sortByCercania={sortByCercania}
          colors={colors}
          onFilterChange={setFilter}
          onViewModeChange={() => setViewMode(viewMode === 'list' ? 'map' : 'list')}
          onSortChange={() => setSortByCercania((p) => !p)}
        />

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
                <ClienteCardItemMemo
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

      <CobroRapidoModal
        visible={!!cobroCliente}
        cliente={cobroCliente}
        loading={pagando}
        onClose={() => setCobroCliente(null)}
        onConfirm={handleProcesarPago}
      />
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
      accessibilityRole="summary"
      accessibilityLabel={`Cliente ${cliente.nombre} ${cliente.apellido || ''}, orden ${orden}${visitadoHoy ? ', visitado' : ''}`}
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
          accessibilityRole="checkbox"
          accessibilityState={{ checked: visitadoHoy }}
          accessibilityLabel={visitadoHoy ? 'Desmarcar visita' : 'Marcar como visitado'}
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
          accessibilityRole="button"
          accessibilityLabel={`Ver perfil de ${cliente.nombre} ${cliente.apellido || ''}`}
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
            accessibilityRole="button"
            accessibilityLabel={`Cobrar ${formatCurrency(totalACobrar)} a ${cliente.nombre}`}
          >
            <Ionicons name="cash-outline" size={16} color="#FFF" />
            <Text style={styles.cobrarText}>Cobrar</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const ClienteCardItemMemo = memo(ClienteCardItem);
ClienteCardItemMemo.displayName = 'ClienteCardItem';

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
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
});
