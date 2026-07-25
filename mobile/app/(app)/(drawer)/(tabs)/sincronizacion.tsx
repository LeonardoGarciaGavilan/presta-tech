import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/components/ui/theme-provider';
import { useNetworkContext } from '@/components/providers/network-provider';
import { getQueue, clearQueue } from '@/services/offline-queue';
import { getQueueStats } from '@/services/offline-queue';
import type { OfflineQueueItem } from '@/types/offline.types';
import { useQueryClient } from '@tanstack/react-query';
import { FontSize, FontWeight, Spacing, BorderRadius, scale } from '@/constants/theme';
import ConfirmDialog from '@/components/ui/confirm-dialog';

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Ahora mismo';
  if (minutes < 60) return `Hace ${minutes}m`;
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

function getStatusColor(status: OfflineQueueItem['status']): string {
  switch (status) {
    case 'pending': return '#F59E0B';
    case 'syncing': return '#3B82F6';
    case 'failed': return '#EF4444';
    default: return '#6B7280';
  }
}

function getStatusLabel(status: OfflineQueueItem['status']): string {
  switch (status) {
    case 'pending': return 'Pendiente';
    case 'syncing': return 'Sincronizando';
    case 'failed': return 'Fallido';
    default: return 'Desconocido';
  }
}

export default function SincronizacionScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { network, isSyncing, pendingCount, failedCount, lastSyncAt, triggerSync } = useNetworkContext();
  const [items, setItems] = useState<OfflineQueueItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

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
    triggerSync();
    setTimeout(loadItems, 1000);
  }, [triggerSync, loadItems]);

  const handleClear = useCallback(async () => {
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
          style={[styles.statusCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          accessible
          accessibilityLabel={network.isOnline ? 'Conectado a internet' : 'Sin conexión a internet'}
          accessibilityRole="summary"
        >
          <View style={styles.statusRow}>
            <View style={styles.statusIndicator}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: network.isOnline ? '#10B981' : '#EF4444' },
                ]}
                accessibilityLabel={network.isOnline ? 'En línea' : 'Fuera de línea'}
              />
              <Text style={[styles.statusText, { color: colors.text }]}>
                {network.isOnline ? 'Conectado' : 'Sin conexión'}
              </Text>
            </View>
            <Text style={[styles.connectionType, { color: colors.textSecondary }]}>
              {network.connectionType !== 'unknown' ? network.connectionType : ''}
            </Text>
          </View>

          {lastSyncAt && (
            <Text style={[styles.lastSync, { color: colors.textSecondary }]}>
              Última sincronización: {timeAgo(lastSyncAt)}
            </Text>
          )}
        </View>

        {/* Resumen */}
        <View style={styles.summaryRow}>
          <View
            style={[styles.summaryCard, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}
            accessible
            accessibilityRole="summary"
            accessibilityLabel={`${pendingCount} operaciones pendientes`}
          >
            <Ionicons name="time-outline" size={scale(24)} color="#F59E0B" />
            <Text style={[styles.summaryNumber, { color: '#92400E' }]}>{pendingCount}</Text>
            <Text style={[styles.summaryLabel, { color: '#92400E' }]}>Pendientes</Text>
          </View>

          <View
            style={[styles.summaryCard, { backgroundColor: '#FEE2E2', borderColor: '#EF4444' }]}
            accessible
            accessibilityRole="summary"
            accessibilityLabel={`${failedCount} operaciones fallidas`}
          >
            <Ionicons name="alert-circle-outline" size={scale(24)} color="#EF4444" />
            <Text style={[styles.summaryNumber, { color: '#991B1B' }]}>{failedCount}</Text>
            <Text style={[styles.summaryLabel, { color: '#991B1B' }]}>Fallidos</Text>
          </View>
        </View>

        {/* Acciones */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
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
              <Ionicons name="sync-outline" size={scale(20)} color="#FFFFFF" />
            )}
            <Text style={styles.actionButtonText}>
              {isSyncing ? 'Sincronizando...' : 'Sincronizar ahora'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButtonSecondary, { borderColor: colors.border }]}
            onPress={() => setShowClearConfirm(true)}
            disabled={items.length === 0}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Limpiar cola de operaciones"
            accessibilityState={{ disabled: items.length === 0 }}
          >
            <Ionicons name="trash-outline" size={scale(20)} color={colors.error} />
            <Text style={[styles.actionButtonTextSecondary, { color: colors.error }]}>
              Limpiar cola
            </Text>
          </TouchableOpacity>
        </View>

        {/* Botón de forzar recarga */}
        <TouchableOpacity
          style={[styles.reloadButton, { borderColor: colors.border }]}
          onPress={handleForceReload}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Forzar recarga de datos del servidor"
        >
          <Ionicons name="download-outline" size={scale(20)} color={colors.primary} />
          <Text style={[styles.reloadText, { color: colors.primary }]}>
            Forzar recarga de datos
          </Text>
        </TouchableOpacity>

        {/* Lista de operaciones */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Cola de operaciones ({items.length})
          </Text>

          {loading ? (
            <View style={[styles.emptyState, { backgroundColor: colors.card }]}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Cargando...
              </Text>
            </View>
          ) : items.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: colors.card }]}>
              <Ionicons name="checkmark-circle-outline" size={scale(48)} color="#10B981" />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No hay operaciones pendientes
              </Text>
            </View>
          ) : (
            items.map((item) => (
              <View
                key={item.id}
                style={[styles.queueItem, { backgroundColor: colors.card, borderColor: colors.border }]}
                accessible
                accessibilityRole="summary"
                accessibilityLabel={`${getModuleLabel(item.endpoint)} - ${getStatusLabel(item.status)}`}
              >
                <View style={styles.itemHeader}>
                  <View style={styles.itemModule}>
                    <Ionicons
                      name={getModuleIcon(item.endpoint)}
                      size={scale(20)}
                      color={colors.primary}
                    />
                    <Text style={[styles.moduleLabel, { color: colors.text }]}>
                      {getModuleLabel(item.endpoint)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(item.status) + '20' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        { color: getStatusColor(item.status) },
                      ]}
                    >
                      {getStatusLabel(item.status)}
                    </Text>
                  </View>
                </View>

                {getDisplayText(item) ? (
                  <Text style={[styles.itemDescription, { color: colors.textSecondary }]}>
                    {getDisplayText(item)}
                  </Text>
                ) : null}

                <View style={styles.itemFooter}>
                  <Text style={[styles.itemTime, { color: colors.textTertiary }]}>
                    {timeAgo(item.createdAt)}
                  </Text>
                  <Text style={[styles.itemMethod, { color: colors.textTertiary }]}>
                    {item.method} {item.endpoint}
                  </Text>
                </View>

                {item.lastError && (
                  <Text style={[styles.itemError, { color: colors.error }]}>
                    {item.lastError}
                  </Text>
                )}
              </View>
            ))
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
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  statusDot: {
    width: scale(10),
    height: scale(10),
    borderRadius: scale(5),
  },
  statusText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  connectionType: {
    fontSize: FontSize.sm,
    textTransform: 'capitalize',
  },
  lastSync: {
    fontSize: FontSize.xs,
    marginTop: Spacing.xs,
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
    fontWeight: FontWeight.medium,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
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
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  reloadText: {
    fontSize: FontSize.md,
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
  emptyState: {
    alignItems: 'center',
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: FontSize.md,
  },
  queueItem: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
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
  },
  moduleLabel: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  statusBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  itemDescription: {
    fontSize: FontSize.sm,
    marginBottom: Spacing.xs,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemTime: {
    fontSize: FontSize.xs,
  },
  itemMethod: {
    fontSize: FontSize.xs,
  },
  itemError: {
    fontSize: FontSize.xs,
    marginTop: Spacing.xs,
  },
});
