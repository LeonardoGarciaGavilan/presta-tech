import { useCallback, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { METODO_PAGO_LABELS } from '@/constants/pagos.constants';
import { useCobros, useCarteraVencida, useEstadoGeneral, useReporteCliente, useReporteCajas } from '@/hooks/use-reportes';
import { useClientes } from '@/hooks/use-clientes';
import { Skeleton, SkeletonKPIGrid } from '@/components/ui/skeleton';
import { AppInput } from '@/components/ui/app-input';
import DatePickerField from '@/components/ui/date-picker-field';
import { useToast } from '@/components/ui/toast';
import { useTheme } from '@/components/ui/theme-provider';
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

const ESTADO_COLORS: Record<string, string> = {
  ACTIVO: '#16A34A',
  ATRASADO: '#DC2626',
  PAGADO: '#2563EB',
  CANCELADO: '#6B7280',
  SOLICITADO: '#D97706',
};

const METODO_COLORS: Record<string, string> = {
  EFECTIVO: '#16A34A',
  TRANSFERENCIA: '#2563EB',
  TARJETA: '#7C3AED',
  CHEQUE: '#D97706',
};

type TabId = 'cobros' | 'cartera' | 'estado' | 'cliente' | 'cajas';

const TABS: { id: TabId; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'cobros', label: 'Cobros', icon: 'cash-outline' },
  { id: 'cartera', label: 'Cartera', icon: 'warning-outline' },
  { id: 'estado', label: 'Estado', icon: 'stats-chart-outline' },
  { id: 'cliente', label: 'Cliente', icon: 'person-outline' },
  { id: 'cajas', label: 'Cajas', icon: 'archive-outline' },
];

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  color,
  bg,
}: {
  label: string;
  value: string;
  color: string;
  bg: string;
}) {
  return (
    <View style={[styles.kpiCard, { backgroundColor: bg }]}>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      <Text style={[styles.kpiLabel, { color }]}>{label}</Text>
    </View>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: color + '18' }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ReportesScreen() {
  const { colorScheme, colors } = useTheme();
  const { showToast } = useToast();

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

  // Query control
  const [shouldFetch, setShouldFetch] = useState(false);

  // Client search
  const { data: clientesData } = useClientes(
    useMemo(() => (clienteSearch ? { search: clienteSearch, limit: 20 } : { limit: 20 }), [clienteSearch]),
  );
  const clientes = clientesData?.data ?? [];

  // Cobros query
  const cobrosFilters = useMemo(() => ({ desde, hasta, provincia: provincia || undefined }), [desde, hasta, provincia]);
  const { data: cobrosData, isLoading: cobrosLoading, isRefetching: cobrosRefetching, refetch: refetchCobros } = useCobros(cobrosFilters, shouldFetch && tab === 'cobros');

  // Cartera vencida query
  const carteraFilters = useMemo(() => ({ provincia: provincia || undefined }), [provincia]);
  const { data: carteraData, isLoading: carteraLoading, isRefetching: carteraRefetching, refetch: refetchCartera } = useCarteraVencida(carteraFilters, shouldFetch && tab === 'cartera');

  // Estado general query
  const estadoFilters = useMemo(() => ({ provincia: provincia || undefined }), [provincia]);
  const { data: estadoData, isLoading: estadoLoading, isRefetching: estadoRefetching, refetch: refetchEstado } = useEstadoGeneral(estadoFilters, shouldFetch && tab === 'estado');

  // Cliente reporte query
  const { data: clienteData, isLoading: clienteLoading, isRefetching: clienteRefetching, refetch: refetchCliente } = useReporteCliente(clienteSelected?.id ?? null, shouldFetch && tab === 'cliente' && !!clienteSelected);

  // Cajas query
  const cajasFilters = useMemo(() => ({ desde, hasta, usuarioId: usuarioId || undefined }), [desde, hasta, usuarioId]);
  const { data: cajasData, isLoading: cajasLoading, isRefetching: cajasRefetching, refetch: refetchCajas } = useReporteCajas(cajasFilters, shouldFetch && tab === 'cajas');

  const loading = cobrosLoading || carteraLoading || estadoLoading || clienteLoading || cajasLoading;
  const isRefetching = cobrosRefetching || carteraRefetching || estadoRefetching || clienteRefetching || cajasRefetching;

  const currentData = useMemo(() => {
    switch (tab) {
      case 'cobros': return cobrosData as any;
      case 'cartera': return carteraData as any;
      case 'estado': return estadoData as any;
      case 'cliente': return clienteData as any;
      case 'cajas': return cajasData as any;
      default: return null;
    }
  }, [tab, cobrosData, carteraData, estadoData, clienteData, cajasData]);

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
      }
    }, 0);
  }, [tab, clienteSelected, showToast, refetchCobros, refetchCartera, refetchEstado, refetchCliente, refetchCajas]);

  // ─── Refresh ──────────────────────────────────────────────────────────────

  const handleRefresh = useCallback(() => {
    if (!shouldFetch) return;
    switch (tab) {
      case 'cobros': refetchCobros(); break;
      case 'cartera': refetchCartera(); break;
      case 'estado': refetchEstado(); break;
      case 'cliente': refetchCliente(); break;
      case 'cajas': refetchCajas(); break;
    }
  }, [tab, shouldFetch, refetchCobros, refetchCartera, refetchEstado, refetchCliente, refetchCajas]);

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
    const color = ESTADO_COLORS[estado] ?? '#6B7280';
    return <Badge label={estado} color={color} />;
  }, []);

  // ─── Top filters ──────────────────────────────────────────────────────────

  const renderFilters = useCallback(() => {
    switch (tab) {
      case 'cobros':
      case 'cajas':
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
          </View>
        );
      case 'cartera':
      case 'estado':
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
              <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
              <Text style={[styles.clienteSelectorText, { color: clienteSelected ? colors.text : colors.textTertiary }]}>
                {clienteSelected ? clienteSelected.nombre : 'Buscar cliente...'}
              </Text>
              {clienteSelected && (
                <TouchableOpacity onPress={() => setClienteSelected(null)} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
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
          { label: 'Total cobrado', value: formatFullCurrency(cobrosData.totalCobrado), color: colors.primary, bg: colors.primaryLight },
          { label: 'Capital', value: formatFullCurrency(cobrosData.totalCapital), color: colors.secondary, bg: colors.secondaryLight },
          { label: 'Interés', value: formatFullCurrency(cobrosData.totalInteres), color: colors.warning, bg: colors.warningLight },
          { label: 'Mora', value: formatFullCurrency(cobrosData.totalMora), color: colors.error, bg: colors.errorLight },
        ])}
        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: Spacing.sm }]}>
          {cobrosData.totalRegistros} cobro{cobrosData.totalRegistros !== 1 ? 's' : ''}
        </Text>
        {cobrosData.pagos.map((pago, i) => (
          <View key={i} style={[styles.itemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.itemTop}>
              <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>{pago.cliente}</Text>
              <Badge label={METODO_PAGO_LABELS[pago.metodo] ?? pago.metodo} color={METODO_COLORS[pago.metodo] ?? '#6B7280'} />
            </View>
            <Text style={[styles.itemSub, { color: colors.textSecondary }]}>
              {pago.cedula} · {pago.provincia}{pago.municipio ? `, ${pago.municipio}` : ''}
            </Text>
            <View style={styles.itemMeta}>
              <Text style={[styles.itemMetaText, { color: colors.textTertiary }]}>
                {formatFechaCorta(pago.fecha)} · {pago.cobrador}
              </Text>
              <Text style={[styles.itemMonto, { color: colors.text }]}>
                {formatFullCurrency(pago.total)}
              </Text>
            </View>
            <View style={styles.itemBreakdown}>
              <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>
                Cap: {formatCurrencyCompact(pago.capital)} | Int: {formatCurrencyCompact(pago.interes)} | Mora: {formatCurrencyCompact(pago.mora)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    );
  }, [cobrosData, colors, renderKpiRow]);

  // ─── Render cartera ──────────────────────────────────────────────────────

  const renderCartera = useCallback(() => {
    if (!carteraData) return null;
    return (
      <View>
        {renderKpiRow([
          { label: 'Saldo vencido', value: formatFullCurrency(carteraData.totalSaldoVencido), color: colors.error, bg: colors.errorLight },
          { label: 'Mora total', value: formatFullCurrency(carteraData.totalMora), color: colors.warning, bg: colors.warningLight },
          { label: 'Préstamos', value: String(carteraData.totalRegistros), color: colors.primary, bg: colors.primaryLight },
        ])}
        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: Spacing.sm }]}>
          {carteraData.totalRegistros} préstamo{carteraData.totalRegistros !== 1 ? 's' : ''} vencido{carteraData.totalRegistros !== 1 ? 's' : ''}
        </Text>
        {carteraData.prestamos.map((item, i) => (
          <View key={i} style={[styles.itemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.itemTop}>
              <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>{item.cliente}</Text>
              <Badge label={`${item.diasMaxAtraso}d`} color={item.diasMaxAtraso > 30 ? colors.error : colors.warning} />
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
              <Text style={[styles.breakdownValue, { color: colors.text }]}>{formatFullCurrency(item.montoOriginal)}</Text>
              <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Saldo:</Text>
              <Text style={[styles.breakdownValue, { color: colors.error }]}>{formatFullCurrency(item.saldoPendiente)}</Text>
              <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Mora:</Text>
              <Text style={[styles.breakdownValue, { color: colors.warning }]}>{formatFullCurrency(item.moraAcumulada)}</Text>
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
          { label: 'Cartera activa', value: formatFullCurrency(r.totalCartera), color: colors.primary, bg: colors.primaryLight },
          { label: 'Desembolsado', value: formatFullCurrency(r.totalDesembolsado), color: colors.secondary, bg: colors.secondaryLight },
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
              <Text style={[styles.breakdownValue, { color: colors.text }]}>{formatFullCurrency(item.montoOriginal)}</Text>
              <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Saldo:</Text>
              <Text style={[styles.breakdownValue, { color: colors.error }]}>{formatFullCurrency(item.saldoPendiente)}</Text>
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
          { label: 'Pagado', value: formatFullCurrency(clienteData.totalPagado), color: colors.secondary, bg: colors.secondaryLight },
          { label: 'Saldo', value: formatFullCurrency(clienteData.totalSaldo), color: colors.error, bg: colors.errorLight },
        ])}

        {clienteData.prestamos.map((prestamo) => (
          <View key={prestamo.id} style={[styles.itemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.itemTop}>
              <Text style={[styles.itemTitle, { color: colors.text }]}>Préstamo #{prestamo.id.slice(0, 8)}</Text>
              {renderEstadoBadge(prestamo.estado)}
            </View>
            <View style={styles.itemBreakdown}>
              <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Monto:</Text>
              <Text style={[styles.breakdownValue, { color: colors.text }]}>{formatFullCurrency(prestamo.monto)}</Text>
              <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Saldo:</Text>
              <Text style={[styles.breakdownValue, { color: prestamo.saldo > 0 ? colors.error : colors.success }]}>{formatFullCurrency(prestamo.saldo)}</Text>
              <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Mora:</Text>
              <Text style={[styles.breakdownValue, { color: colors.warning }]}>{formatFullCurrency(prestamo.moraAcumulada)}</Text>
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
                    <Text style={[styles.pagoMonto, { color: colors.text }]}>{formatFullCurrency(pago.total)}</Text>
                    <Badge label={METODO_PAGO_LABELS[pago.metodo] ?? pago.metodo} color={METODO_COLORS[pago.metodo] ?? '#6B7280'} />
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
  }, [clienteData, colors, renderKpiRow, renderEstadoBadge]);

  // ─── Render cajas ─────────────────────────────────────────────────────────

  const renderCajas = useCallback(() => {
    if (!cajasData) return null;
    const r = cajasData.resumen;
    return (
      <View>
        {renderKpiRow([
          { label: 'Cobrado', value: formatFullCurrency(r.totalCobrado), color: colors.primary, bg: colors.primaryLight },
          { label: 'Efectivo', value: formatFullCurrency(r.totalEfectivo), color: colors.success, bg: colors.successLight },
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
                <Text style={[styles.usuarioTotal, { color: colors.primary }]}>{formatFullCurrency(u.totalCobrado)}</Text>
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
              <Badge label={METODO_PAGO_LABELS[pago.metodo] ?? pago.metodo} color={METODO_COLORS[pago.metodo] ?? '#6B7280'} />
            </View>
            <View style={styles.itemMeta}>
              <Text style={[styles.itemMetaText, { color: colors.textTertiary }]}>
                {formatFechaCorta(pago.fecha)} · {pago.cajero}
              </Text>
              <Text style={[styles.itemMonto, { color: colors.text }]}>
                {formatFullCurrency(pago.total)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    );
  }, [cajasData, colors, renderKpiRow]);

  // ─── Render data ──────────────────────────────────────────────────────────

  const renderData = useCallback(() => {
    switch (tab) {
      case 'cobros': return renderCobros();
      case 'cartera': return renderCartera();
      case 'estado': return renderEstado();
      case 'cliente': return renderCliente();
      case 'cajas': return renderCajas();
      default: return null;
    }
  }, [tab, renderCobros, renderCartera, renderEstado, renderCliente, renderCajas]);

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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={[0]}
        keyExtractor={() => 'content'}
        renderItem={() => (
          <View>
            {/* Generate button */}
            <TouchableOpacity
              onPress={handleGenerate}
              style={[styles.generateBtn, { backgroundColor: colors.primary }]}
            >
              <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
              <Text style={styles.generateBtnText}>Generar reporte</Text>
            </TouchableOpacity>

            {/* Data */}
            {shouldFetch && currentData && !loading ? (
              <View>{renderData()}</View>
            ) : shouldFetch && !loading && !currentData ? (
              <View style={styles.emptyState}>
                <Ionicons name="alert-circle-outline" size={48} color={colors.textTertiary} />
                <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                  No se encontraron datos
                </Text>
              </View>
            ) : !shouldFetch ? (
              <View style={styles.emptyState}>
                <Ionicons name="bar-chart-outline" size={48} color={colors.textTertiary} />
                <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                  Selecciona filtros y genera el reporte
                </Text>
              </View>
            ) : null}
          </View>
        )}
        refreshing={isRefetching}
        onRefresh={handleRefresh}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {/* Tabs */}
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
                      size={14}
                      color={active ? '#FFFFFF' : colors.textSecondary}
                      style={{ marginRight: 4 }}
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

            {/* Filters */}
            {renderFilters()}
          </View>
        }
      />

      {/* Cliente search modal */}
      <Modal visible={showClienteModal} transparent animationType="slide" onRequestClose={() => setShowClienteModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={[styles.modalOverlay, { backgroundColor: colors.overlay }]} onPress={() => setShowClienteModal(false)}>
            <Pressable style={[styles.modalContent, { backgroundColor: colors.surfaceElevated }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Seleccionar cliente</Text>
                <TouchableOpacity onPress={() => setShowClienteModal(false)} hitSlop={8}>
                  <Ionicons name="close" size={24} color={colors.textTertiary} />
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
                    <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
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
  tabScroll: { marginBottom: Spacing.md },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginRight: Spacing.sm,
  },
  tabText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
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
  filterRow: { flexDirection: 'row', gap: Spacing.sm },
  filterHalf: { flex: 1 },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, marginBottom: Spacing.sm },
  kpiScroll: { marginBottom: Spacing.sm },
  kpiCard: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    marginRight: Spacing.sm,
    minWidth: 100,
    alignItems: 'center',
  },
  kpiValue: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  kpiLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.medium, marginTop: 1 },
  itemCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  itemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  itemTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, flex: 1, marginRight: Spacing.xs },
  itemSub: { fontSize: FontSize.xs, marginBottom: 4 },
  itemMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  itemMetaText: { fontSize: FontSize.xs },
  itemMonto: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  itemBreakdown: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, flexWrap: 'wrap' },
  breakdownLabel: { fontSize: FontSize.xs },
  breakdownValue: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, marginRight: Spacing.sm },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: BorderRadius.sm,
  },
  badgeText: { fontSize: 10, fontWeight: FontWeight.bold },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl * 2, gap: Spacing.sm },
  emptyText: { fontSize: FontSize.sm, textAlign: 'center' },
  clienteSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
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
    height: 44,
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
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clienteAvatarText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  clienteItemInfo: { flex: 1 },
  clienteItemName: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  clienteItemCedula: { fontSize: FontSize.xs },
  pagosSection: { marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1 },
  pagosTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, marginBottom: Spacing.xs },
  pagoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: 2 },
  pagoFecha: { fontSize: FontSize.xs, width: 80 },
  pagoMonto: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, flex: 1, textAlign: 'right', marginRight: Spacing.xs },
  pagoMore: { fontSize: FontSize.xs, marginTop: 2 },
  usuarioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  usuarioInfo: { flex: 1 },
  usuarioName: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  usuarioMeta: { fontSize: FontSize.xs, marginTop: 1 },
  usuarioTotal: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
});
