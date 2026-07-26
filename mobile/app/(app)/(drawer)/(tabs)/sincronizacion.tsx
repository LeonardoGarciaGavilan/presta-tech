import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/components/ui/theme-provider';
import { useNetworkContext } from '@/components/providers/network-provider';
import { getQueue, clearQueue } from '@/db/offline-queue-db';
import type { OfflineQueueItem } from '@/types/offline.types';
import { useQueryClient } from '@tanstack/react-query';
import { FontSize, FontWeight, Spacing, BorderRadius, Shadows, scale } from '@/constants/theme';
import ConfirmDialog from '@/components/ui/confirm-dialog';

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Ahora mismo';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days}d`;
}

function getModuleIcon(endpoint: string): keyof typeof Ionicons.glyphMap {
  if (endpoint.includes('/pagos')) return 'cash-outline';
  if (endpoint.includes('/caja')) return 'wallet-outline';
  if (endpoint.includes('/prestamos')) return 'trending-up-outline';
  if (endpoint.includes('/clientes')) return 'people-outline';
  if (endpoint.includes('/rutas')) return 'map-outline';
  return 'document-text-outline';
}

function getModuleLabel(endpoint: string): string {
  if (endpoint.includes('/pagos/saldar')) return 'Saldar préstamo';
  if (endpoint.includes('/pagos')) return 'Pago';
  if (endpoint.includes('/caja/abrir')) return 'Abrir caja';
  if (endpoint.includes('/caja') && endpoint.includes('/cerrar')) return 'Cerrar caja';
  if (endpoint.includes('/prestamos') && endpoint.includes('/refinanciar')) return 'Refinanciar';
  if (endpoint.includes('/prestamos') && endpoint.includes('/cancelar')) return 'Cancelar préstamo';
  if (endpoint.includes('/prestamos') && endpoint.includes('/estado')) return 'Cambiar estado';
  if (endpoint.includes('/prestamos') && endpoint.includes('/desembolsar')) return 'Desembolso';
  if (endpoint.includes('/prestamos')) return 'Préstamo';
  if (endpoint.includes('/clientes') && endpoint.includes('/reactivar')) return 'Reactivar cliente';
  if (endpoint.includes('/clientes')) return 'Cliente';
  if (endpoint.includes('/rutas') && endpoint.includes('/visita')) return 'Marcar visita';
  if (endpoint.includes('/rutas') && endpoint.includes('/reset')) return 'Reset visitas';
  if (endpoint.includes('/rutas') && endpoint.includes('/generar')) return 'Generar día';
  if (endpoint.includes('/rutas')) return 'Ruta';
  return 'Operación';
}

function getDisplayText(item: OfflineQueueItem): string {
  const data = item.tempDisplay || item.data;
  if (!data || typeof data !== 'object') return '';

  const entries = Object.entries(data as Record<string, unknown>);
  if (entries.length === 0) return '';

  return entries
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => {
      const label = {
        montoInicial: 'Monto',
        montoPagado: 'Monto',
        monto: 'Monto',
        metodo: 'Método',
        clienteNombre: 'Cliente',
        nombre: 'Nombre',
        cedula: 'Cédula',
        prestamoId: 'Préstamo',
        rutaId: 'Ruta',
        fecha: 'Fecha',
        visitado: 'Visita',
        accion: 'Acción',
        nuevoEstado: 'Estado',
        nuevasCuotas: 'Cuotas',
        nuevaTasa: 'Tasa',
        clienteId: 'Cliente',
        cambios: 'Cambios',
        observaciones: 'Obs.',
      }[k] || k;

      if (typeof v === 'boolean') return `${label}: ${v ? 'Sí' : 'No'}`;
      if (Array.isArray(v)) return `${label}: ${v.length} items`;
      if (typeof v === 'object') return `${label}: ...`;
      return `${label}: ${String(v)}`;
    })
    .join(' · ');
}

function getStatusConfig(
  status: OfflineQueueItem['status'],
  colorScheme: 'light' | 'dark',
) {
  const isDark = colorScheme === 'dark';
  switch (status) {
    case 'pending':
      return {
        color: isDark ? '#FCD34D' : '#D97706',
        bgColor: isDark ? '#78350F' : '#FEF3C7',
        label: 'Pendiente',
        icon: 'time-outline' as const,
      };
    case 'syncing':
      return {
        color: isDark ? '#93C5FD' : '#2563EB',
        bgColor: isDark ? '#1E3A5F' : '#DBEAFE',
        label: 'Sincronizando',
        icon: 'sync-outline' as const,
      };
    case 'failed':
      return {
        color: isDark ? '#FCA5A5' : '#DC2626',
        bgColor: isDark ? '#7F1D1D' : '#FEE2E2',
        label: 'Fallido',
        icon: 'alert-circle-outline' as const,
      };
    default:
      return {
        color: isDark ? '#CBD5E1' : '#6B7280',
        bgColor: isDark ? '#334155' : '#F3F4F6',
        label: 'Desconocido',
        icon: 'help-circle-outline' as const,
      };
  }
}

function ConnectionDot({ isOnline }: { isOnline: boolean }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isOnline) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.4,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isOnline, pulseAnim]);

  return (
    <View style={styles.dotContainer}>
      <Animated.View
        style={[
          styles.dotPulse,
          {
            backgroundColor: isOnline ? '#10B981' : '#EF4444',
            opacity: pulseAnim,
            transform: [{ scale: pulseAnim.interpolate({ inputRange: [0.4, 1], outputRange: [1.3, 1] }) }],
          },
        ]}
      />
      <View
        style={[
          styles.dotCore,
          { backgroundColor: isOnline ? '#10B981' : '#EF4444' },
        ]}
      />
    </View>
  );
}

function AnimatedQueueItem({
  item,
  colors,
  colorScheme,
  index,
}: {
  item: OfflineQueueItem;
  colors: ReturnType<typeof useTheme>['colors'];
  colorScheme: 'light' | 'dark';
  index: number;
}) {
  const statusConfig = getStatusConfig(item.status, colorScheme);

  return (
    <View
      style={[
        styles.queueItem,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderLeftColor: statusConfig.color,
          borderLeftWidth: 3,
        },
        Shadows.sm,
      ]}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`${getModuleLabel(item.endpoint)} - ${statusConfig.label}`}
    >
      <View style={styles.itemHeader}>
        <View style={styles.itemModule}>
          <View style={[styles.moduleIconBg, { backgroundColor: statusConfig.bgColor }]}>
            <Ionicons
              name={getModuleIcon(item.endpoint)}
              size={scale(16)}
              color={statusConfig.color}
            />
          </View>
          <Text style={[styles.moduleLabel, { color: colors.text }]}>
            {getModuleLabel(item.endpoint)}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
          <Ionicons name={statusConfig.icon} size={scale(12)} color={statusConfig.color} />
          <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>
            {statusConfig.label}
          </Text>
        </View>
      </View>

      {getDisplayText(item) ? (
        <Text style={[styles.itemDescription, { color: colors.textSecondary }]}>
          {getDisplayText(item)}
        </Text>
      ) : null}

      {item.lastError ? (
        <View style={[styles.errorCard, { backgroundColor: colors.errorLight }]}>
          <Ionicons name="alert-circle" size={scale(14)} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]} numberOfLines={2}>
            {item.lastError}
          </Text>
        </View>
      ) : null}

      <View style={styles.itemFooter}>
        <Text style={[styles.itemTime, { color: colors.textTertiary }]}>
          {timeAgo(item.createdAt)}
        </Text>
        <Text style={[styles.itemEndpoint, { color: colors.textTertiary }]} numberOfLines={1}>
          {item.method} {item.endpoint}
        </Text>
      </View>
    </View>
  );
}

export default function SincronizacionScreen() {
  const { colors, colorScheme } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { network, isSyncing, pendingCount, failedCount, lastSyncAt, triggerSync } = useNetworkContext();
  const [items, setItems] = useState<OfflineQueueItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const pendingItems = items.filter((i) => i.status === 'pending' || i.status === 'syncing');
  const failedItems = items.filter((i) => i.status === 'failed');

  const loadItems = useCallback(async () => {
    const queue = await getQueue();
    setItems(queue);
  }, []);

  useEffect(() => {
    loadItems().finally(() => setLoading(false));
  }, [loadItems, pendingCount, failedCount, isSyncing]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadItems();
    } finally {
      setRefreshing(false);
    }
  }, [loadItems]);

  const handleSync = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    triggerSync();
    setTimeout(loadItems, 1000);
  }, [triggerSync, loadItems]);

  const handleClear = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await clearQueue();
    await loadItems();
    setShowClearConfirm(false);
  }, [loadItems]);

  const handleForceReload = useCallback(async () => {
    if (!network.isOnline) {
      Alert.alert('Sin conexión', 'Necesitas conexión a internet para recargar datos.');
      return;
    }
    Alert.alert(
      'Forzar recarga',
      'Esto descargará todos los datos del servidor. ¿Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Recargar',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            try {
              await queryClient.invalidateQueries();
              Alert.alert('Listo', 'Datos recargados correctamente.');
            } catch {
              Alert.alert('Error', 'No se pudieron recargar los datos.');
            }
          },
        },
      ],
    );
  }, [network.isOnline, queryClient]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Estado de conexión */}
        <View
          style={[
            styles.statusCard,
            { backgroundColor: colors.card, borderColor: colors.border },
            Shadows.sm,
          ]}
          accessible
          accessibilityLabel={network.isOnline ? 'Conectado a internet' : 'Sin conexión a internet'}
          accessibilityRole="summary"
        >
          <View style={styles.statusRow}>
            <View style={styles.statusIndicator}>
              <ConnectionDot isOnline={network.isOnline} />
              <Text style={[styles.statusText, { color: colors.text }]}>
                {network.isOnline ? 'Conectado' : 'Sin conexión'}
              </Text>
            </View>
            {network.connectionType !== 'unknown' && (
              <View style={[styles.connectionBadge, { backgroundColor: colors.surface }]}>
                <Ionicons
                  name={network.connectionType === 'wifi' ? 'wifi-outline' : 'cellular-outline'}
                  size={scale(12)}
                  color={colors.textSecondary}
                />
                <Text style={[styles.connectionType, { color: colors.textSecondary }]}>
                  {network.connectionType}
                </Text>
              </View>
            )}
          </View>

          {lastSyncAt && (
            <View style={[styles.lastSyncRow, { borderTopColor: colors.borderLight }]}>
              <Ionicons name="time-outline" size={scale(12)} color={colors.textTertiary} />
              <Text style={[styles.lastSync, { color: colors.textTertiary }]}>
                Última sincronización: {timeAgo(lastSyncAt)}
              </Text>
            </View>
          )}
        </View>

        {/* Resumen */}
        <View style={styles.summaryRow}>
          <View
            style={[
              styles.summaryCard,
              {
                backgroundColor: colorScheme === 'dark' ? '#78350F' : '#FEF3C7',
                borderColor: colorScheme === 'dark' ? '#92400E' : '#F59E0B',
              },
            ]}
            accessible
            accessibilityRole="summary"
            accessibilityLabel={`${pendingCount} operaciones pendientes`}
          >
            <Ionicons
              name="time-outline"
              size={scale(22)}
              color={colorScheme === 'dark' ? '#FCD34D' : '#D97706'}
            />
            <Text
              style={[
                styles.summaryNumber,
                { color: colorScheme === 'dark' ? '#FCD34D' : '#92400E' },
              ]}
            >
              {pendingCount}
            </Text>
            <Text
              style={[
                styles.summaryLabel,
                { color: colorScheme === 'dark' ? '#FCD34D' : '#92400E' },
              ]}
            >
              Pendientes
            </Text>
          </View>

          <View
            style={[
              styles.summaryCard,
              {
                backgroundColor: colorScheme === 'dark' ? '#7F1D1D' : '#FEE2E2',
                borderColor: colorScheme === 'dark' ? '#991B1B' : '#EF4444',
              },
            ]}
            accessible
            accessibilityRole="summary"
            accessibilityLabel={`${failedCount} operaciones fallidas`}
          >
            <Ionicons
              name="alert-circle-outline"
              size={scale(22)}
              color={colorScheme === 'dark' ? '#FCA5A5' : '#DC2626'}
            />
            <Text
              style={[
                styles.summaryNumber,
                { color: colorScheme === 'dark' ? '#FCA5A5' : '#991B1B' },
              ]}
            >
              {failedCount}
            </Text>
            <Text
              style={[
                styles.summaryLabel,
                { color: colorScheme === 'dark' ? '#FCA5A5' : '#991B1B' },
              ]}
            >
              Fallidos
            </Text>
          </View>
        </View>

        {/* Acciones principales */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: colors.primary },
              Shadows.sm,
            ]}
            onPress={handleSync}
            disabled={isSyncing || (pendingCount === 0 && failedCount === 0)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={isSyncing ? 'Sincronizando' : 'Sincronizar ahora'}
            accessibilityState={{ disabled: isSyncing || (pendingCount === 0 && failedCount === 0) }}
          >
            {isSyncing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="sync-outline" size={scale(18)} color="#FFFFFF" />
            )}
            <Text style={styles.actionButtonText}>
              {isSyncing ? 'Sincronizando...' : 'Sincronizar ahora'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionButtonSecondary,
              { borderColor: colors.border },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowClearConfirm(true);
            }}
            disabled={items.length === 0}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Limpiar cola de operaciones"
            accessibilityState={{ disabled: items.length === 0 }}
          >
            <Ionicons name="trash-outline" size={scale(18)} color={colors.error} />
            <Text style={[styles.actionButtonTextSecondary, { color: colors.error }]}>
              Limpiar cola
            </Text>
          </TouchableOpacity>
        </View>

        {/* Forzar recarga */}
        <TouchableOpacity
          style={[styles.reloadButton, { borderColor: colors.border }]}
          onPress={handleForceReload}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Forzar recarga de datos del servidor"
        >
          <Ionicons name="download-outline" size={scale(16)} color={colors.textSecondary} />
          <Text style={[styles.reloadText, { color: colors.textSecondary }]}>
            Forzar recarga de datos
          </Text>
        </TouchableOpacity>

        {/* Cola de operaciones */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Cola de operaciones
          </Text>

          {loading ? (
            <View style={[styles.emptyState, { backgroundColor: colors.card }]}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Cargando...
              </Text>
            </View>
          ) : items.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: colors.card }, Shadows.sm]}>
              <View style={[styles.emptyIconBg, { backgroundColor: colors.successLight }]}>
                <Ionicons name="checkmark-done-circle" size={scale(40)} color={colors.success} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                Todo sincronizado
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                No hay operaciones pendientes ni fallidas.
              </Text>
            </View>
          ) : (
            <>
              {/* Sección pendientes */}
              {pendingItems.length > 0 && (
                <View style={styles.queueSection}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="time-outline" size={scale(14)} color={colors.warning} />
                    <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                      Pendientes ({pendingItems.length})
                    </Text>
                  </View>
                  {pendingItems.map((item, index) => (
                    <AnimatedQueueItem
                      key={item.id}
                      item={item}
                      colors={colors}
                      colorScheme={colorScheme}
                      index={index}
                    />
                  ))}
                </View>
              )}

              {/* Separador */}
              {pendingItems.length > 0 && failedItems.length > 0 && (
                <View style={styles.divider}>
                  <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                </View>
              )}

              {/* Sección fallidos */}
              {failedItems.length > 0 && (
                <View style={styles.queueSection}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="alert-circle-outline" size={scale(14)} color={colors.error} />
                    <Text style={[styles.sectionLabel, { color: colors.error }]}>
                      Fallidos ({failedItems.length})
                    </Text>
                  </View>
                  {failedItems.map((item, index) => (
                    <AnimatedQueueItem
                      key={item.id}
                      item={item}
                      colors={colors}
                      colorScheme={colorScheme}
                      index={index}
                    />
                  ))}
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={showClearConfirm}
        title="Limpiar cola"
        message="¿Estás seguro? Se eliminarán todas las operaciones pendientes. Estas operaciones NO se sincronizarán con el servidor."
        confirmLabel="Limpiar"
        cancelLabel="Cancelar"
        destructive
        onConfirm={handleClear}
        onCancel={() => setShowClearConfirm(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  statusCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dotContainer: {
    width: scale(14),
    height: scale(14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotCore: {
    width: scale(10),
    height: scale(10),
    borderRadius: scale(5),
    position: 'absolute',
  },
  dotPulse: {
    width: scale(14),
    height: scale(14),
    borderRadius: scale(7),
    position: 'absolute',
  },
  statusText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  connectionType: {
    fontSize: FontSize.xs,
    textTransform: 'capitalize',
    fontWeight: FontWeight.medium,
  },
  lastSyncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.sm,
  },
  lastSync: {
    fontSize: FontSize.xs,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  summaryCard: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  summaryNumber: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
  },
  summaryLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  actionButtonSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  actionButtonTextSecondary: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  reloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  reloadText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.md,
  },
  queueSection: {
    gap: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.xs,
  },
  sectionLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  emptyState: {
    alignItems: 'center',
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  emptyIconBg: {
    width: scale(64),
    height: scale(64),
    borderRadius: scale(32),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
  },
  emptySubtitle: {
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: FontSize.md,
  },
  queueItem: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.xs,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  itemModule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  moduleIconBg: {
    width: scale(28),
    height: scale(28),
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moduleLabel: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    flexShrink: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  statusBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  itemDescription: {
    fontSize: FontSize.sm,
    marginBottom: Spacing.xs,
    lineHeight: scale(18),
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xs,
  },
  errorText: {
    fontSize: FontSize.xs,
    flex: 1,
    lineHeight: scale(16),
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemTime: {
    fontSize: FontSize.xs,
  },
  itemEndpoint: {
    fontSize: FontSize.xs,
    flex: 1,
    textAlign: 'right',
    marginLeft: Spacing.sm,
  },
});
