import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';

import { FontSize, FontWeight, Spacing, BorderRadius, Shadows, scale } from '@/constants/theme';
import { METODO_PAGO_LABELS } from '@/constants/pagos.constants';
import { useCobros, useCarteraVencida, useEstadoGeneral, useReporteCliente, useReporteCajas, useFlujoCaja, useDesempenoCobrador, useProyeccionCuotas } from '@/hooks/use-reportes';
import { useUsuarios } from '@/hooks/use-usuarios';
import type { Usuario } from '@/api/usuarios.api';
import { useClientes } from '@/hooks/use-clientes';
import { Skeleton, SkeletonKPIGrid } from '@/components/ui/skeleton';
import { AppInput } from '@/components/ui/app-input';
import DatePickerField from '@/components/ui/date-picker-field';
import { useToast } from '@/components/ui/toast';
import { useTheme } from '@/components/ui/theme-provider';
import { usePermisos } from '@/permisos/use-permisos';
import SinAcceso from '@/components/permisos/sin-acceso';
import EmptyState from '@/components/ui/empty-state';
import ScrollToTopButton from '@/components/ui/scroll-to-top';
import KpiCard from '@/components/ui/kpi-card';
import Badge from '@/components/ui/badge';
import { formatCurrencyCompact, formatFullCurrency, getTodayISO, getMonthStart } from '@/utils/formatters';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatFecha(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatFechaCorta(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return `Hoy ${d.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}`;
  return d.toLocaleDateString('es-DO', { day: '2-digit', month: 'short' });
}

function getMetodoColor(metodo: string, colors: Record<string, string>) {
  switch (metodo) {
    case 'EFECTIVO': return { color: colors.success, bg: colors.successLight };
    case 'TARJETA': return { color: colors.info, bg: colors.infoLight };
    case 'TRANSFERENCIA': return { color: colors.warning, bg: colors.warningLight };
    default: return { color: colors.textSecondary, bg: colors.surface };
  }
}

function getEstadoColor(estado: string, colors: Record<string, string>) {
  switch (estado) {
    case 'ACTIVO': return { color: colors.success, bg: colors.successLight };
    case 'ATRASADO': return { color: colors.error, bg: colors.errorLight };
    case 'PAGADO': return { color: colors.info, bg: colors.infoLight };
    case 'CANCELADO': return { color: colors.textTertiary, bg: colors.surface };
    case 'SOLICITADO': return { color: colors.warning, bg: colors.warningLight };
    case 'RENOVADO': return { color: colors.warning, bg: colors.warningLight };
    default: return { color: colors.textSecondary, bg: colors.surface };
  }
}

type TabId = 'cobros' | 'cartera' | 'estado' | 'cliente' | 'cajas' | 'flujo' | 'cobrador' | 'proyeccion';

type CobradorSelectorProps = {
  usuarios?: Usuario[];
  loading: boolean;
  usuarioId: string;
  onSelect: (id: string) => void;
  onClear: () => void;
  colors: Record<string, string>;
};

function CobradorSelector({ usuarios, loading, usuarioId, onSelect, onClear, colors }: CobradorSelectorProps) {
  const [open, setOpen] = useState(false);
  const cobradores = (usuarios ?? []).filter((u) => u.rol === 'EMPLEADO');
  const selected = cobradores.find((u) => u.id === usuarioId);

  return (
    <>
      <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Cobrador (opcional)</Text>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={[styles.clienteSelector, { backgroundColor: colors.background, borderColor: colors.border }]}
      >
        <Ionicons name="people-outline" size={scale(18)} color={colors.textTertiary} />
        <Text style={[styles.clienteSelectorText, { color: selected ? colors.text : colors.textTertiary }]}>
          {loading ? 'Cargando...' : selected ? selected.nombre : 'Todos los cobradores'}
        </Text>
        {!selected ? (
          <Ionicons name="chevron-down" size={scale(18)} color={colors.textTertiary} />
        ) : (
          <TouchableOpacity onPress={() => { onClear(); setOpen(false); }} hitSlop={8}>
            <Ionicons name="close-circle" size={scale(18)} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={[styles.modalOverlay, { backgroundColor: colors.overlay }]} onPress={() => setOpen(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.surfaceElevated }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Seleccionar cobrador</Text>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={scale(24)} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={cobradores}
              keyExtractor={(u) => u.id}
              renderItem={({ item }) => {
                const activo = item.id === usuarioId;
                return (
                  <TouchableOpacity
                    onPress={() => { onSelect(item.id); setOpen(false); }}
                    style={[styles.clienteItem, { borderBottomColor: colors.borderLight }, activo && { backgroundColor: colors.primaryLight }]}
                  >
                    <View style={[styles.clienteAvatar, { backgroundColor: colors.primaryLight }]}>
                      <Text style={[styles.clienteAvatarText, { color: colors.primary }]}>
                        {(item.nombre?.[0] ?? '?').toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.clienteItemInfo}>
                      <Text style={[styles.clienteItemName, { color: colors.text }]}>{item.nombre}</Text>
                      <Text style={[styles.clienteItemCedula, { color: colors.textTertiary }]}>{item.email}</Text>
                    </View>
                    {activo && <Ionicons name="checkmark-circle" size={scale(20)} color={colors.primary} />}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <EmptyState
                  icon="people-outline"
                  title="Sin cobradores"
                  subtitle="No hay empleados disponibles"
                />
              }
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const TABS: { id: TabId; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'cobros', label: 'Cobros', icon: 'cash-outline' },
  { id: 'cartera', label: 'Cartera', icon: 'warning-outline' },
  { id: 'estado', label: 'Estado', icon: 'stats-chart-outline' },
  { id: 'cliente', label: 'Cliente', icon: 'person-outline' },
  { id: 'cajas', label: 'Cajas', icon: 'archive-outline' },
  { id: 'flujo', label: 'Flujo', icon: 'trending-up-outline' },
  { id: 'cobrador', label: 'Cobrador', icon: 'people-outline' },
  { id: 'proyeccion', label: 'Proyección', icon: 'calendar-outline' },
];

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ReportesScreen() {
  const { colorScheme, colors } = useTheme();
  const { showToast } = useToast();
  const { moduloHabilitado, tienePermiso } = usePermisos();

  // Tab state
  const [tab, setTab] = useState<TabId>('cobros');

  // Filters
  const [desde, setDesde] = useState(getMonthStart());
  const [hasta, setHasta] = useState(getTodayISO());
  const [provincia, setProvincia] = useState('');
  const [usuarioId, setUsuarioId] = useState('');

  // Cliente search
  const [clienteSearch, setClienteSearch] = useState('');
  const [clienteSelected, setClienteSelected] = useState<{ id: string; nombre: string } | null>(null);
  const [showClienteModal, setShowClienteModal] = useState(false);
  const [showCobradorModal, setShowCobradorModal] = useState(false);
  const { data: usuarios, isLoading: usuariosLoading } = useUsuarios();

  // Query control
  const [shouldFetch, setShouldFetch] = useState(false);

  // Scroll tracking
  const [showScrollTop, setShowScrollTop] = useState(false);
  const listRef = useRef<FlatList<any>>(null);

  // Client search
  const { data: clientesData } = useClientes(
    useMemo(() => (clienteSearch ? { search: clienteSearch, limit: 20 } : { limit: 20 }), [clienteSearch]),
  );
  const clientes = clientesData?.data ?? [];

  // Cobros query
  const cobrosFilters = useMemo(() => ({ desde, hasta, provincia: provincia || undefined }), [desde, hasta, provincia]);
  const { data: cobrosData, isLoading: cobrosLoading, isRefetching: cobrosRefetching, refetch: refetchCobros, error: cobrosError } = useCobros(cobrosFilters, shouldFetch && tab === 'cobros');

  // Cartera vencida query
  const carteraFilters = useMemo(() => ({ provincia: provincia || undefined }), [provincia]);
  const { data: carteraData, isLoading: carteraLoading, isRefetching: carteraRefetching, refetch: refetchCartera, error: carteraError } = useCarteraVencida(carteraFilters, shouldFetch && tab === 'cartera');

  // Estado general query
  const estadoFilters = useMemo(() => ({ provincia: provincia || undefined }), [provincia]);
  const { data: estadoData, isLoading: estadoLoading, isRefetching: estadoRefetching, refetch: refetchEstado, error: estadoError } = useEstadoGeneral(estadoFilters, shouldFetch && tab === 'estado');

  // Cliente reporte query
  const { data: clienteData, isLoading: clienteLoading, isRefetching: clienteRefetching, refetch: refetchCliente, error: clienteError } = useReporteCliente(clienteSelected?.id ?? null, shouldFetch && tab === 'cliente' && !!clienteSelected);

  // Cajas query
  const cajasFilters = useMemo(() => ({ desde, hasta, usuarioId: usuarioId || undefined }), [desde, hasta, usuarioId]);
  const { data: cajasData, isLoading: cajasLoading, isRefetching: cajasRefetching, refetch: refetchCajas, error: cajasError } = useReporteCajas(cajasFilters, shouldFetch && tab === 'cajas');

  // Flujo de caja query
  const flujoFilters = useMemo(() => ({ desde, hasta, usuarioId: usuarioId || undefined }), [desde, hasta, usuarioId]);
  const { data: flujoData, isLoading: flujoLoading, isRefetching: flujoRefetching, refetch: refetchFlujo, error: flujoError } = useFlujoCaja(flujoFilters, shouldFetch && tab === 'flujo');

  // Desempeño cobrador query
  const desempenoFilters = useMemo(() => ({ desde: desde || undefined, hasta: hasta || undefined, usuarioId: usuarioId || undefined }), [desde, hasta, usuarioId]);
  const { data: desempenoData, isLoading: desempenoLoading, isRefetching: desempenoRefetching, refetch: refetchDesempeno, error: desempenoError } = useDesempenoCobrador(desempenoFilters, shouldFetch && tab === 'cobrador');

  // Proyección cuotas query
  const proyeccionFilters = useMemo(() => ({ provincia: provincia || undefined }), [provincia]);
  const { data: proyeccionData, isLoading: proyeccionLoading, isRefetching: proyeccionRefetching, refetch: refetchProyeccion, error: proyeccionError } = useProyeccionCuotas(proyeccionFilters, shouldFetch && tab === 'proyeccion');

  const loading = useMemo(() => {
    switch (tab) {
      case 'cobros': return cobrosLoading;
      case 'cartera': return carteraLoading;
      case 'estado': return estadoLoading;
      case 'cliente': return clienteLoading;
      case 'cajas': return cajasLoading;
      case 'flujo': return flujoLoading;
      case 'cobrador': return desempenoLoading;
      case 'proyeccion': return proyeccionLoading;
      default: return false;
    }
  }, [tab, cobrosLoading, carteraLoading, estadoLoading, clienteLoading, cajasLoading, flujoLoading, desempenoLoading, proyeccionLoading]);

  const isRefetching = useMemo(() => {
    switch (tab) {
      case 'cobros': return cobrosRefetching;
      case 'cartera': return carteraRefetching;
      case 'estado': return estadoRefetching;
      case 'cliente': return clienteRefetching;
      case 'cajas': return cajasRefetching;
      case 'flujo': return flujoRefetching;
      case 'cobrador': return desempenoRefetching;
      case 'proyeccion': return proyeccionRefetching;
      default: return false;
    }
  }, [tab, cobrosRefetching, carteraRefetching, estadoRefetching, clienteRefetching, cajasRefetching, flujoRefetching, desempenoRefetching, proyeccionRefetching]);

  const currentData = useMemo(() => {
    switch (tab) {
      case 'cobros': return cobrosData as any;
      case 'cartera': return carteraData as any;
      case 'estado': return estadoData as any;
      case 'cliente': return clienteData as any;
      case 'cajas': return cajasData as any;
      case 'flujo': return flujoData as any;
      case 'cobrador': return desempenoData as any;
      case 'proyeccion': return proyeccionData as any;
      default: return null;
    }
  }, [tab, cobrosData, carteraData, estadoData, clienteData, cajasData, flujoData, desempenoData, proyeccionData]);

  const activeError = useMemo(() => {
    switch (tab) {
      case 'cobros': return cobrosError;
      case 'cartera': return carteraError;
      case 'estado': return estadoError;
      case 'cliente': return clienteError;
      case 'cajas': return cajasError;
      case 'flujo': return flujoError;
      case 'cobrador': return desempenoError;
      case 'proyeccion': return proyeccionError;
      default: return null;
    }
  }, [tab, cobrosError, carteraError, estadoError, clienteError, cajasError, flujoError, desempenoError, proyeccionError]);

  // ─── Generate ─────────────────────────────────────────────────────────────

  const handleGenerate = useCallback(() => {
    if (tab === 'cliente' && !clienteSelected) {
      showToast('Selecciona un cliente primero', 'error');
      return;
    }
    setShouldFetch(true);
    setTimeout(() => {
      switch (tab) {
        case 'cobros': refetchCobros(); break;
        case 'cartera': refetchCartera(); break;
        case 'estado': refetchEstado(); break;
        case 'cliente': refetchCliente(); break;
        case 'cajas': refetchCajas(); break;
        case 'flujo': refetchFlujo(); break;
        case 'cobrador': refetchDesempeno(); break;
        case 'proyeccion': refetchProyeccion(); break;
      }
    }, 0);
  }, [tab, clienteSelected, showToast, refetchCobros, refetchCartera, refetchEstado, refetchCliente, refetchCajas, refetchFlujo, refetchDesempeno, refetchProyeccion]);

  // ─── Refresh ──────────────────────────────────────────────────────────────

  const handleRefresh = useCallback(async () => {
    switch (tab) {
      case 'cobros': refetchCobros(); break;
      case 'cartera': refetchCartera(); break;
      case 'estado': refetchEstado(); break;
      case 'cliente': refetchCliente(); break;
      case 'cajas': refetchCajas(); break;
      case 'flujo': refetchFlujo(); break;
      case 'cobrador': refetchDesempeno(); break;
      case 'proyeccion': refetchProyeccion(); break;
    }
  }, [tab, refetchCobros, refetchCartera, refetchEstado, refetchCliente, refetchCajas, refetchFlujo, refetchDesempeno, refetchProyeccion]);

  // ─── Change tab ───────────────────────────────────────────────────────────

  const changeTab = useCallback((t: TabId) => {
    setTab(t);
    setShouldFetch(false);
  }, []);

  // ─── Select cliente ───────────────────────────────────────────────────────

  const selectCliente = useCallback((c: { id: string; nombre: string }) => {
    setClienteSelected(c);
    setShowClienteModal(false);
  }, []);

  // ─── Focus refresh ────────────────────────────────────────────────────────

  useFocusEffect(
    useCallback(() => {
      if (shouldFetch) handleRefresh();
    }, [shouldFetch, handleRefresh]),
  );

  // ─── Render helpers ───────────────────────────────────────────────────────

  const renderKpiRow = useCallback(
    (items: { label: string; value: string; color: string; bg: string }[]) => (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.kpiScroll}>
        {items.map((item, i) => (
          <KpiCard key={i} {...item} />
        ))}
      </ScrollView>
    ),
    [],
  );

  const renderEstadoBadge = useCallback((estado: string) => {
    const { color, bg } = getEstadoColor(estado, colors);
    return <Badge label={estado} color={color} bg={bg} />;
  }, [colors]);

  const renderMetodoBadge = useCallback((metodo: string) => {
    const { color, bg } = getMetodoColor(metodo, colors);
    return <Badge label={METODO_PAGO_LABELS[metodo as keyof typeof METODO_PAGO_LABELS] ?? metodo} color={color} bg={bg} />;
  }, [colors]);

  // ─── Top filters ──────────────────────────────────────────────────────────

  const renderFilters = useCallback(() => {
    switch (tab) {
      case 'cobros':
      case 'cajas':
      case 'flujo':
        return (
          <View style={[styles.filterCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Filtros</Text>
            <View style={styles.filterRow}>
              <View style={styles.filterHalf}>
                <DatePickerField label="Desde" value={desde} onChange={setDesde} />
              </View>
              <View style={styles.filterHalf}>
                <DatePickerField label="Hasta" value={hasta} onChange={setHasta} />
              </View>
            </View>
            {tab === 'cobros' && (
              <AppInput
                label="Provincia (opcional)"
                placeholder="Ej: Santo Domingo"
                value={provincia}
                onChangeText={setProvincia}
              />
            )}
            {(tab === 'cajas' || tab === 'flujo') && (
              <CobradorSelector
                usuarios={usuarios}
                loading={usuariosLoading}
                usuarioId={usuarioId}
                onSelect={setUsuarioId}
                onClear={() => setUsuarioId('')}
                colors={colors}
              />
            )}
          </View>
        );
      case 'cartera':
      case 'estado':
      case 'proyeccion':
        return (
          <View style={[styles.filterCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Filtros</Text>
            <AppInput
              label="Provincia (opcional)"
              placeholder="Ej: Santo Domingo"
              value={provincia}
              onChangeText={setProvincia}
            />
          </View>
        );
      case 'cliente':
        return (
          <View style={[styles.filterCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Cliente</Text>
            <TouchableOpacity
              onPress={() => setShowClienteModal(true)}
              style={[styles.clienteSelector, { backgroundColor: colors.background, borderColor: colors.border }]}
            >
              <Ionicons name="search-outline" size={scale(18)} color={colors.textTertiary} />
              <Text style={[styles.clienteSelectorText, { color: clienteSelected ? colors.text : colors.textTertiary }]}>
                {clienteSelected ? clienteSelected.nombre : 'Buscar cliente...'}
              </Text>
              {clienteSelected && (
                <TouchableOpacity onPress={() => setClienteSelected(null)} hitSlop={8}>
                  <Ionicons name="close-circle" size={scale(18)} color={colors.textTertiary} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          </View>
        );
      case 'cobrador':
        return (
          <View style={[styles.filterCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Filtros</Text>
            <View style={styles.filterRow}>
              <View style={styles.filterHalf}>
                <DatePickerField label="Desde" value={desde} onChange={setDesde} />
              </View>
              <View style={styles.filterHalf}>
                <DatePickerField label="Hasta" value={hasta} onChange={setHasta} />
              </View>
            </View>
            <CobradorSelector
              usuarios={usuarios}
              loading={usuariosLoading}
              usuarioId={usuarioId}
              onSelect={setUsuarioId}
              onClear={() => setUsuarioId('')}
              colors={colors}
            />
          </View>
        );
      default:
        return null;
    }
  }, [tab, colors, desde, hasta, provincia, clienteSelected]);

  // ─── Render cobros ────────────────────────────────────────────────────────

  const renderCobros = useCallback(() => {
    if (!cobrosData) return null;
    return (
      <View>
        {renderKpiRow([
          { label: 'Total cobrado', value: formatFullCurrency(cobrosData.totalCobrado ?? 0), color: colors.primary, bg: colors.primaryLight },
          { label: 'Capital', value: formatFullCurrency(cobrosData.totalCapital ?? 0), color: colors.secondary, bg: colors.secondaryLight },
          { label: 'Interés', value: formatFullCurrency(cobrosData.totalInteres ?? 0), color: colors.warning, bg: colors.warningLight },
          { label: 'Mora', value: formatFullCurrency(cobrosData.totalMora ?? 0), color: colors.error, bg: colors.errorLight },
        ])}
        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: Spacing.sm }]}>
          {cobrosData.totalRegistros} cobro{cobrosData.totalRegistros !== 1 ? 's' : ''}
        </Text>
        {cobrosData.pagos.map((pago, i) => (
          <View key={i} style={[styles.itemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.itemTop}>
              <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>{pago.cliente}</Text>
              {renderMetodoBadge(pago.metodo)}
            </View>
            <Text style={[styles.itemSub, { color: colors.textSecondary }]}>
              {pago.cedula} · {pago.provincia}{pago.municipio ? `, ${pago.municipio}` : ''}
            </Text>
            <View style={styles.itemMeta}>
              <Text style={[styles.itemMetaText, { color: colors.textTertiary }]}>
                {formatFechaCorta(pago.fecha)} · {pago.cobrador}
              </Text>
              <Text style={[styles.itemMonto, { color: colors.text }]}>
                {formatFullCurrency(pago.total ?? 0)}
              </Text>
            </View>
            <View style={styles.itemBreakdown}>
              <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>
                Cap: {formatCurrencyCompact(pago.capital ?? 0)} | Int: {formatCurrencyCompact(pago.interes ?? 0)} | Mora: {formatCurrencyCompact(pago.mora ?? 0)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    );
  }, [cobrosData, colors, renderKpiRow, renderMetodoBadge]);

  // ─── Render cartera ──────────────────────────────────────────────────────

  const renderCartera = useCallback(() => {
    if (!carteraData) return null;
    return (
      <View>
        {renderKpiRow([
          { label: 'Saldo vencido', value: formatFullCurrency(carteraData.totalSaldoVencido ?? 0), color: colors.error, bg: colors.errorLight },
          { label: 'Mora total', value: formatFullCurrency(carteraData.totalMora ?? 0), color: colors.warning, bg: colors.warningLight },
          { label: 'Préstamos', value: String(carteraData.totalRegistros), color: colors.primary, bg: colors.primaryLight },
        ])}
        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: Spacing.sm }]}>
          {carteraData.totalRegistros} préstamo{carteraData.totalRegistros !== 1 ? 's' : ''} vencido{carteraData.totalRegistros !== 1 ? 's' : ''}
        </Text>
        {carteraData.prestamos.map((item, i) => (
          <View key={i} style={[styles.itemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.itemTop}>
              <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>{item.cliente}</Text>
              <Badge label={`${item.diasMaxAtraso}d`} color={item.diasMaxAtraso > 30 ? colors.error : colors.warning} bg={item.diasMaxAtraso > 30 ? colors.errorLight : colors.warningLight} />
            </View>
            <Text style={[styles.itemSub, { color: colors.textSecondary }]}>
              {item.cedula} · {item.telefono}
            </Text>
            <View style={styles.itemMeta}>
              <Text style={[styles.itemMetaText, { color: colors.textTertiary }]}>
                {item.cuotasVencidas} cuota{item.cuotasVencidas !== 1 ? 's' : ''} vencida{item.cuotasVencidas !== 1 ? 's' : ''}
              </Text>
            </View>
            <View style={styles.itemBreakdown}>
              <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Original:</Text>
              <Text style={[styles.breakdownValue, { color: colors.text }]}>{formatFullCurrency(item.montoOriginal ?? 0)}</Text>
              <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Saldo:</Text>
              <Text style={[styles.breakdownValue, { color: colors.error }]}>{formatFullCurrency(item.saldoPendiente ?? 0)}</Text>
              <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Mora:</Text>
              <Text style={[styles.breakdownValue, { color: colors.warning }]}>{formatFullCurrency(item.moraAcumulada ?? 0)}</Text>
            </View>
          </View>
        ))}
      </View>
    );
  }, [carteraData, colors, renderKpiRow]);

  // ─── Render estado general ───────────────────────────────────────────────

  const renderEstado = useCallback(() => {
    if (!estadoData) return null;
    const r = estadoData.resumen;
    return (
      <View>
        {renderKpiRow([
          { label: 'Activos', value: String(r.activos), color: colors.success, bg: colors.successLight },
          { label: 'Atrasados', value: String(r.atrasados), color: colors.error, bg: colors.errorLight },
          { label: 'Pagados', value: String(r.pagados), color: colors.info, bg: colors.infoLight },
          { label: 'Cancelados', value: String(r.cancelados), color: colors.textTertiary, bg: colors.surface },
        ])}
        {renderKpiRow([
          { label: 'Cartera activa', value: formatFullCurrency(r.totalCartera ?? 0), color: colors.primary, bg: colors.primaryLight },
          { label: 'Desembolsado', value: formatFullCurrency(r.totalDesembolsado ?? 0), color: colors.secondary, bg: colors.secondaryLight },
        ])}
        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: Spacing.sm }]}>
          {estadoData.totalRegistros} préstamo{estadoData.totalRegistros !== 1 ? 's' : ''}
        </Text>
        {estadoData.prestamos.map((item, i) => (
          <View key={i} style={[styles.itemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.itemTop}>
              <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>{item.cliente}</Text>
              {renderEstadoBadge(item.estado)}
            </View>
            <Text style={[styles.itemSub, { color: colors.textSecondary }]}>
              {item.cedula} · {item.provincia}{item.municipio ? `, ${item.municipio}` : ''}
            </Text>
            <View style={styles.itemMeta}>
              <Text style={[styles.itemMetaText, { color: colors.textTertiary }]}>
                {item.frecuencia} · {item.cuotasPendientes} cuotas pend.
              </Text>
            </View>
            <View style={styles.itemBreakdown}>
              <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Original:</Text>
              <Text style={[styles.breakdownValue, { color: colors.text }]}>{formatFullCurrency(item.montoOriginal ?? 0)}</Text>
              <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Saldo:</Text>
              <Text style={[styles.breakdownValue, { color: colors.error }]}>{formatFullCurrency(item.saldoPendiente ?? 0)}</Text>
              <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Tasa:</Text>
              <Text style={[styles.breakdownValue, { color: colors.text }]}>{item.tasaInteres}%</Text>
            </View>
          </View>
        ))}
      </View>
    );
  }, [estadoData, colors, renderKpiRow, renderEstadoBadge]);

  // ─── Render cliente reporte ───────────────────────────────────────────────

  const renderCliente = useCallback(() => {
    if (!clienteData) return null;
    const c = clienteData.cliente;
    return (
      <View>
        {/* Cliente info */}
        <View style={[styles.filterCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{c.nombre}</Text>
          <Text style={[styles.itemSub, { color: colors.textSecondary }]}>
            {c.cedula} · {c.telefono}
          </Text>
          <Text style={[styles.itemSub, { color: colors.textSecondary }]}>
            {c.provincia}{c.municipio !== '—' ? `, ${c.municipio}` : ''}{c.sector !== '—' ? `, ${c.sector}` : ''}
          </Text>
        </View>

        {renderKpiRow([
          { label: 'Préstamos', value: String(clienteData.totalPrestamos), color: colors.primary, bg: colors.primaryLight },
          { label: 'Activos', value: String(clienteData.prestamosActivos), color: colors.success, bg: colors.successLight },
          { label: 'Pagado', value: formatFullCurrency(clienteData.totalPagado ?? 0), color: colors.secondary, bg: colors.secondaryLight },
          { label: 'Saldo', value: formatFullCurrency(clienteData.totalSaldo ?? 0), color: colors.error, bg: colors.errorLight },
        ])}

        {clienteData.prestamos.map((prestamo) => (
          <View key={prestamo.id} style={[styles.itemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.itemTop}>
              <Text style={[styles.itemTitle, { color: colors.text }]}>Préstamo #{prestamo.id.slice(0, 8)}</Text>
              {renderEstadoBadge(prestamo.estado)}
            </View>
            <View style={styles.itemBreakdown}>
              <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Monto:</Text>
              <Text style={[styles.breakdownValue, { color: colors.text }]}>{formatFullCurrency(prestamo.monto ?? 0)}</Text>
              <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Saldo:</Text>
              <Text style={[styles.breakdownValue, { color: (prestamo.saldo ?? 0) > 0 ? colors.error : colors.success }]}>{formatFullCurrency(prestamo.saldo ?? 0)}</Text>
              <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Mora:</Text>
              <Text style={[styles.breakdownValue, { color: colors.warning }]}>{formatFullCurrency(prestamo.moraAcumulada ?? 0)}</Text>
            </View>
            <View style={styles.itemBreakdown}>
              <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Cuotas:</Text>
              <Text style={[styles.breakdownValue, { color: colors.text }]}>
                {prestamo.cuotasPagadas}/{prestamo.totalCuotas} pagadas
              </Text>
              <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Vencidas:</Text>
              <Text style={[styles.breakdownValue, { color: prestamo.cuotasVencidas > 0 ? colors.error : colors.success }]}>
                {prestamo.cuotasVencidas}
              </Text>
            </View>
            {prestamo.proximaFecha && (
              <Text style={[styles.itemMetaText, { color: colors.textTertiary, marginTop: Spacing.xs }]}>
                Próxima cuota: {formatFecha(prestamo.proximaFecha)}{prestamo.proximaMonto ? ` · ${formatFullCurrency(prestamo.proximaMonto)}` : ''}
              </Text>
            )}

            {/* Pagos */}
            {prestamo.pagos.length > 0 && (
              <View style={[styles.pagosSection, { borderTopColor: colors.border }]}>
                <Text style={[styles.pagosTitle, { color: colors.textSecondary }]}>Pagos</Text>
                {prestamo.pagos.slice(0, 5).map((pago, i) => (
                  <View key={i} style={styles.pagoRow}>
                    <Text style={[styles.pagoFecha, { color: colors.textTertiary }]}>{formatFechaCorta(pago.fecha)}</Text>
                    <Text style={[styles.pagoMonto, { color: colors.text }]}>{formatFullCurrency(pago.total ?? 0)}</Text>
                    {renderMetodoBadge(pago.metodo)}
                  </View>
                ))}
                {prestamo.pagos.length > 5 && (
                  <Text style={[styles.pagoMore, { color: colors.textTertiary }]}>
                    +{prestamo.pagos.length - 5} más
                  </Text>
                )}
              </View>
            )}
          </View>
        ))}
      </View>
    );
  }, [clienteData, colors, renderKpiRow, renderEstadoBadge, renderMetodoBadge]);

  // ─── Render cajas ─────────────────────────────────────────────────────────

  const renderCajas = useCallback(() => {
    if (!cajasData) return null;
    const r = cajasData.resumen;
    return (
      <View>
        {renderKpiRow([
          { label: 'Cobrado', value: formatFullCurrency(r.totalCobrado ?? 0), color: colors.primary, bg: colors.primaryLight },
          { label: 'Efectivo', value: formatFullCurrency(r.totalEfectivo ?? 0), color: colors.success, bg: colors.successLight },
          { label: 'Pagos', value: String(r.cantidadPagos), color: colors.secondary, bg: colors.secondaryLight },
          { label: 'Cajas', value: String(r.cantidadCajas), color: colors.info, bg: colors.infoLight },
        ])}
        {renderKpiRow([
          { label: 'Abiertas', value: String(r.cajasAbiertas), color: colors.warning, bg: colors.warningLight },
          { label: 'Cerradas', value: String(r.cajasCerradas), color: colors.textTertiary, bg: colors.surface },
        ])}

        {/* Resumen por usuario */}
        {cajasData.resumenPorUsuario.length > 0 && (
          <View style={[styles.filterCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Por cobrador</Text>
            {cajasData.resumenPorUsuario.map((u, i) => (
              <View key={u.usuarioId} style={[styles.usuarioRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                <View style={styles.usuarioInfo}>
                  <Text style={[styles.usuarioName, { color: colors.text }]}>{u.nombre}</Text>
                  <Text style={[styles.usuarioMeta, { color: colors.textTertiary }]}>
                    {u.cantidadPagos} pagos · {u.cajasCerradas} cierres
                  </Text>
                </View>
                <Text style={[styles.usuarioTotal, { color: colors.primary }]}>{formatFullCurrency(u.totalCobrado ?? 0)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Pagos recientes */}
        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: Spacing.sm }]}>
          {cajasData.pagos.length} pago{cajasData.pagos.length !== 1 ? 's' : ''}
        </Text>
        {cajasData.pagos.slice(0, 50).map((pago, i) => (
          <View key={i} style={[styles.itemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.itemTop}>
              <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>{pago.cliente}</Text>
              {renderMetodoBadge(pago.metodo)}
            </View>
            <View style={styles.itemMeta}>
              <Text style={[styles.itemMetaText, { color: colors.textTertiary }]}>
                {formatFechaCorta(pago.fecha)} · {pago.cajero}
              </Text>
              <Text style={[styles.itemMonto, { color: colors.text }]}>
                {formatFullCurrency(pago.total ?? 0)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    );
  }, [cajasData, colors, renderKpiRow, renderMetodoBadge]);

  // ─── Render flujo de caja ─────────────────────────────────────────────────

  const renderFlujo = useCallback(() => {
    if (!flujoData) return null;
    return (
      <View>
        {renderKpiRow([
          { label: 'Entradas', value: formatFullCurrency(flujoData.totalEntradas ?? 0), color: colors.success, bg: colors.successLight },
          { label: 'Salidas', value: formatFullCurrency(flujoData.totalSalidas ?? 0), color: colors.error, bg: colors.errorLight },
          { label: 'Neto', value: formatFullCurrency(flujoData.neto ?? 0), color: (flujoData.neto ?? 0) >= 0 ? colors.primary : colors.error, bg: (flujoData.neto ?? 0) >= 0 ? colors.primaryLight : colors.errorLight },
        ])}
        {renderKpiRow([
          { label: 'Pagos', value: formatFullCurrency(flujoData.desgloseEntradas.pagos ?? 0), color: colors.secondary, bg: colors.secondaryLight },
          { label: 'Desembolsos', value: formatFullCurrency(flujoData.desgloseSalidas.desembolsos ?? 0), color: colors.warning, bg: colors.warningLight },
        ])}
        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: Spacing.sm }]}>
          {flujoData.porDia.length} día{flujoData.porDia.length !== 1 ? 's' : ''} con movimiento
        </Text>
        {flujoData.porDia.map((d, i) => (
          <View key={i} style={[styles.itemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.itemTop}>
              <Text style={[styles.itemTitle, { color: colors.text }]}>{formatFecha(d.fecha)}</Text>
              <Badge label={d.neto >= 0 ? 'Positivo' : 'Negativo'} color={d.neto >= 0 ? colors.success : colors.error} bg={d.neto >= 0 ? colors.successLight : colors.errorLight} />
            </View>
            <View style={styles.itemBreakdown}>
              <Text style={[styles.breakdownLabel, { color: colors.success }]}>+{formatCurrencyCompact(d.entradas ?? 0)}</Text>
              <Text style={[styles.breakdownLabel, { color: colors.error }]}>-{formatCurrencyCompact(d.salidas ?? 0)}</Text>
              <Text style={[styles.breakdownLabel, { color: (d.neto ?? 0) >= 0 ? colors.primary : colors.error, fontWeight: '700' }]}>
                = {formatCurrencyCompact(d.neto ?? 0)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    );
  }, [flujoData, colors, renderKpiRow]);

  // ─── Render desempeño cobrador ────────────────────────────────────────────

  const renderCobrador = useCallback(() => {
    if (!desempenoData) return null;
    return (
      <View>
        {renderKpiRow([
          { label: 'Total cobrado', value: formatFullCurrency(desempenoData.totalCobrado ?? 0), color: colors.primary, bg: colors.primaryLight },
          { label: 'Pagos', value: String(desempenoData.cantidadPagos), color: colors.secondary, bg: colors.secondaryLight },
          { label: 'Mora', value: formatFullCurrency(desempenoData.totalMora ?? 0), color: colors.warning, bg: colors.warningLight },
          { label: 'Cobradores', value: String(desempenoData.cobradores.length), color: colors.info, bg: colors.infoLight },
        ])}
        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: Spacing.sm }]}>
          {desempenoData.cobradores.length} cobrador{desempenoData.cobradores.length !== 1 ? 'es' : ''}
        </Text>
        {desempenoData.cobradores.map((c, i) => (
          <View key={i} style={[styles.itemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.itemTop}>
              <Text style={[styles.itemTitle, { color: colors.text }]}>{c.nombre}</Text>
              <Badge label={`${c.cantidadPagos} pagos`} color={colors.primary} bg={colors.primaryLight} />
            </View>
            <View style={styles.itemBreakdown}>
              <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Cobrado:</Text>
              <Text style={[styles.breakdownValue, { color: colors.primary }]}>{formatFullCurrency(c.totalCobrado ?? 0)}</Text>
              <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Días:</Text>
              <Text style={[styles.breakdownValue, { color: colors.text }]}>{c.diasActivos}</Text>
            </View>
            <View style={styles.itemBreakdown}>
              <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Promedio/pago:</Text>
              <Text style={[styles.breakdownValue, { color: colors.text }]}>{formatCurrencyCompact(c.promedioPorPago ?? 0)}</Text>
              <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Promedio/día:</Text>
              <Text style={[styles.breakdownValue, { color: colors.text }]}>{formatCurrencyCompact(c.promedioPorDia ?? 0)}</Text>
            </View>
          </View>
        ))}
      </View>
    );
  }, [desempenoData, colors, renderKpiRow]);

  // ─── Render proyección cuotas ─────────────────────────────────────────────

  const renderProyeccion = useCallback(() => {
    if (!proyeccionData) return null;
    return (
      <View>
        {renderKpiRow([
          { label: 'Préstamos', value: String(proyeccionData.totalPrestamos), color: colors.primary, bg: colors.primaryLight },
          { label: 'Cuotas pend.', value: String(proyeccionData.totalCuotasPendientes), color: colors.secondary, bg: colors.secondaryLight },
          { label: 'Monto total', value: formatFullCurrency(proyeccionData.totalMontoPendiente ?? 0), color: colors.success, bg: colors.successLight },
          { label: 'Vencidas', value: String(proyeccionData.totalVencidas), color: colors.error, bg: colors.errorLight },
        ])}
        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: Spacing.sm }]}>
          Proyección por mes
        </Text>
        {proyeccionData.porMes.map((m, i) => {
          const [y, mo] = m.month.split('-');
          const mesLabel = new Date(parseInt(y), parseInt(mo) - 1).toLocaleDateString('es-DO', { month: 'long', year: 'numeric' });
          return (
            <View key={i} style={[styles.itemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.itemTop}>
                <Text style={[styles.itemTitle, { color: colors.text }]}>{mesLabel}</Text>
                {m.vencidas > 0 && <Badge label={`${m.vencidas} venc.`} color={colors.error} bg={colors.errorLight} />}
              </View>
              <View style={styles.itemBreakdown}>
                <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Cuotas:</Text>
                <Text style={[styles.breakdownValue, { color: colors.text }]}>{m.cantidadCuotas}</Text>
                <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Total:</Text>
                <Text style={[styles.breakdownValue, { color: colors.primary }]}>{formatFullCurrency(m.montoTotal ?? 0)}</Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  }, [proyeccionData, colors, renderKpiRow]);

  // ─── Render data ──────────────────────────────────────────────────────────

  const renderData = useCallback(() => {
    switch (tab) {
      case 'cobros': return renderCobros();
      case 'cartera': return renderCartera();
      case 'estado': return renderEstado();
      case 'cliente': return renderCliente();
      case 'cajas': return renderCajas();
      case 'flujo': return renderFlujo();
      case 'cobrador': return renderCobrador();
      case 'proyeccion': return renderProyeccion();
      default: return null;
    }
  }, [tab, renderCobros, renderCartera, renderEstado, renderCliente, renderCajas, renderFlujo, renderCobrador, renderProyeccion]);

  // ─── Loading skeleton ─────────────────────────────────────────────────────

  if (loading && shouldFetch) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.content}>
          <SkeletonKPIGrid />
          <Skeleton height={120} style={{ marginTop: Spacing.md }} />
          <Skeleton height={80} style={{ marginTop: Spacing.sm }} />
          <Skeleton height={80} style={{ marginTop: Spacing.sm }} />
          <Skeleton height={80} style={{ marginTop: Spacing.sm }} />
        </View>
      </View>
    );
  }

  // ─── Error state ──────────────────────────────────────────────────────────

  if (shouldFetch && activeError) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.content}>
          <EmptyState
            icon="alert-circle-outline"
            title="Error al cargar reporte"
            subtitle={activeError instanceof Error ? activeError.message : 'Error de conexión'}
            actionLabel="Reintentar"
            onAction={handleRefresh}
          />
        </View>
      </View>
    );
  }

  if (!moduloHabilitado('REPORTES') || !tienePermiso('reportes:exportar')) {
    return <SinAcceso />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        ref={listRef}
        data={[0]}
        keyExtractor={() => 'content'}
        renderItem={() => (
          <View>
            {/* Generate button */}
            <TouchableOpacity
              onPress={handleGenerate}
              style={[styles.generateBtn, { backgroundColor: colors.primary }]}
            >
              <Ionicons name="refresh-outline" size={scale(18)} color="#FFFFFF" />
              <Text style={styles.generateBtnText}>Generar reporte</Text>
            </TouchableOpacity>

            {/* Data */}
            {shouldFetch && currentData && !loading ? (
              <View>{renderData()}</View>
            ) : shouldFetch && !loading && !currentData && !activeError ? (
              <EmptyState
                icon="alert-circle-outline"
                title="Sin datos"
                subtitle="No se encontraron datos con los filtros seleccionados"
                actionLabel="Reintentar"
                onAction={handleRefresh}
              />
            ) : !shouldFetch ? (
              <EmptyState
                icon="bar-chart-outline"
                title="Reportes"
                subtitle="Selecciona filtros y genera el reporte"
              />
            ) : null}
          </View>
        )}
        refreshing={isRefetching}
        onRefresh={handleRefresh}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onScroll={(e) => setShowScrollTop(e.nativeEvent.contentOffset.y > 300)}
        scrollEventThrottle={100}
        ListHeaderComponent={
          <View>
            {/* Tabs */}
            <View style={styles.tabsContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
                {TABS.map((t) => {
                  const active = tab === t.id;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      onPress={() => changeTab(t.id)}
                      style={[
                        styles.tab,
                        { borderColor: colors.border },
                        active && { backgroundColor: colors.primary, borderColor: colors.primary },
                      ]}
                    >
                      <Ionicons
                        name={t.icon}
                        size={scale(14)}
                        color={active ? '#FFFFFF' : colors.textSecondary}
                        style={{ marginRight: scale(4) }}
                      />
                      <Text
                        style={[
                          styles.tabText,
                          { color: active ? '#FFFFFF' : colors.textSecondary },
                        ]}
                      >
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              {/* Fade indicator for more tabs */}
              <View pointerEvents="none" style={[styles.tabsFadeRight, { backgroundColor: colors.background }]} />
            </View>

            {/* Filters */}
            {renderFilters()}
          </View>
        }
      />

      {/* Scroll to top */}
      <ScrollToTopButton
        visible={showScrollTop}
        bottom={88}
        onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
      />

      {/* Cliente search modal */}
      <Modal visible={showClienteModal} transparent animationType="slide" onRequestClose={() => setShowClienteModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={[styles.modalOverlay, { backgroundColor: colors.overlay }]} onPress={() => setShowClienteModal(false)}>
            <Pressable style={[styles.modalContent, { backgroundColor: colors.surfaceElevated }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Seleccionar cliente</Text>
                <TouchableOpacity onPress={() => setShowClienteModal(false)} hitSlop={8}>
                  <Ionicons name="close" size={scale(24)} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
              <TextInput
                placeholder="Buscar por nombre o cédula..."
                placeholderTextColor={colors.textTertiary}
                value={clienteSearch}
                onChangeText={setClienteSearch}
                style={[styles.searchInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                autoFocus
              />
              <FlatList
                data={clientes}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => selectCliente({ id: item.id, nombre: `${item.nombre}${item.apellido ? ` ${item.apellido}` : ''}` })}
                    style={[styles.clienteItem, { borderBottomColor: colors.borderLight }]}
                  >
                    <View style={[styles.clienteAvatar, { backgroundColor: colors.primaryLight }]}>
                      <Text style={[styles.clienteAvatarText, { color: colors.primary }]}>
                        {(item.nombre?.[0] ?? '?').toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.clienteItemInfo}>
                      <Text style={[styles.clienteItemName, { color: colors.text }]}>
                        {item.nombre}{item.apellido ? ` ${item.apellido}` : ''}
                      </Text>
                      <Text style={[styles.clienteItemCedula, { color: colors.textTertiary }]}>
                        {item.cedula}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={scale(18)} color={colors.textTertiary} />
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={[styles.emptyText, { color: colors.textTertiary, paddingVertical: Spacing.xl }]}>
                    {clienteSearch ? 'Sin resultados' : 'Escribe para buscar...'}
                  </Text>
                }
              />
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  tabsContainer: { position: 'relative', marginBottom: Spacing.md },
  tabsFadeRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: scale(40),
    opacity: 0.9,
  },
  tabScroll: { marginBottom: 0 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: scale(8),
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginRight: Spacing.sm,
  },
  tabText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: scale(44),
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  generateBtnText: { color: '#FFFFFF', fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  filterCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  filterLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, marginBottom: Spacing.xs, marginTop: Spacing.sm },
  filterRow: { flexDirection: 'row', gap: Spacing.sm },
  filterHalf: { flex: 1 },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, marginBottom: Spacing.sm },
  kpiScroll: { marginBottom: Spacing.sm },
  itemCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  itemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: scale(2) },
  itemTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, flex: 1, marginRight: Spacing.xs },
  itemSub: { fontSize: FontSize.xs, marginBottom: scale(4) },
  itemMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: scale(2) },
  itemMetaText: { fontSize: FontSize.xs },
  itemMonto: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  itemBreakdown: { flexDirection: 'row', alignItems: 'center', gap: scale(4), marginTop: scale(4), flexWrap: 'wrap' },
  breakdownLabel: { fontSize: FontSize.xs },
  breakdownValue: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, marginRight: Spacing.sm },
  emptyText: { fontSize: FontSize.sm, textAlign: 'center' },
  clienteSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    height: scale(44),
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
    gap: Spacing.sm,
  },
  clienteSelectorText: { fontSize: FontSize.sm, flex: 1 },
  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
    maxHeight: '80%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  searchInput: {
    height: scale(44),
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.md,
    marginBottom: Spacing.md,
  },
  clienteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    gap: Spacing.sm,
  },
  clienteAvatar: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    justifyContent: 'center',
    alignItems: 'center',
  },
  clienteAvatarText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  clienteItemInfo: { flex: 1 },
  clienteItemName: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  clienteItemCedula: { fontSize: FontSize.xs },
  pagosSection: { marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1 },
  pagosTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, marginBottom: Spacing.xs },
  pagoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: scale(2) },
  pagoFecha: { fontSize: FontSize.xs, width: scale(80) },
  pagoMonto: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, flex: 1, textAlign: 'right', marginRight: Spacing.xs },
  pagoMore: { fontSize: FontSize.xs, marginTop: scale(2) },
  usuarioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  usuarioInfo: { flex: 1 },
  usuarioName: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  usuarioMeta: { fontSize: FontSize.xs, marginTop: scale(1) },
  usuarioTotal: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
});
