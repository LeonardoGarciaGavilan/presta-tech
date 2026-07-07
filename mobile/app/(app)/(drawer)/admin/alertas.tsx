import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useAlertas,
  useContarAlertas,
  useMarcarLeida,
  useMarcarTodasLeidas } from '@/hooks/use-alertas';
import type { TipoAlerta, Alerta } from '@/types/prestamo.types';
import { Skeleton } from '@/components/ui/skeleton';
import { AppButton } from '@/components/ui/app-button';
import { useToast } from '@/components/ui/toast';
import { useTheme } from '@/components/ui/theme-provider';

const TIPO_OPTIONS: { label: string; value: TipoAlerta | 'Todas' }[] = [
  { label: 'Todas', value: 'Todas' },
  { label: 'Refinanciamiento', value: 'REFINANCIAMIENTO' },
  { label: 'Cambio frecuencia', value: 'CAMBIO_FRECUENCIA' },
  { label: 'Cambio tasa', value: 'CAMBIO_TASA' },
  { label: 'Cambio cuotas', value: 'CAMBIO_CUOTAS' },
  { label: 'Cambio fecha', value: 'CAMBIO_FECHA_PAGO' },
  { label: 'Cancelación', value: 'CANCELACION' },
  { label: 'Cambio estado', value: 'CAMBIO_ESTADO' },
];

const ALERTA_COLORS: Record<TipoAlerta, string> = {
  REFINANCIAMIENTO: '#8B5CF6',
  CAMBIO_FRECUENCIA: '#F59E0B',
  CAMBIO_TASA: '#3B82F6',
  CAMBIO_CUOTAS: '#10B981',
  CAMBIO_FECHA_PAGO: '#EC4899',
  CANCELACION: '#EF4444',
  CAMBIO_ESTADO: '#6366F1',
};

const ALERTA_ICONS: Record<TipoAlerta, keyof typeof Ionicons.glyphMap> = {
  REFINANCIAMIENTO: 'git-network-outline',
  CAMBIO_FRECUENCIA: 'swap-horizontal-outline',
  CAMBIO_TASA: 'options-outline',
  CAMBIO_CUOTAS: 'grid-outline',
  CAMBIO_FECHA_PAGO: 'calendar-outline',
  CANCELACION: 'close-circle-outline',
  CAMBIO_ESTADO: 'shuffle-outline',
};

const LEIDA_OPTIONS = [
  { label: 'Todas', value: 'todas' as const },
  { label: 'No leídas', value: 'noLeidas' as const },
  { label: 'Leídas', value: 'leidas' as const },
];

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Ahora';
  if (diffMins < 60) return `Hace ${diffMins}min`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays < 7) return `Hace ${diffDays}d`;

  const isThisYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString('es-DO', {
    day: '2-digit',
    month: 'short',
    ...(isThisYear ? {} : { year: 'numeric' }),
  });
}

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

export default function AlertasScreen() {
  const { colorScheme, colors } = useTheme();
  const { showToast } = useToast();

  const [fechaMode, setFechaMode] = useState<'7d' | 'today'>('7d');
  const [offset, setOffset] = useState(0);
  const [tipoFiltro, setTipoFiltro] = useState<TipoAlerta | 'Todas'>('Todas');
  const [leidaFiltro, setLeidaFiltro] = useState<'todas' | 'noLeidas' | 'leidas'>('todas');

  const dateRange = useMemo(() => getDateRange(fechaMode, offset), [fechaMode, offset]);

  const { data: alertas, isLoading, refetch, isRefetching } = useAlertas(dateRange);
  const { data: contador } = useContarAlertas();
  const marcarLeidaMutation = useMarcarLeida();
  const marcarTodasMutation = useMarcarTodasLeidas();

  const alertasFiltrados = useMemo(() => {
    if (!alertas) return [];
    return alertas.filter((a) => {
      const matchTipo = tipoFiltro === 'Todas' || a.tipo === tipoFiltro;
      const matchLeida =
        leidaFiltro === 'todas' ||
        (leidaFiltro === 'noLeidas' && !a.leida) ||
        (leidaFiltro === 'leidas' && a.leida);
      return matchTipo && matchLeida;
    });
  }, [alertas, tipoFiltro, leidaFiltro]);

  const noLeidas = useMemo(() => {
    if (!alertas) return 0;
    return alertas.filter((a) => !a.leida).length;
  }, [alertas]);

  const stats = useMemo(() => {
    if (!alertas) return { total: 0, noLeidas: 0, leidas: 0 };
    const nl = alertas.filter((a) => !a.leida).length;
    return { total: alertas.length, noLeidas: nl, leidas: alertas.length - nl };
  }, [alertas]);

  const handleMarcarLeida = useCallback(
    (alerta: Alerta) => {
      if (alerta.leida) return;
      marcarLeidaMutation.mutate(alerta.id, {
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

  const renderAlerta = useCallback(
    ({ item }: { item: Alerta }) => {
      const isUnread = !item.leida;
      const tipoColor = ALERTA_COLORS[item.tipo];
      const icon = ALERTA_ICONS[item.tipo];

      return (
        <Pressable
          onPress={() => handleMarcarLeida(item)}
          style={({ pressed }) => [
            styles.alertaCard,
            {
              backgroundColor: isUnread ? colors.surface : colors.surfaceElevated,
              borderColor: isUnread ? tipoColor + '30' : colors.border,
              opacity: pressed ? 0.85 : 1,
            },
            isUnread && { borderLeftWidth: 3, borderLeftColor: tipoColor },
          ]}
        >
          <View style={styles.alertaTop}>
            <View style={[styles.alertaIcon, { backgroundColor: tipoColor + '18' }]}>
              <Ionicons name={icon} size={20} color={tipoColor} />
            </View>
            <View style={styles.alertaInfo}>
              <Text
                style={[
                  styles.alertaCliente,
                  { color: colors.text, fontWeight: isUnread ? FontWeight.semibold : FontWeight.medium },
                ]}
                numberOfLines={1}
              >
                {item.clienteNombre}
              </Text>
              <Text
                style={[styles.alertaDesc, { color: isUnread ? colors.textSecondary : colors.textTertiary }]}
                numberOfLines={2}
              >
                {item.descripcion}
              </Text>
            </View>
            {isUnread && <View style={[styles.unreadDot, { backgroundColor: tipoColor }]} />}
          </View>

          <View style={styles.alertaBottom}>
            <Text style={[styles.alertaMeta, { color: colors.textTertiary }]}>
              {item.usuarioNombre !== 'Sistema' ? item.usuarioNombre : ''}
              {item.usuarioNombre !== 'Sistema' ? ' · ' : ''}
              {formatDate(item.createdAt)}
            </Text>
            <View style={[styles.tipoBadge, { backgroundColor: tipoColor + '18' }]}>
              <Text style={[styles.tipoBadgeText, { color: tipoColor }]}>
                {item.tipo.replace('_', ' ')}
              </Text>
            </View>
          </View>
        </Pressable>
      );
    },
    [colors, handleMarcarLeida],
  );

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.content}>
          <Skeleton height={72} style={{ marginBottom: Spacing.md }} />
          <Skeleton height={44} style={{ marginBottom: Spacing.md }} />
          <Skeleton height={100} style={{ marginBottom: Spacing.sm }} />
          <Skeleton height={100} style={{ marginBottom: Spacing.sm }} />
          <Skeleton height={100} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={alertasFiltrados}
        keyExtractor={(item) => item.id}
        renderItem={renderAlerta}
        refreshing={isRefetching}
        onRefresh={refetch}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
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

            {/* Date filter */}
            <View style={[styles.filterSection, { backgroundColor: colors.background }]}>
              <View style={styles.dateRow}>
                <Pressable onPress={() => setOffset((p) => p - (fechaMode === 'today' ? 1 : 7))} hitSlop={8}>
                  <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (fechaMode === '7d') setFechaMode('today');
                    else setFechaMode('7d');
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

              {/* Tipo chips */}
              <FlatList
                horizontal
                data={TIPO_OPTIONS}
                keyExtractor={(item) => item.value}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsContainer}
                renderItem={({ item }) => {
                  const isSelected = tipoFiltro === item.value;
                  const chipColor = item.value === 'Todas' ? colors.primary : ALERTA_COLORS[item.value];
                  return (
                    <Pressable
                      onPress={() => setTipoFiltro(item.value)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: isSelected ? chipColor + '20' : colors.surfaceElevated,
                          borderColor: isSelected ? chipColor : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: isSelected ? chipColor : colors.textSecondary },
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                }}
              />

              {/* Leída filter */}
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
                      <Text
                        style={[
                          styles.leidaText,
                          { color: isSelected ? '#FFFFFF' : colors.textSecondary },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Marcar todas */}
              {noLeidas > 0 && (
                <AppButton
                  title={`Marcar todas como leídas (${noLeidas})`}
                  onPress={handleMarcarTodas}
                  loading={marcarTodasMutation.isPending}
                  variant="ghost"
                  icon="checkmark-done-outline"
                  style={{ marginTop: Spacing.xs }}
                />
              )}
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
              {tipoFiltro !== 'Todas' || leidaFiltro !== 'todas'
                ? 'No hay alertas con los filtros seleccionados'
                : 'No hay alertas en este período'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
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
  filterSection: {
    paddingBottom: Spacing.md,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
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
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  chipText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  leidaRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
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
  alertaCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  alertaTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  alertaIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertaInfo: {
    flex: 1,
  },
  alertaCliente: {
    fontSize: FontSize.md,
    marginBottom: 2,
  },
  alertaDesc: {
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
  },
  alertaBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'transparent',
  },
  alertaMeta: {
    fontSize: FontSize.xs,
    flex: 1,
  },
  tipoBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  tipoBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    textTransform: 'capitalize',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl * 2,
    gap: Spacing.sm,
  },
  emptyText: {
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
});
