import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
import { getQueue, clearFailedItems } from '@/db/offline-queue-db';
import type { OfflineQueueItem } from '@/types/offline.types';
import { reportQueueClear } from '@/api/sync.api';
import { onSyncItemEvent } from '@/services/sync-manager';
import { prefetchVistaDiasRuta } from '@/services/prefetch-manager';
import { getClienteById } from '@/db/clientes-db';
import { getPrestamoById } from '@/db/prestamos-db';
import { getRutas, getRutaClienteById } from '@/db/rutas-db';
import { formatCurrency } from '@/utils/formatters';
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

function getModuleLabel(item: Pick<OfflineQueueItem, 'endpoint' | 'method'>): string {
  const { endpoint, method } = item;
  if (endpoint.includes('/pagos/saldar')) return 'Saldar préstamo';
  if (endpoint.includes('/pagos')) return 'Pago recibido';
  if (endpoint.includes('/caja/abrir')) return 'Abrir caja';
  if (endpoint.includes('/caja/cerrar')) return 'Cerrar caja';
  if (endpoint.includes('/caja')) return 'Caja';
  if (endpoint.includes('/prestamos') && endpoint.includes('/refinanciar')) return 'Refinanciar préstamo';
  if (endpoint.includes('/prestamos') && endpoint.includes('/cancelar')) return 'Cancelar préstamo';
  if (endpoint.includes('/prestamos') && endpoint.includes('/estado')) return 'Cambiar estado';
  if (endpoint.includes('/prestamos') && endpoint.includes('/desembolsar')) return 'Desembolso';
  if (endpoint.includes('/prestamos')) return method === 'POST' ? 'Nuevo préstamo' : 'Préstamo';
  if (endpoint.includes('/clientes') && endpoint.includes('/reactivar')) return 'Reactivar cliente';
  if (endpoint.includes('/clientes')) {
    if (method === 'POST') return 'Nuevo cliente';
    if (method === 'DELETE') return 'Eliminar cliente';
    return 'Editar cliente';
  }
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

function getItemMonto(item: OfflineQueueItem): number | undefined {
  const data = item.tempDisplay || item.data;
  if (!data || typeof data !== 'object') return undefined;
  const obj = data as Record<string, unknown>;
  for (const key of ['montoPagado', 'montoCierre', 'montoInicial', 'monto', 'montoTotal']) {
    const value = obj[key];
    if (typeof value === 'number' && value > 0) return value;
  }
  return undefined;
}

function clienteFullName(cliente: { nombre?: string; apellido?: string | null } | null | undefined): string | null {
  if (!cliente) return null;
  const name = [cliente.nombre, cliente.apellido].filter(Boolean).join(' ').trim();
  return name || null;
}

function nombreClientePorId(clienteId: string): string | null {
  if (!clienteId) return null;
  return clienteFullName(getClienteById(clienteId));
}

function nombreClientePorPrestamoId(prestamoId: string): string | null {
  if (!prestamoId) return null;
  const prestamo = getPrestamoById(prestamoId);
  if (!prestamo) return null;
  return nombreClientePorId(prestamo.clienteId);
}

function nombreClientePorRutaClienteId(rcId: string): string | null {
  if (!rcId) return null;
  for (const ruta of getRutas()) {
    const rc = ruta.clientes?.find((c) => c.id === rcId);
    if (rc?.clienteId) {
      const nombre = nombreClientePorId(rc.clienteId);
      if (nombre) return nombre;
    }
  }
  return null;
}

type ItemDetailRow = { label: string; value: string };

interface ItemDetails {
  summary: string;
  rows: ItemDetailRow[];
}

interface ClienteInfo {
  nombre: string | null;
  cedula: string | null;
}

function pushClienteRows(rows: ItemDetailRow[], info: ClienteInfo): void {
  if (info.nombre) rows.push({ label: 'Cliente', value: info.nombre });
  if (info.cedula) rows.push({ label: 'Cédula', value: info.cedula });
}

function formatNumeroCuota(data: Record<string, any>): string | null {
  if (!data.cuotaId || !data.prestamoId) return null;
  const prestamo = getPrestamoById(data.prestamoId);
  const cuotas = prestamo?.cuotas;
  if (!Array.isArray(cuotas) || cuotas.length === 0) return null;
  const index = cuotas.findIndex((c) => c.id === data.cuotaId);
  if (index === -1) return null;
  return `${index + 1} de ${cuotas.length}`;
}

function clienteInfo(item: OfflineQueueItem, data: Record<string, any>): ClienteInfo {
  let clienteId: string | null = null;

  if (data.clienteId) clienteId = data.clienteId;
  else if (data.prestamoId) clienteId = getPrestamoById(data.prestamoId)?.clienteId ?? null;
  else if (data.rcId) clienteId = getRutaClienteById(data.rcId)?.clienteId ?? null;

  if (!clienteId && typeof item.endpoint === 'string') {
    const saldarMatch = item.endpoint.match(/^\/pagos\/saldar\/([^/]+)/);
    if (saldarMatch) clienteId = getPrestamoById(saldarMatch[1])?.clienteId ?? null;
    const prestamoMatch = item.endpoint.match(/^\/prestamos\/([^/]+)/);
    if (!clienteId && prestamoMatch && !saldarMatch) {
      clienteId = getPrestamoById(prestamoMatch[1])?.clienteId ?? null;
    }
    const clienteMatch = item.endpoint.match(/^\/clientes\/([^/]+)/);
    if (!clienteId && clienteMatch) clienteId = clienteMatch[1];
  }

  let nombre =
    typeof data.clienteNombre === 'string' && data.clienteNombre ? data.clienteNombre : null;
  if (!nombre && clienteId) nombre = nombreClientePorId(clienteId);
  if (!nombre && data.rcId) nombre = nombreClientePorRutaClienteId(data.rcId);
  if (!nombre && data.prestamoId) nombre = nombreClientePorPrestamoId(data.prestamoId);

  let cedula =
    typeof data.clienteCedula === 'string' && data.clienteCedula ? data.clienteCedula : null;
  if (!cedula && clienteId) cedula = getClienteById(clienteId)?.cedula ?? null;

  return { nombre, cedula };
}

function buildItemDetails(item: OfflineQueueItem): ItemDetails {
  const data = (item.tempDisplay || item.data || {}) as Record<string, any>;
  const { endpoint, method } = item;
  const info = clienteInfo(item, data);
  const rows: ItemDetailRow[] = [];

  if (endpoint === '/pagos' && method === 'POST') {
    pushClienteRows(rows, info);
    const cuota = formatNumeroCuota(data);
    if (cuota) rows.push({ label: 'Cuota', value: cuota });
    const monto = data.montoPagado ?? data.montoTotal;
    if (monto) rows.push({ label: 'Monto', value: formatCurrency(monto) });
    if (data.metodo) rows.push({ label: 'Método', value: data.metodo });
    const prestamo = data.prestamoId ? getPrestamoById(data.prestamoId) : null;
    if (prestamo) rows.push({ label: 'Saldo', value: formatCurrency(prestamo.saldoPendiente) });
    const base = `Pago ${formatCurrency(monto)}${info.nombre ? ` a ${info.nombre}` : ''}`;
    return { summary: data.metodo ? `${base} · ${data.metodo}` : base, rows };
  }

  const saldarMatch = endpoint.match(/^\/pagos\/saldar\/([^/]+)/);
  if (saldarMatch) {
    pushClienteRows(rows, info);
    const monto = data.montoTotal ?? data.montoPagado ?? data.monto;
    if (monto) rows.push({ label: 'Monto', value: formatCurrency(monto) });
    if (data.metodo) rows.push({ label: 'Método', value: data.metodo });
    return {
      summary: `Saldar préstamo de ${info.nombre ?? 'cliente'}${monto ? ` · ${formatCurrency(monto)}` : ''}`,
      rows,
    };
  }

  if (endpoint === '/caja/abrir') {
    rows.push({ label: 'Monto', value: formatCurrency(data.montoInicial) });
    rows.push({ label: 'Estado', value: 'Abierta' });
    return { summary: `Abrir caja · ${formatCurrency(data.montoInicial)}`, rows };
  }
  if (endpoint === '/caja/cerrar') {
    const monto = data.montoCierre ?? data.monto;
    rows.push({ label: 'Monto cierre', value: formatCurrency(monto) });
    if (typeof data.diferencia === 'number') {
      rows.push({ label: 'Diferencia', value: formatCurrency(data.diferencia) });
    }
    return { summary: `Cerrar caja · ${formatCurrency(monto)}`, rows };
  }

  if (endpoint === '/prestamos' && method === 'POST') {
    pushClienteRows(rows, info);
    if (data.monto) rows.push({ label: 'Monto', value: formatCurrency(data.monto) });
    if (data.tasaInteres) rows.push({ label: 'Tasa', value: `${data.tasaInteres}%` });
    if (data.numeroCuotas) rows.push({ label: 'Cuotas', value: String(data.numeroCuotas) });
    if (data.frecuenciaPago) rows.push({ label: 'Frecuencia', value: data.frecuenciaPago });
    rows.push({ label: 'Estado', value: 'Solicitado' });
    return {
      summary: `Nuevo préstamo ${formatCurrency(data.monto)}${info.nombre ? ` · ${info.nombre}` : ''}`,
      rows,
    };
  }

  const prestamoMatch = endpoint.match(/^\/prestamos\/([^/]+)/);
  if (prestamoMatch) {
    pushClienteRows(rows, info);
    if (Array.isArray(data.cambios) && data.cambios.length > 0) {
      rows.push({ label: 'Cambios', value: data.cambios.join(', ') });
    }
    if (data.nuevoEstado) rows.push({ label: 'Nuevo estado', value: String(data.nuevoEstado) });
    if (data.motivo) rows.push({ label: 'Motivo', value: String(data.motivo) });
    if (data.nuevasCuotas) rows.push({ label: 'Nuevas cuotas', value: String(data.nuevasCuotas) });
    if (data.nuevaTasa) rows.push({ label: 'Nueva tasa', value: `${data.nuevaTasa}%` });
    const id = prestamoMatch[1];
    const prestamo = getPrestamoById(id);
    const monto = data.monto ?? prestamo?.monto;
    const sufijo = info.nombre ? ` · ${info.nombre}` : '';
    if (endpoint.endsWith('/cancelar')) return { summary: `Cancelar préstamo${sufijo}`, rows };
    if (endpoint.endsWith('/desembolsar')) {
      if (monto) rows.unshift({ label: 'Monto', value: formatCurrency(monto) });
      return { summary: `Desembolso ${formatCurrency(monto)}${sufijo}`, rows };
    }
    if (endpoint.endsWith('/estado')) return { summary: `Cambiar estado de préstamo${sufijo}`, rows };
    if (endpoint.endsWith('/refinanciar')) return { summary: `Refinanciar préstamo${sufijo}`, rows };
    return { summary: `Editar préstamo${sufijo}`, rows };
  }

  if (endpoint === '/clientes' && method === 'POST') {
    const nombre = clienteFullName(data) ?? info.nombre;
    const cedula = data.cedula ?? info.cedula;
    if (nombre) rows.push({ label: 'Cliente', value: nombre });
    if (cedula) rows.push({ label: 'Cédula', value: cedula });
    return { summary: `Nuevo cliente: ${nombre ?? '—'}${cedula ? ` · Cédula ${cedula}` : ''}`, rows };
  }

  const clienteMatch = endpoint.match(/^\/clientes\/([^/]+)/);
  if (clienteMatch) {
    const nombre = info.nombre ?? nombreClientePorId(clienteMatch[1]) ?? '—';
    if (info.nombre) pushClienteRows(rows, info);
    if (Array.isArray(data.cambios) && data.cambios.length > 0) {
      rows.push({ label: 'Cambios', value: data.cambios.join(', ') });
    }
    if (endpoint.endsWith('/reactivar')) return { summary: `Reactivar cliente: ${nombre}`, rows };
    if (method === 'DELETE') return { summary: `Eliminar cliente: ${nombre}`, rows };
    return { summary: `Editar cliente: ${nombre}`, rows };
  }

  if (endpoint.includes('/visita')) {
    if (info.nombre) rows.push({ label: 'Cliente', value: info.nombre });
    if (typeof data.visitado === 'boolean') {
      rows.push({ label: 'Visita', value: data.visitado ? 'Visitado' : 'Pendiente' });
    }
    const base = `Marcar visita${info.nombre ? `: ${info.nombre}` : ''}`;
    return {
      summary: typeof data.visitado === 'boolean' ? `${base} · ${data.visitado ? 'Visitado' : 'Pendiente'}` : base,
      rows,
    };
  }
  if (endpoint.includes('/reset')) return { summary: 'Reset de visitas de la ruta', rows };
  if (endpoint.includes('/generar')) {
    if (data.fecha) rows.push({ label: 'Fecha', value: String(data.fecha) });
    return { summary: 'Generar día de ruta', rows };
  }

  return { summary: getDisplayText(item), rows };
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
  details,
  colors,
  colorScheme,
  index,
}: {
  item: OfflineQueueItem;
  details: ItemDetails;
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
      accessibilityLabel={`${getModuleLabel(item)} - ${statusConfig.label}`}
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
            {getModuleLabel(item)}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
          <Ionicons name={statusConfig.icon} size={scale(12)} color={statusConfig.color} />
          <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>
            {statusConfig.label}
          </Text>
        </View>
      </View>

      {details.summary ? (
        <Text style={[styles.itemDescription, { color: colors.textSecondary }]}>
          {details.summary}
        </Text>
      ) : null}

      {details.rows.length > 0 && (
        <View style={[styles.detailRows, { backgroundColor: colors.background }]}>
          {details.rows.map((row) => (
            <View key={row.label} style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>
                {row.label}
              </Text>
              <Text
                style={[styles.detailValue, { color: colors.text }]}
                numberOfLines={1}
              >
                {row.value}
              </Text>
            </View>
          ))}
        </View>
      )}

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
  const { network, isSyncing, pendingCount, failedCount, lastSyncAt, syncProgress, triggerSync, retryFailed } = useNetworkContext();
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

  // Refresca la cola en vivo cuando cada item cambia de estado (syncing →
  // synced/failed), con throttle para no re-renderizar en ráfaga. Así se ve el
  // avance uno-a-uno en lugar de esperar a que termine todo el sync.
  useEffect(() => {
    let lastRun = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsub = onSyncItemEvent(() => {
      const now = Date.now();
      if (now - lastRun >= 150) {
        lastRun = now;
        loadItems();
      } else if (!timer) {
        timer = setTimeout(() => {
          timer = null;
          lastRun = Date.now();
          loadItems();
        }, 150 - (now - lastRun));
      }
    });
    return () => {
      unsub();
      if (timer) clearTimeout(timer);
    };
  }, [loadItems]);

  const detailsMap = useMemo(
    () => new Map(items.map((i) => [i.id, buildItemDetails(i)])),
    [items],
  );

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

  const handleRetryFailed = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    retryFailed();
    setTimeout(loadItems, 1000);
  }, [retryFailed, loadItems]);

  const handleClear = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const failed = items.filter((i) => i.status === 'failed');
    const ids = failed.map((i) => i.id);

    try {
      await reportQueueClear(
        failed.map((i) => ({
          endpoint: i.endpoint,
          method: i.method,
          createdAt: i.createdAt,
          monto: getItemMonto(i),
        })),
      );
    } catch {
      // Offline o error: la auditoría es best-effort y no bloquea la limpieza local
    }

    clearFailedItems(ids);
    await loadItems();
    setShowClearConfirm(false);
  }, [items, loadItems]);

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
              const { success, failed } = await prefetchVistaDiasRuta(queryClient);
              const message =
                failed > 0
                  ? `Datos recargados. ${success} ruta(s) listas para offline, ${failed} no pudieron descargarse.`
                  : success > 0
                    ? `Datos recargados. ${success} ruta(s) listas para usar sin conexión.`
                    : 'Datos recargados correctamente.';
              Alert.alert('Listo', message);
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

        {/* Progreso del sync en vivo */}
        {isSyncing && syncProgress && syncProgress.total > 0 && (
          <View
            style={[
              styles.progressCard,
              { backgroundColor: colors.card, borderColor: colors.border },
              Shadows.sm,
            ]}
            accessible
            accessibilityLabel={`Sincronizando ${Math.min(syncProgress.processed + 1, syncProgress.total)} de ${syncProgress.total} operaciones`}
          >
            <View style={styles.progressHeader}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.progressTitle, { color: colors.text }]}>
                Sincronizando{' '}
                {Math.min(
                  syncProgress.processed + (syncProgress.current ? 1 : 0),
                  syncProgress.total,
                )}{' '}
                de {syncProgress.total}
              </Text>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: colors.surface }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(
                      Math.round((syncProgress.processed / syncProgress.total) * 100),
                      100,
                    )}%`,
                    backgroundColor: colors.primary,
                  },
                ]}
              />
            </View>
          </View>
        )}

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
            disabled={failedItems.length === 0}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Limpiar operaciones fallidas"
            accessibilityState={{ disabled: failedItems.length === 0 }}
          >
            <Ionicons name="trash-outline" size={scale(18)} color={colors.error} />
            <Text style={[styles.actionButtonTextSecondary, { color: colors.error }]}>
              Limpiar fallidos
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

        {/* Reintentar fallidos */}
        {failedCount > 0 && (
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.error }]}
            onPress={handleRetryFailed}
            disabled={isSyncing}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Reintentar ${failedCount} operaciones fallidas`}
          >
            {isSyncing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="refresh-outline" size={scale(18)} color="#FFFFFF" />
            )}
            <Text style={styles.retryButtonText}>
              Reintentar fallidos ({failedCount})
            </Text>
          </TouchableOpacity>
        )}

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
                      details={detailsMap.get(item.id) ?? { summary: '', rows: [] }}
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
                      details={detailsMap.get(item.id) ?? { summary: '', rows: [] }}
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
        title="Limpiar fallidos"
        message={`Se eliminarán solo las ${failedItems.length} operaciones fallidas. Las operaciones pendientes no se pueden borrar. Esta acción no se puede deshacer.`}
        confirmLabel="Limpiar fallidos"
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
  progressCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  progressTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  progressTrack: {
    height: scale(8),
    borderRadius: scale(4),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: scale(4),
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
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
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
  detailRows: {
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 2,
  },
  detailLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  detailValue: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    flex: 1,
    textAlign: 'right',
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
