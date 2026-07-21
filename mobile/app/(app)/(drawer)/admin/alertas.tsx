import { useCallback, useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';

import { FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { useAlertas, useContarAlertas, useMarcarLeida, useMarcarTodasLeidas } from '@/hooks/use-alertas';
import type { TipoAlerta, Alerta } from '@/types/prestamo.types';
import { Skeleton } from '@/components/ui/skeleton';
import SearchBar from '@/components/ui/search-bar';
import EmptyState from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { useTheme } from '@/components/ui/theme-provider';

import { AlertaCard, AlertaDateGroup, AlertaDetailModal } from '@/components/alertas';

const TIPO_OPTIONS: { label: string; value: TipoAlerta | 'Todas' }[] = [
  { label: 'Todas', value: 'Todas' },
  { label: 'Solicitud', value: 'SOLICITUD' },
  { label: 'Estado', value: 'CAMBIO_ESTADO' },
  { label: 'Refinanc.', value: 'REFINANCIAMIENTO' },
  { label: 'Cancel.', value: 'CANCELACION' },
  { label: 'Cambio tasa', value: 'CAMBIO_TASA' },
  { label: 'Cambio cuotas', value: 'CAMBIO_CUOTAS' },
  { label: 'Cambio freq', value: 'CAMBIO_FRECUENCIA' },
  { label: 'Cambio fecha', value: 'CAMBIO_FECHA_PAGO' },
];

const LEIDA_OPTIONS = [
  { label: 'Todas', value: 'todas' as const },
  { label: 'No leídas', value: 'noLeidas' as const },
  { label: 'Leídas', value: 'leidas' as const },
];

const ALERTA_COLORS: Record<TipoAlerta, string> = {
  SOLICITUD: '#0EA5E9',
  REFINANCIAMIENTO: '#8B5CF6',
  CAMBIO_FRECUENCIA: '#F59E0B',
  CAMBIO_TASA: '#3B82F6',
  CAMBIO_CUOTAS: '#10B981',
  CAMBIO_FECHA_PAGO: '#EC4899',
  CANCELACION: '#EF4444',
  CAMBIO_ESTADO: '#6366F1',
};

function getDateRange(mode: '7d' | 'today', offset: number) {
  const now = new Date();
  if (mode === 'today') {
    const day = new Date(now);
    day.setDate(day.getDate() + offset);
    const s = day.toISOString().split('T')[0];
    return { desde: s, hasta: s };
  }
  const hasta = new Date(now);
  hasta.setDate(hasta.getDate() + offset);
  const desde = new Date(hasta);
  desde.setDate(desde.getDate() - 6);
  return { desde: desde.toISOString().split('T')[0], hasta: hasta.toISOString().split('T')[0] };
}

function rangeLabel(mode: '7d' | 'today', offset: number) {
  const { desde, hasta } = getDateRange(mode, offset);
  if (mode === 'today') {
    const d = new Date(hasta);
    const hoy = new Date();
    if (d.toDateString() === hoy.toDateString()) return 'Hoy';
    if (d.toDateString() === new Date(hoy.getTime() - 86400000).toDateString()) return 'Ayer';
    return d.toLocaleDateString('es-DO', { day: '2-digit', month: 'short' });
  }
  if (offset === 0) return 'Últimos 7 días';
  return `${desde} – ${hasta}`;
}

function groupAlertasByDate(alertas: Alerta[]): { title: string; count: number; data: Alerta[] }[] {
  const groups = new Map<string, Alerta[]>();

  for (const a of alertas) {
    const d = new Date(a.createdAt);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);

    let key: string;
    if (d.toDateString() === now.toDateString()) {
      key = 'Hoy';
    } else if (d.toDateString() === new Date(now.getTime() - 86400000).toDateString()) {
      key = 'Ayer';
    } else if (diffDays < 7) {
      key = 'Esta semana';
    } else {
      key = d.toLocaleDateString('es-DO', { month: 'long', year: 'numeric' });
    }

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(a);
  }

  const order = ['Hoy', 'Ayer', 'Esta semana'];
  return Array.from(groups.entries())
    .sort(([a], [b]) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return b.localeCompare(a);
    })
    .map(([title, data]) => ({ title, count: data.length, data }));
}

export default function AlertasScreen() {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const router = useRouter();

  const [fechaMode, setFechaMode] = useState<'7d' | 'today'>('7d');
  const [offset, setOffset] = useState(0);
  const [tipoFiltro, setTipoFiltro] = useState<TipoAlerta | 'Todas'>('Todas');
  const [leidaFiltro, setLeidaFiltro] = useState<'todas' | 'noLeidas' | 'leidas'>('todas');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAlerta, setSelectedAlerta] = useState<Alerta | null>(null);

  const dateRange = useMemo(() => getDateRange(fechaMode, offset), [fechaMode, offset]);

  const { data: alertas, isLoading, isError, refetch, isRefetching } = useAlertas(dateRange);
  const { data: contador } = useContarAlertas();
  const marcarLeidaMutation = useMarcarLeida();
  const marcarTodasMutation = useMarcarTodasLeidas();

  const alertasFiltrados = useMemo(() => {
    if (!alertas) return [];
    const q = searchQuery.toLowerCase().trim();
    return alertas.filter((a) => {
      const matchTipo = tipoFiltro === 'Todas' || a.tipo === tipoFiltro;
      const matchLeida =
        leidaFiltro === 'todas' ||
        (leidaFiltro === 'noLeidas' && !a.leida) ||
        (leidaFiltro === 'leidas' && a.leida);
      const matchSearch =
        !q ||
        a.clienteNombre.toLowerCase().includes(q) ||
        a.descripcion.toLowerCase().includes(q) ||
        (a.usuarioNombre && a.usuarioNombre.toLowerCase().includes(q));
      return matchTipo && matchLeida && matchSearch;
    });
  }, [alertas, tipoFiltro, leidaFiltro, searchQuery]);

  const sections = useMemo(() => groupAlertasByDate(alertasFiltrados), [alertasFiltrados]);

  const noLeidas = useMemo(() => {
    if (!alertas) return 0;
    return alertas.filter((a) => !a.leida).length;
  }, [alertas]);

  const stats = useMemo(() => {
    if (!alertas) return { total: 0, noLeidas: 0, leidas: 0 };
    const nl = alertas.filter((a) => !a.leida).length;
    return { total: alertas.length, noLeidas: nl, leidas: alertas.length - nl };
  }, [alertas]);

  const handlePress = useCallback(
    (alerta: Alerta) => {
      setSelectedAlerta(alerta);
      if (!alerta.leida) {
        marcarLeidaMutation.mutate(alerta.id, {
          onError: () => showToast('Error al marcar como leída', 'error'),
        });
      }
    },
    [marcarLeidaMutation, showToast],
  );

  const handleMarkRead = useCallback(
    (alerta: Alerta) => {
      if (alerta.leida) return;
      marcarLeidaMutation.mutate(alerta.id, {
        onSuccess: () => {
          setSelectedAlerta(null);
        },
        onError: () => showToast('Error al marcar como leída', 'error'),
      });
    },
    [marcarLeidaMutation, showToast],
  );

  const handleMarcarTodas = useCallback(() => {
    marcarTodasMutation.mutate(undefined, {
      onSuccess: () => showToast('Todas las alertas marcadas como leídas', 'success'),
      onError: () => showToast('Error al marcar alertas', 'error'),
    });
  }, [marcarTodasMutation, showToast]);

  const handleGoToLoan = useCallback(
    (prestamoId: string) => {
      setSelectedAlerta(null);
      router.push(`/(app)/(drawer)/(tabs)/prestamos/${prestamoId}`);
    },
    [router],
  );

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.content}>
          <Skeleton height={48} style={{ marginBottom: Spacing.md }} />
          <Skeleton height={72} style={{ marginBottom: Spacing.md }} />
          <Skeleton height={44} style={{ marginBottom: Spacing.md }} />
          <Skeleton height={100} style={{ marginBottom: Spacing.sm }} />
          <Skeleton height={100} style={{ marginBottom: Spacing.sm }} />
          <Skeleton height={100} />
        </View>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <EmptyState
          title="Error al cargar alertas"
          subtitle="Ocurrió un problema al conectar con el servidor"
          icon="cloud-offline-outline"
          actionLabel="Reintentar"
          onAction={() => refetch()}
        />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={[styles.container, { backgroundColor: colors.background }]}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <AlertaCard
            alerta={item}
            onPress={handlePress}
            onMarkRead={handleMarkRead}
            onGoToLoan={handleGoToLoan}
          />
        )}
        renderSectionHeader={({ section }) => (
          <AlertaDateGroup title={section.title} count={section.count} />
        )}
        refreshing={isRefetching}
        onRefresh={refetch}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <View>
            <SearchBar
              value={searchQuery}
              onSearch={setSearchQuery}
              placeholder="Buscar por cliente, descripción..."
            />

            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={[styles.statCard, { backgroundColor: colors.primaryLight }]}>
                <Text style={[styles.statNumber, { color: colors.primary }]}>{stats.total}</Text>
                <Text style={[styles.statLabel, { color: colors.primary }]}>Total</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.warningLight }]}>
                <Text style={[styles.statNumber, { color: colors.warning }]}>{(contador ?? stats.noLeidas)}</Text>
                <Text style={[styles.statLabel, { color: colors.warning }]}>No leídas</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.successLight }]}>
                <Text style={[styles.statNumber, { color: colors.success }]}>{stats.leidas}</Text>
                <Text style={[styles.statLabel, { color: colors.success }]}>Leídas</Text>
              </View>
            </View>

            {/* Simplified filters: 2 rows */}
            <View style={styles.filtersRow}>
              <View style={styles.leidaRow}>
                {LEIDA_OPTIONS.map((opt) => {
                  const isSelected = leidaFiltro === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => setLeidaFiltro(opt.value)}
                      style={[
                        styles.leidaOption,
                        {
                          backgroundColor: isSelected ? colors.primary : 'transparent',
                          borderColor: isSelected ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.leidaText, { color: isSelected ? '#FFFFFF' : colors.textSecondary }]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.dateRow}>
                <Pressable onPress={() => setOffset((p) => p - (fechaMode === 'today' ? 1 : 7))} hitSlop={8}>
                  <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
                </Pressable>
                <Pressable
                  onPress={() => {
                    setFechaMode((p) => (p === '7d' ? 'today' : '7d'));
                    setOffset(0);
                  }}
                  style={[styles.dateToggle, { borderColor: colors.border }]}
                >
                  <Text style={[styles.dateLabel, { color: colors.text }]}>
                    {rangeLabel(fechaMode, offset)}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color={colors.textTertiary} />
                </Pressable>
                <Pressable onPress={() => setOffset((p) => p + (fechaMode === 'today' ? 1 : 7))} hitSlop={8}>
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                </Pressable>
              </View>
            </View>

            {/* Tipo chips */}
            <View style={styles.chipsContainer}>
              {TIPO_OPTIONS.map((item) => {
                const isSelected = tipoFiltro === item.value;
                const chipColor = item.value === 'Todas' ? colors.primary : ALERTA_COLORS[item.value];
                return (
                  <Pressable
                    key={item.value}
                    onPress={() => setTipoFiltro(item.value)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: isSelected ? chipColor + '20' : colors.surfaceElevated,
                        borderColor: isSelected ? chipColor : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: isSelected ? chipColor : colors.textSecondary }]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {noLeidas > 0 && (
              <Pressable
                onPress={handleMarcarTodas}
                style={styles.markAllBtn}
                disabled={marcarTodasMutation.isPending}
              >
                <Ionicons name="checkmark-done-outline" size={16} color={colors.primary} />
                <Text style={[styles.markAllText, { color: colors.primary }]}>
                  Marcar todas leídas ({noLeidas})
                </Text>
              </Pressable>
            )}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title="Sin resultados"
            subtitle={
              tipoFiltro !== 'Todas' || leidaFiltro !== 'todas' || searchQuery
                ? 'No hay alertas con los filtros seleccionados'
                : 'No hay alertas en este período'
            }
            icon="notifications-off-outline"
          />
        }
      />

      <AlertaDetailModal
        visible={!!selectedAlerta}
        alerta={selectedAlerta}
        onClose={() => setSelectedAlerta(null)}
        onMarkRead={handleMarkRead}
        onGoToLoan={handleGoToLoan}
        isMarkingRead={marcarLeidaMutation.isPending}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: Spacing.xxl,
    paddingTop: Spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  statCard: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
  },
  statLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    marginTop: 2,
  },
  filtersRow: {
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  leidaRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  leidaOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  leidaText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  dateToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  dateLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm - 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  chipText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginHorizontal: Spacing.md,
  },
  markAllText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
});
