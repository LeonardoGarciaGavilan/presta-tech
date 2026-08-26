import { useCallback, useMemo, useState } from 'react';
import { FlatList, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { BorderRadius,
  Colors,
  FontSize,
  FontWeight,
  Shadows,
  Spacing, scale} from '@/constants/theme';
import { useAuditoria } from '@/hooks/use-auditoria';
import { useEmpresas } from '@/hooks/use-empresas';
import { useAuthStore } from '@/store/auth.store';
import type { Auditoria, AuditoriaFilters } from '@/types/auditoria.types';
import { formatCurrency, formatDateTime } from '@/utils/formatters';
import SearchBar from '@/components/ui/search-bar';
import PickerField from '@/components/ui/picker-field';
import DatePickerField from '@/components/ui/date-picker-field';
import { Skeleton } from '@/components/ui/skeleton';
import EmptyState from '@/components/ui/empty-state';
import { useTheme } from '@/components/ui/theme-provider';
import { usePermisos } from '@/permisos/use-permisos';
import SinAcceso from '@/components/permisos/sin-acceso';

// ──────────────────────────────────────────
// Color palette
// ──────────────────────────────────────────

const TIPO_META: Record<string, { bg: string; text: string; icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  AUTH:         { bg: '#F3E8FF', text: '#7C3AED', icon: 'key-outline',       label: 'Auth' },
  CAJA:         { bg: '#DBEAFE', text: '#2563EB', icon: 'cash-outline', label: 'Caja' },
  PAGO:         { bg: '#D1FAE5', text: '#059669', icon: 'card-outline',      label: 'Pago' },
  PRESTAMO:     { bg: '#FFF7ED', text: '#D97706', icon: 'trending-up-outline', label: 'Préstamo' },
  CONFIGURACION: { bg: '#F3F4F6', text: '#6B7280', icon: 'settings-outline', label: 'Config' },
};

const NIVEL_META: Record<string, { bg: string; text: string }> = {
  INFO:  { bg: '#DBEAFE', text: '#2563EB' },
  WARN:  { bg: '#FEF3C7', text: '#D97706' },
  ERROR: { bg: '#FEE2E2', text: '#DC2626' },
};

const TIPO_OPTIONS = ['AUTH', 'CAJA', 'PAGO', 'PRESTAMO', 'CONFIGURACION'];

function getTipoMeta(tipo: string) {
  return TIPO_META[tipo] || { bg: '#F3F4F6', text: '#6B7280', icon: 'ellipse-outline' as keyof typeof Ionicons.glyphMap, label: tipo };
}

function getNivelMeta(nivel?: string | null) {
  return NIVEL_META[nivel ?? ''] || NIVEL_META.INFO;
}

// ──────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayISO() { return toISODate(new Date()); }
function yesterdayISO() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toISODate(d);
}
function last7ISO() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return toISODate(d);
}

function renderJsonRows(
  data: Record<string, unknown>,
  accentColor: string,
  colors: typeof Colors.light,
) {
  if (!data || typeof data !== 'object') {
    return (
      <Text style={[detalleStyles.jsonValue, { color: accentColor }]}>
        {String(data)}
      </Text>
    );
  }

  return Object.entries(data).map(([key, value]) => {
    const displayValue =
      typeof value === 'object' && value !== null
        ? JSON.stringify(value)
        : String(value ?? '');

    return (
      <View key={key} style={[detalleStyles.jsonRow, { borderBottomColor: colors.borderLight }]}>
        <Text style={[detalleStyles.jsonKey, { color: colors.textTertiary }]}>{key}</Text>
        <Text style={[detalleStyles.jsonValue, { color: accentColor }]} numberOfLines={3}>
          {displayValue}
        </Text>
      </View>
    );
  });
}

const QUICK_FILTERS: Record<string, { label: string; desde: () => string; hasta: () => string }> = {
  hoy:   { label: 'Hoy',       desde: todayISO, hasta: todayISO },
  ayer:  { label: 'Ayer',      desde: yesterdayISO, hasta: yesterdayISO },
  '7d':  { label: '7 días',    desde: last7ISO, hasta: todayISO },
};

// ──────────────────────────────────────────
// AuditoriaScreen
// ──────────────────────────────────────────

export default function AuditoriaScreen() {
  const { colorScheme, colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.rol === 'SUPERADMIN';
  const { moduloHabilitado, tienePermiso } = usePermisos();

  // ---- server-side filters ----
  const [filters, setFilters] = useState<AuditoriaFilters>({});

  // ---- advanced-filter form (not applied until "Aplicar") ----
  const [formTipo, setFormTipo] = useState('');
  const [formDesde, setFormDesde] = useState('');
  const [formHasta, setFormHasta] = useState('');
  const [formEmpresaId, setFormEmpresaId] = useState('');

  // ---- quick-filter tracking ----
  const [activeQuick, setActiveQuick] = useState<string | null>(null);

  // ---- search (client-side) ----
  const [search, setSearch] = useState('');

  // ---- show advanced filters ----
  const [showFilters, setShowFilters] = useState(false);

  // ---- detail modal ----
  const [selected, setSelected] = useState<Auditoria | null>(null);
  const [showDatos, setShowDatos] = useState(false);
  const [datosItem, setDatosItem] = useState<Auditoria | null>(null);

  // ---- data ----
  const { data, isLoading, isRefetching, refetch, isError, error } = useAuditoria(filters);
  const { data: empresas } = useEmpresas();

  // ---- empresa lookup (name → id) ----
  const empresaOptions = useMemo(() => {
    if (!empresas) return [];
    return empresas.map((e) => e.nombre);
  }, [empresas]);

  const empresaNameById = useMemo(() => {
    if (!empresas) return {};
    return Object.fromEntries(empresas.map((e) => [e.id, e.nombre]));
  }, [empresas]);

  const handleEmpresaSelect = useCallback(
    (nombre: string) => {
      const found = empresas?.find((e) => e.nombre === nombre);
      setFormEmpresaId(found?.id ?? '');
    },
    [empresas],
  );

  // ---- local search filter ----
  const filtered = useMemo(() => {
    if (!data) return [];
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(
      (i) =>
        i.descripcion?.toLowerCase().includes(q) ||
        i.tipo?.toLowerCase().includes(q) ||
        i.accion?.toLowerCase().includes(q) ||
        i.usuario?.nombre?.toLowerCase().includes(q) ||
        i.empresa?.nombre?.toLowerCase().includes(q),
    );
  }, [data, search]);

  // ---- KPIs ----
  const kpis = useMemo(() => {
    if (!data) return null;
    return {
      total: data.length,
      pagos: data.filter((d) => d.tipo === 'PAGO').length,
      auth: data.filter((d) => d.tipo === 'AUTH').length,
      prestamos: data.filter((d) => d.tipo === 'PRESTAMO').length,
      cajas: data.filter((d) => d.tipo === 'CAJA').length,
    };
  }, [data]);

  // ---- actions ----
  const applyQuick = useCallback((key: string) => {
    const qf = QUICK_FILTERS[key];
    if (!qf) return;
    setActiveQuick(key);
    setFormDesde('');
    setFormHasta('');
    setFilters((prev) => ({ ...prev, desde: qf.desde(), hasta: qf.hasta() }));
  }, []);

  const applyAdvanced = useCallback(() => {
    setActiveQuick(null);
    const next: AuditoriaFilters = {};
    if (formTipo) next.tipo = formTipo;
    if (formDesde) next.desde = formDesde;
    if (formHasta) next.hasta = formHasta;
    if (isSuperAdmin && formEmpresaId) next.empresaId = formEmpresaId;
    setFilters(next);
    setShowFilters(false);
  }, [formTipo, formDesde, formHasta, formEmpresaId, isSuperAdmin]);

  const clearAll = useCallback(() => {
    setActiveQuick(null);
    setFormTipo('');
    setFormDesde('');
    setFormHasta('');
    setFormEmpresaId('');
    setFilters({});
    setSearch('');
    setShowFilters(false);
  }, []);

  const openDetail = useCallback((item: Auditoria) => setSelected(item), []);
  const closeDetail = useCallback(() => setSelected(null), []);

  // ---- KPI data ----
  const kpiItems = useMemo(() => {
    if (!kpis) return [];
    const items: { label: string; value: number; bg: string; text: string }[] = [
      { label: 'Total',  value: kpis.total,    bg: colors.kpiBackground,       text: colors.text },
      { label: 'Pagos',  value: kpis.pagos,    bg: colors.successLight,        text: colors.success },
      { label: 'Auth',   value: kpis.auth,     bg: '#F3E8FF',                  text: '#7C3AED' },
      { label: 'Prést.', value: kpis.prestamos, bg: colors.warningLight,       text: colors.warning },
      { label: 'Cajas',  value: kpis.cajas,    bg: colors.primaryLight,        text: colors.primary },
    ];
    if (isSuperAdmin) {
      items.push({
        label: 'Empresas',
        value: empresas?.length ?? 0,
        bg: colors.infoLight,
        text: colors.info,
      });
    }
    return items;
  }, [kpis, isSuperAdmin, empresas, colors]);

  // ---- render helpers ----
  const renderItem = useCallback(
    ({ item }: { item: Auditoria }) => {
      const tMeta = getTipoMeta(item.tipo);
      const nMeta = getNivelMeta(item.nivel);
      return (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => openDetail(item)}
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          accessibilityRole="button"
          accessibilityLabel={`Registro de auditoría: ${item.accion}, tipo ${item.tipo}, ${item.usuario?.nombre || 'sin usuario'}`}
          accessibilityHint="Toca para ver detalles"
        >
          <View style={styles.cardTop}>
            <View style={styles.cardTopLeft}>
              <View style={[styles.tipoDot, { backgroundColor: tMeta.bg }]}>
                <Ionicons name={tMeta.icon} size={scale(14)} color={tMeta.text} />
              </View>
              <Text style={[styles.accion, { color: colors.text }]} numberOfLines={1}>
                {item.accion}
              </Text>
            </View>
            <View style={[styles.nivelBadge, { backgroundColor: nMeta.bg }]}>
              <Text style={[styles.nivelText, { color: nMeta.text }]}>
                {item.nivel || 'INFO'}
              </Text>
            </View>
          </View>

          {item.descripcion ? (
            <Text style={[styles.desc, { color: colors.textSecondary }]} numberOfLines={1}>
              {item.descripcion}
            </Text>
          ) : null}

          <View style={styles.cardMeta}>
            {item.usuario?.nombre ? (
              <Text style={[styles.metaText, { color: colors.textTertiary }]}>
                {item.usuario.nombre}
              </Text>
            ) : null}
            <Text style={[styles.metaText, { color: colors.textTertiary }]}>
              {formatDateTime(item.createdAt)}
            </Text>
            {item.ip ? (
              <Text style={[styles.metaText, { color: colors.textTertiary }]}>
                {item.ip}
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>
      );
    },
    [colors, openDetail],
  );

  // ---- loading ----
  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.content}>
          <Skeleton height={48} style={{ marginBottom: Spacing.md }} />
          <Skeleton height={40} style={{ marginBottom: Spacing.md }} />
          <View style={styles.chipRow}>
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} width={scale(60)} height={scale(28)} borderRadius={BorderRadius.full} />
            ))}
          </View>
          <Skeleton height={80} style={{ marginBottom: Spacing.md }} />
          <Skeleton height={90} style={{ marginBottom: Spacing.sm }} />
          <Skeleton height={90} style={{ marginBottom: Spacing.sm }} />
          <Skeleton height={90} style={{ marginBottom: Spacing.sm }} />
        </View>
      </View>
    );
  }

  if (!moduloHabilitado('AUDITORIA') || !tienePermiso('auditoria:ver')) {
    return <SinAcceso />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshing={isRefetching}
        onRefresh={refetch}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            {/* Search */}
            <SearchBar
              value={search}
              onSearch={setSearch}
              placeholder="Buscar en registros…"
            />

            {/* Quick chips + filter toggle */}
            <View style={styles.chipRow}>
              {Object.entries(QUICK_FILTERS).map(([key, qf]) => {
                const active = activeQuick === key;
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => applyQuick(key)}
                    style={[
                      styles.chip,
                      {
                        borderColor: active ? colors.primary : colors.border,
                        backgroundColor: active ? colors.primary : 'transparent',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: active ? '#FFFFFF' : colors.textSecondary },
                      ]}
                    >
                      {qf.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                onPress={() => setShowFilters((p) => !p)}
                style={[styles.chip, { borderColor: colors.border }]}
              >
                <Ionicons
                  name="options-outline"
                  size={scale(16)}
                  color={colors.textSecondary}
                />
                <Text style={[styles.chipText, { color: colors.textSecondary, marginLeft: scale(4) }]}>
                  Filtros
                </Text>
              </TouchableOpacity>
            </View>

            {/* Advanced filters */}
            {showFilters && (
              <View
                style={[
                  styles.filterCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.filterTitle, { color: colors.text }]}>
                  Filtros avanzados
                </Text>

                {isSuperAdmin && (
                  <PickerField
                    label="Empresa"
                    value={formEmpresaId ? empresaNameById[formEmpresaId] : undefined}
                    options={empresaOptions}
                    onSelect={handleEmpresaSelect}
                    placeholder="Todas las empresas"
                  />
                )}

                <PickerField
                  label="Tipo"
                  value={formTipo || undefined}
                  options={TIPO_OPTIONS}
                  onSelect={(v) => setFormTipo(v)}
                  placeholder="Todos"
                />

                <View style={styles.filterRow}>
                  <View style={styles.filterHalf}>
                    <DatePickerField
                      label="Desde"
                      value={formDesde}
                      onChange={setFormDesde}
                    />
                  </View>
                  <View style={styles.filterHalf}>
                    <DatePickerField
                      label="Hasta"
                      value={formHasta}
                      onChange={setFormHasta}
                    />
                  </View>
                </View>

                <View style={styles.filterActions}>
                  <TouchableOpacity
                    onPress={clearAll}
                    style={[styles.filterBtn, { backgroundColor: colors.borderLight }]}
                  >
                    <Text style={[styles.filterBtnText, { color: colors.textSecondary }]}>
                      Limpiar
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={applyAdvanced}
                    style={[styles.filterBtn, { backgroundColor: colors.primary }]}
                  >
                    <Text style={[styles.filterBtnText, { color: '#FFFFFF' }]}>
                      Aplicar
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* KPIs */}
            {kpiItems.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.kpiScroll}
                contentContainerStyle={styles.kpiScrollContent}
              >
                {kpiItems.map((kpi) => (
                  <View
                    key={kpi.label}
                    style={[styles.kpiCard, { backgroundColor: kpi.bg }]}
                  >
                    <Text style={[styles.kpiValue, { color: kpi.text }]}>
                      {kpi.value}
                    </Text>
                    <Text style={[styles.kpiLabel, { color: kpi.text }]}>
                      {kpi.label}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}

            {/* Results count */}
            {!isError && data && (
              <Text style={[styles.resultCount, { color: colors.textTertiary }]}>
                {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
                {search.trim()
                  ? ` de ${data.length}`
                  : ''}
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={
          isError ? (
            <EmptyState
              title="Error al cargar auditoría"
              subtitle={
                error instanceof Error
                  ? `${error.message}`
                  : 'No se pudieron obtener los registros. Verifica tu conexión.'
              }
              icon="cloud-offline-outline"
              actionLabel="Reintentar"
              onAction={refetch}
            />
          ) : (
            <EmptyState
              title="No hay registros de auditoría"
              subtitle={search.trim()
                ? `No se encontraron resultados para "${search}"`
                : 'No se encontraron registros para los filtros seleccionados.'}
              icon="document-text-outline"
              actionLabel={search.trim() ? undefined : 'Limpiar filtros'}
              onAction={search.trim() ? undefined : clearAll}
            />
          )
        }
      />

      {/* Detail modal */}
      <Modal
        visible={!!selected}
        transparent
        animationType="slide"
        onRequestClose={closeDetail}
      >
        <Pressable
          style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}
          onPress={closeDetail}
        >
          <Pressable
            style={[styles.modalContent, { backgroundColor: colors.surfaceElevated }]}
            onPress={(e) => e.stopPropagation()}
          >
            {selected && <DetalleContent item={selected} colors={colors} onClose={closeDetail} onVerDatos={() => { setDatosItem(selected); setSelected(null); setShowDatos(true); }} />}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal de datos adicionales */}
      <Modal
        visible={showDatos}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDatos(false)}
      >
        <Pressable
          style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}
          onPress={() => setShowDatos(false)}
        >
          <Pressable
            style={[styles.modalContent, { backgroundColor: colors.surfaceElevated }]}
            onPress={(e) => e.stopPropagation()}
          >
            {datosItem && <DatosContent item={datosItem} colors={colors} onClose={() => { setDatosItem(null); setShowDatos(false); }} />}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ──────────────────────────────────────────
// DetalleContent
// ──────────────────────────────────────────

function DetalleContent({
  item,
  colors,
  onClose,
  onVerDatos,
}: {
  item: Auditoria;
  colors: typeof Colors.light;
  onClose: () => void;
  onVerDatos: () => void;
}) {
  const [showExtra, setShowExtra] = useState(false);
  const tMeta = getTipoMeta(item.tipo);
  const nMeta = getNivelMeta(item.nivel);

  const row = (label: string, value: React.ReactNode) => (
    <View style={[detalleStyles.row, { borderBottomColor: colors.border }]}>
      <Text style={[detalleStyles.label, { color: colors.textTertiary }]}>{label}</Text>
      <View style={detalleStyles.valueWrap}>{typeof value === 'string' ? <Text style={[detalleStyles.value, { color: colors.text }]}>{value}</Text> : value}</View>
    </View>
  );

  const badge = (bg: string, text: string, label: string) => (
    <View style={[detalleStyles.badge, { backgroundColor: bg }]}>
      <Text style={[detalleStyles.badgeText, { color: text }]}>{label}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      {/* ZONA 1: Header fijo */}
      <View style={[detalleStyles.header, { borderBottomColor: colors.border }]}>
        <Text style={[detalleStyles.title, { color: colors.text }]}>
          Detalle de Auditoría
        </Text>
        <TouchableOpacity onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Cerrar detalle de auditoría">
          <Ionicons name="close" size={scale(24)} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>

      {/* ZONA 2: Body scrolleable */}
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
        nestedScrollEnabled
      >
        <View style={detalleStyles.body}>
          {row('Fecha', formatDateTime(item.createdAt))}
          {row('Nivel', badge(nMeta.bg, nMeta.text, item.nivel || 'INFO'))}
          {row('Tipo', badge(tMeta.bg, tMeta.text, item.tipo))}
          {row('Acción', item.accion)}
          {item.usuario?.nombre
            ? row('Usuario', `${item.usuario.nombre}${item.usuario.email ? ` (${item.usuario.email})` : ''}`)
            : null}
          {item.empresa?.nombre ? row('Empresa', item.empresa.nombre) : null}
          {item.ip ? row('IP', item.ip) : null}
          {item.referenciaId ? row('Referencia ID', item.referenciaId) : null}
          {item.descripcion ? row('Descripción', item.descripcion) : null}
          {item.monto != null ? row('Monto', formatCurrency(item.monto)) : null}

          {item.userAgent && (
            <TouchableOpacity
              onPress={() => setShowExtra((p) => !p)}
              style={detalleStyles.expandBtn}
              accessibilityRole="button"
              accessibilityLabel={showExtra ? 'Ocultar User Agent' : 'Ver User Agent'}
              accessibilityState={{ expanded: showExtra }}
            >
              <Text style={[detalleStyles.expandText, { color: colors.primary }]}>
                {showExtra ? 'Ocultar' : 'Ver'} User Agent
              </Text>
              <Ionicons
                name={showExtra ? 'chevron-up' : 'chevron-down'}
                size={scale(14)}
                color={colors.primary}
              />
            </TouchableOpacity>
          )}

          {showExtra && item.userAgent && (
            <View style={[detalleStyles.jsonBlock, { backgroundColor: colors.surface }]}>
              <Text style={[detalleStyles.jsonText, { color: colors.textSecondary }]}>
                {item.userAgent}
              </Text>
            </View>
          )}

          {(item.datosAnteriores || item.datosNuevos) && (
            <TouchableOpacity
              onPress={onVerDatos}
              style={[detalleStyles.datosBtn, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
              accessibilityRole="button"
              accessibilityLabel="Ver datos adicionales de auditoría"
            >
              <Ionicons name="document-text-outline" size={scale(18)} color={colors.primary} />
              <Text style={[detalleStyles.datosBtnText, { color: colors.primary }]}>
                Ver datos completos
              </Text>
              <Ionicons name="chevron-forward" size={scale(16)} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* ZONA 3: Botón Cerrar fijo */}
      <TouchableOpacity
        onPress={onClose}
        style={[detalleStyles.closeBtn, { backgroundColor: colors.borderLight }]}
        accessibilityRole="button"
        accessibilityLabel="Cerrar detalle de auditoría"
      >
        <Text style={[detalleStyles.closeBtnText, { color: colors.textSecondary }]}>
          Cerrar
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ──────────────────────────────────────────
// DatosContent — modal secundario para datos adicionales
// ──────────────────────────────────────────

function DatosContent({
  item,
  colors,
  onClose,
}: {
  item: Auditoria;
  colors: typeof Colors.light;
  onClose: () => void;
}) {
  return (
    <View style={{ flex: 1 }}>
      {/* ZONA 1: Header fijo */}
      <View style={[detalleStyles.header, { borderBottomColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[detalleStyles.title, { color: colors.text }]}>
            Datos adicionales
          </Text>
          <Text style={[detalleStyles.weak, { color: colors.textTertiary }]}>
            ID {item.id}
          </Text>
        </View>
        <Pressable
          onPress={onClose}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Cerrar datos adicionales"
        >
          <Ionicons name="close-circle" size={scale(28)} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* ZONA 2: Body scrollable */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: Spacing.lg, paddingBottom: Spacing.md }}
        showsVerticalScrollIndicator={false}
      >
        {item.datosAnteriores && (
          <View style={{ marginBottom: Spacing.lg }}>
            <View style={[detalleStyles.chip, { backgroundColor: colors.errorLight, alignSelf: 'flex-start', marginBottom: Spacing.sm }]}>
              <Ionicons name="arrow-back-circle-outline" size={scale(14)} color={colors.error} />
              <Text style={[detalleStyles.chipText, { color: colors.error }]}>Antes</Text>
            </View>
            <View style={[detalleStyles.jsonBlock, { backgroundColor: colors.errorLight }]}>
              {renderJsonRows(item.datosAnteriores as Record<string, unknown>, colors.error, colors)}
            </View>
          </View>
        )}

        {item.datosNuevos && (
          <View>
            <View style={[detalleStyles.chip, { backgroundColor: colors.successLight, alignSelf: 'flex-start', marginBottom: Spacing.sm }]}>
              <Ionicons name="arrow-forward-circle-outline" size={scale(14)} color={colors.success} />
              <Text style={[detalleStyles.chipText, { color: colors.success }]}>Después</Text>
            </View>
            <View style={[detalleStyles.jsonBlock, { backgroundColor: colors.successLight }]}>
              {renderJsonRows(item.datosNuevos as Record<string, unknown>, colors.success, colors)}
            </View>
          </View>
        )}

        {!item.datosAnteriores && !item.datosNuevos && (
          <EmptyState
            title="Sin datos adicionales"
            subtitle="Este registro no contiene datos adicionales."
            icon="document-text-outline"
          />
        )}
      </ScrollView>

      {/* ZONA 3: Botón Cerrar fijo */}
      <TouchableOpacity
        onPress={onClose}
        style={[detalleStyles.closeBtn, { backgroundColor: colors.borderLight }]}
        accessibilityRole="button"
        accessibilityLabel="Cerrar datos adicionales"
      >
        <Text style={[detalleStyles.closeBtnText, { color: colors.textSecondary }]}>
          Cerrar
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ──────────────────────────────────────────
// Styles
// ──────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  // chips
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: scale(6),
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  chipText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  // filters
  filterCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  filterTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.sm,
  },
  filterRow: { flexDirection: 'row', gap: Spacing.sm },
  filterHalf: { flex: 1 },
  filterActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  filterBtn: {
    flex: 1,
    height: scale(44),
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  // kpis
  kpiScroll: { marginBottom: Spacing.sm },
  kpiScrollContent: { gap: Spacing.sm },
  kpiCard: {
    minWidth: scale(80),
    borderRadius: BorderRadius.lg,
    padding: Spacing.sm,
    alignItems: 'center',
  },
  kpiValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  kpiLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.medium, marginTop: scale(1) },
  // result count
  resultCount: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    marginBottom: Spacing.sm,
  },
  // cards
  card: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.xs,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.sm,
  },
  tipoDot: {
    width: scale(28),
    height: scale(28),
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  accion: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    flex: 1,
  },
  nivelBadge: {
    paddingHorizontal: scale(6),
    paddingVertical: scale(2),
    borderRadius: BorderRadius.sm,
  },
  nivelText: { fontSize: scale(10), fontWeight: FontWeight.bold },
  desc: { fontSize: FontSize.sm, marginTop: scale(4), marginLeft: scale(36) },
  cardMeta: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: scale(4),
    marginLeft: scale(36),
  },
  metaText: { fontSize: FontSize.xs },
  // modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '85%',
    flex: 1,
    paddingBottom: Platform.OS === 'ios' ? 34 : Spacing.md,
  },
});

const detalleStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  weak: { fontSize: FontSize.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    paddingHorizontal: Spacing.sm,
    paddingVertical: scale(3),
    borderRadius: BorderRadius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  body: { padding: Spacing.lg },
  row: {
    flexDirection: 'row',
    paddingVertical: scale(6),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  label: { width: scale(110), fontSize: FontSize.xs, fontWeight: FontWeight.semibold, paddingTop: scale(2) },
  valueWrap: { flex: 1 },
  value: { fontSize: FontSize.sm },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: scale(6),
    paddingVertical: scale(2),
    borderRadius: BorderRadius.sm,
  },
  badgeText: { fontSize: scale(10), fontWeight: FontWeight.bold },
  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    paddingVertical: Spacing.sm,
  },
  expandText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  jsonBlock: {
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  jsonText: { fontFamily: 'monospace', fontSize: FontSize.xs },
  jsonRow: {
    flexDirection: 'row',
    paddingVertical: scale(4),
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  jsonKey: {
    width: scale(100),
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  jsonValue: {
    flex: 1,
    fontSize: FontSize.xs,
    fontFamily: 'monospace',
  },
  datosBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  datosBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  closeBtn: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    height: scale(44),
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
});
