import { useCallback, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useGastos,
  useGastosResumen,
  useCrearGasto,
  useActualizarGasto,
  useEliminarGasto } from '@/hooks/use-gastos';
import type { Gasto, GastosFilters } from '@/types/gastos.types';
import { AppInput } from '@/components/ui/app-input';
import { AppButton } from '@/components/ui/app-button';
import { Skeleton } from '@/components/ui/skeleton';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import DatePickerField from '@/components/ui/date-picker-field';
import { useToast } from '@/components/ui/toast';
import { useTheme } from '@/components/ui/theme-provider';

const CATEGORY_PALETTE = [
  '#2563EB', '#D97706', '#7C3AED', '#0891B2', '#059669',
  '#DC2626', '#EA580C', '#16A34A', '#4F46E5', '#0284C7',
  '#8B5CF6', '#6B7280',
];

const KNOWN_CATEGORIES: Record<string, { color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  SERVICIOS: { color: '#2563EB', icon: 'flash-outline' },
  LUZ: { color: '#2563EB', icon: 'flash-outline' },
  AGUA: { color: '#2563EB', icon: 'water-outline' },
  TELEFONO: { color: '#2563EB', icon: 'call-outline' },
  INTERNET: { color: '#2563EB', icon: 'globe-outline' },
  SUMINISTROS: { color: '#D97706', icon: 'cube-outline' },
  SALARIOS: { color: '#7C3AED', icon: 'people-outline' },
  TRANSPORTE: { color: '#0891B2', icon: 'car-outline' },
  COMBUSTIBLE: { color: '#0891B2', icon: 'flame-outline' },
  ALQUILER: { color: '#059669', icon: 'home-outline' },
  RENTA: { color: '#059669', icon: 'home-outline' },
  MARKETING: { color: '#DC2626', icon: 'megaphone-outline' },
  PUBLICIDAD: { color: '#DC2626', icon: 'megaphone-outline' },
  IMPUESTOS: { color: '#6B7280', icon: 'document-text-outline' },
  MANTENIMIENTO: { color: '#EA580C', icon: 'construct-outline' },
  REPARACIONES: { color: '#EA580C', icon: 'construct-outline' },
  EQUIPOS: { color: '#4F46E5', icon: 'desktop-outline' },
  COMISIONES: { color: '#16A34A', icon: 'cash-outline' },
  SEGUROS: { color: '#0284C7', icon: 'shield-checkmark-outline' },
};

function getCategoryMeta(cat: string) {
  const key = cat.toUpperCase().trim();
  const known = KNOWN_CATEGORIES[key];
  if (known) return known;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  return {
    color: CATEGORY_PALETTE[Math.abs(hash) % CATEGORY_PALETTE.length],
    icon: 'receipt-outline' as keyof typeof Ionicons.glyphMap,
  };
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function formatFullCurrency(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatFecha(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now.getTime() - 86400000);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  if (isToday) return `Hoy ${d.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}`;
  if (isYesterday) return `Ayer ${d.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}`;
  return d.toLocaleDateString('es-DO', { day: '2-digit', month: 'short' });
}

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function getMonthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

type GastoForm = {
  categoria: string;
  descripcion: string;
  monto: string;
  fecha: string;
  tipo: 'OPERATIVO' | 'CAPITAL';
  proveedor: string;
  referencia: string;
  observaciones: string;
};

const EMPTY_FORM: GastoForm = {
  categoria: '',
  descripcion: '',
  monto: '',
  fecha: getToday(),
  tipo: 'OPERATIVO',
  proveedor: '',
  referencia: '',
  observaciones: '',
};

export default function GastosScreen() {
  const { colorScheme, colors } = useTheme();
  const { showToast } = useToast();

  const [desde, setDesde] = useState(getMonthStart());
  const [hasta, setHasta] = useState(getToday());
  const [categoriaFilter, setCategoriaFilter] = useState('');

  const filters = useMemo<GastosFilters>(() => {
    const f: GastosFilters = {};
    if (desde) f.desde = desde;
    if (hasta) f.hasta = hasta;
    if (categoriaFilter) f.categoria = categoriaFilter;
    return f;
  }, [desde, hasta, categoriaFilter]);

  const { data: gastos, isLoading, refetch, isRefetching } = useGastos(filters);
  const { data: resumen } = useGastosResumen();
  const crearMutation = useCrearGasto();
  const actualizarMutation = useActualizarGasto();
  const eliminarMutation = useEliminarGasto();

  const [showForm, setShowForm] = useState(false);
  const [editingGasto, setEditingGasto] = useState<Gasto | null>(null);
  const [form, setForm] = useState<GastoForm>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Gasto | null>(null);

  const categories = useMemo(() => {
    if (!resumen) return [];
    return Object.entries(resumen.porCategoria)
      .sort(([, a], [, b]) => b - a);
  }, [resumen]);

  const totalGral = resumen?.totalGral ?? 0;

  const catFilterOptions = useMemo(() => {
    if (!resumen) return [];
    return Object.keys(resumen.porCategoria).sort();
  }, [resumen]);

  const isEditing = !!editingGasto;

  function openCreate() {
    setEditingGasto(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(gasto: Gasto) {
    setEditingGasto(gasto);
    setForm({
      categoria: gasto.categoria,
      descripcion: gasto.descripcion,
      monto: String(gasto.monto),
      fecha: gasto.fecha.split('T')[0],
      tipo: gasto.tipo,
      proveedor: gasto.proveedor ?? '',
      referencia: gasto.referencia ?? '',
      observaciones: gasto.observaciones ?? '',
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingGasto(null);
    setForm(EMPTY_FORM);
  }

  const handleSubmit = useCallback(async () => {
    if (!form.categoria.trim()) { showToast('Ingrese la categoría', 'error'); return; }
    if (!form.descripcion.trim()) { showToast('Ingrese la descripción', 'error'); return; }
    const monto = parseFloat(form.monto);
    if (!monto || monto <= 0) { showToast('Ingrese un monto válido', 'error'); return; }
    if (!form.fecha.trim()) { showToast('Ingrese la fecha', 'error'); return; }

    try {
      if (isEditing && editingGasto) {
        await actualizarMutation.mutateAsync({
          id: editingGasto.id,
          data: {
            categoria: form.categoria.trim(),
            descripcion: form.descripcion.trim(),
            monto,
            fecha: form.fecha,
            proveedor: form.proveedor.trim() || undefined,
            referencia: form.referencia.trim() || undefined,
            observaciones: form.observaciones.trim() || undefined,
          },
        });
        showToast('Gasto actualizado', 'success');
      } else {
        await crearMutation.mutateAsync({
          categoria: form.categoria.trim(),
          descripcion: form.descripcion.trim(),
          monto,
          fecha: form.fecha,
          tipo: form.tipo,
          proveedor: form.proveedor.trim() || undefined,
          referencia: form.referencia.trim() || undefined,
          observaciones: form.observaciones.trim() || undefined,
        });
        showToast('Gasto registrado', 'success');
      }
      closeForm();
    } catch {
      showToast('Error al guardar el gasto', 'error');
    }
  }, [form, isEditing, editingGasto, crearMutation, actualizarMutation, showToast]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await eliminarMutation.mutateAsync(deleteTarget.id);
      showToast('Gasto eliminado', 'success');
      setDeleteTarget(null);
    } catch {
      showToast('Error al eliminar el gasto', 'error');
    }
  }, [deleteTarget, eliminarMutation, showToast]);

  const renderGasto = useCallback(
    ({ item }: { item: Gasto }) => {
      const meta = getCategoryMeta(item.categoria);
      return (
        <TouchableOpacity
          onPress={() => openEdit(item)}
          activeOpacity={0.7}
          style={[styles.gastoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={[styles.gastoIcon, { backgroundColor: meta.color + '18' }]}>
            <Ionicons name={meta.icon} size={18} color={meta.color} />
          </View>
          <View style={styles.gastoInfo}>
            <View style={styles.gastoTop}>
              <Text style={[styles.gastoCat, { color: meta.color }]} numberOfLines={1}>
                {item.categoria}
              </Text>
              <View
                style={[
                  styles.tipoBadge,
                  { backgroundColor: item.tipo === 'CAPITAL' ? colors.infoLight : colors.primaryLight },
                ]}
              >
                <Text
                  style={[
                    styles.tipoBadgeText,
                    { color: item.tipo === 'CAPITAL' ? colors.info : colors.primary },
                  ]}
                >
                  {item.tipo === 'CAPITAL' ? 'CAP' : 'OP'}
                </Text>
              </View>
            </View>
            <Text style={[styles.gastoDesc, { color: colors.text }]} numberOfLines={1}>
              {item.descripcion}
            </Text>
            <Text style={[styles.gastoMeta, { color: colors.textTertiary }]}>
              {formatFecha(item.fecha)}
              {item.proveedor ? ` · ${item.proveedor}` : ''}
            </Text>
          </View>
          <Text style={[styles.gastoMonto, { color: colors.error }]}>
            -{formatCurrency(item.monto)}
          </Text>
        </TouchableOpacity>
      );
    },
    [colors],
  );

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.content}>
          <Skeleton height={44} style={{ marginBottom: Spacing.md }} />
          <Skeleton height={80} style={{ marginBottom: Spacing.md }} />
          <Skeleton height={150} style={{ marginBottom: Spacing.sm }} />
          <Skeleton height={40} style={{ marginBottom: Spacing.md }} />
          <Skeleton height={60} />
          <Skeleton height={60} />
          <Skeleton height={60} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={gastos ?? []}
        keyExtractor={(item) => item.id}
        renderItem={renderGasto}
        refreshing={isRefetching}
        onRefresh={refetch}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {/* Action button */}
            <TouchableOpacity
              onPress={openCreate}
              style={[styles.newBtn, { backgroundColor: colors.primary }]}
            >
              <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
              <Text style={styles.newBtnText}>Nuevo gasto</Text>
            </TouchableOpacity>

            {/* Resumen KPIs */}
            <View style={styles.kpiRow}>
              <View style={[styles.kpiCard, { backgroundColor: colors.primaryLight }]}>
                <Text style={[styles.kpiValue, { color: colors.primary }]}>
                  {formatCurrency(resumen?.totalMes ?? 0)}
                </Text>
                <Text style={[styles.kpiLabel, { color: colors.primary }]}>Este mes</Text>
              </View>
              <View style={[styles.kpiCard, { backgroundColor: colors.secondaryLight }]}>
                <Text style={[styles.kpiValue, { color: colors.secondary }]}>
                  {formatCurrency(resumen?.totalAno ?? 0)}
                </Text>
                <Text style={[styles.kpiLabel, { color: colors.secondary }]}>Este año</Text>
              </View>
              <View style={[styles.kpiCard, { backgroundColor: colors.warningLight }]}>
                <Text style={[styles.kpiValue, { color: colors.warning }]}>
                  {formatCurrency(totalGral)}
                </Text>
                <Text style={[styles.kpiLabel, { color: colors.warning }]}>Total</Text>
              </View>
            </View>

            {/* Category breakdown */}
            {categories.length > 0 && (
              <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Categorías</Text>
                <View style={styles.catBar}>
                  {categories.map(([cat, val]) => {
                    const pct = totalGral > 0 ? (val / totalGral) * 100 : 0;
                    if (pct < 1) return null;
                    return (
                      <View
                        key={cat}
                        style={[styles.catSegment, { flex: pct, backgroundColor: getCategoryMeta(cat).color }]}
                      />
                    );
                  })}
                </View>
                {categories.map(([cat, val]) => {
                  const pct = totalGral > 0 ? (val / totalGral) * 100 : 0;
                  const meta = getCategoryMeta(cat);
                  return (
                    <View key={cat} style={styles.catRow}>
                      <View style={[styles.catDot, { backgroundColor: meta.color }]} />
                      <Ionicons name={meta.icon} size={12} color={meta.color} style={{ marginRight: 4 }} />
                      <Text style={[styles.catLabel, { color: colors.textSecondary }]}>{cat}</Text>
                      <Text style={[styles.catValue, { color: colors.text }]}>{formatCurrency(val)}</Text>
                      <Text style={[styles.catPct, { color: colors.textTertiary }]}>
                        {pct.toFixed(1)}%
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Filters */}
              <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Filtros</Text>
              <View style={styles.filterRow}>
                <View style={styles.filterHalf}>
                  <DatePickerField
                    label="Desde"
                    value={desde}
                    onChange={setDesde}
                  />
                </View>
                <View style={styles.filterHalf}>
                  <DatePickerField
                    label="Hasta"
                    value={hasta}
                    onChange={setHasta}
                  />
                </View>
              </View>
              {catFilterOptions.length > 0 && (
                <View style={styles.chipRow}>
                  <TouchableOpacity
                    onPress={() => setCategoriaFilter('')}
                    style={[
                      styles.chip,
                      { borderColor: colors.border },
                      !categoriaFilter && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: colors.textSecondary },
                        !categoriaFilter && { color: '#FFFFFF' },
                      ]}
                    >
                      Todas
                    </Text>
                  </TouchableOpacity>
                  {catFilterOptions.map((cat) => {
                    const selected = categoriaFilter === cat;
                    return (
                      <TouchableOpacity
                        key={cat}
                        onPress={() => setCategoriaFilter(selected ? '' : cat)}
                        style={[
                          styles.chip,
                          { borderColor: getCategoryMeta(cat).color },
                          selected && { backgroundColor: getCategoryMeta(cat).color },
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            { color: getCategoryMeta(cat).color },
                            selected && { color: '#FFFFFF' },
                          ]}
                        >
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Gastos list header */}
            {gastos && gastos.length > 0 && (
              <Text style={[styles.sectionTitle, { color: colors.text, marginTop: Spacing.sm }]}>
                {gastos.length} gasto{gastos.length !== 1 ? 's' : ''}
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
              No hay gastos registrados
            </Text>
          </View>
        }
      />

      {/* Create/Edit Modal */}
      <Modal visible={showForm} transparent animationType="slide" onRequestClose={closeForm}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={[styles.modalOverlay, { backgroundColor: colors.overlay }]} onPress={closeForm}>
            <Pressable style={[styles.modalContent, { backgroundColor: colors.surfaceElevated }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {isEditing ? 'Editar gasto' : 'Nuevo gasto'}
                </Text>
                <TouchableOpacity onPress={closeForm} hitSlop={8}>
                  <Ionicons name="close" size={24} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <AppInput
                  label="Categoría"
                  placeholder="Ej: Servicios, Suministros..."
                  value={form.categoria}
                  onChangeText={(v) => setForm((p) => ({ ...p, categoria: v }))}
                />
                <AppInput
                  label="Descripción"
                  placeholder="Ej: Pago de factura eléctrica"
                  value={form.descripcion}
                  onChangeText={(v) => setForm((p) => ({ ...p, descripcion: v }))}
                />
                <View style={styles.formRow}>
                  <View style={styles.formHalf}>
                    <AppInput
                      label="Monto"
                      placeholder="0.00"
                      value={form.monto}
                      onChangeText={(v) => setForm((p) => ({ ...p, monto: v }))}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={styles.formHalf}>
                    <DatePickerField
                      label="Fecha"
                      value={form.fecha}
                      onChange={(v) => setForm((p) => ({ ...p, fecha: v }))}
                    />
                  </View>
                </View>

                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Tipo</Text>
                <View style={styles.toggleRow}>
                  <TouchableOpacity
                    onPress={() => setForm((p) => ({ ...p, tipo: 'OPERATIVO' }))}
                    style={[
                      styles.toggleBtn,
                      {
                        backgroundColor: form.tipo === 'OPERATIVO' ? colors.primary : colors.surface,
                        borderColor: form.tipo === 'OPERATIVO' ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        { color: form.tipo === 'OPERATIVO' ? '#FFFFFF' : colors.textSecondary },
                      ]}
                    >
                      Operativo
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setForm((p) => ({ ...p, tipo: 'CAPITAL' }))}
                    style={[
                      styles.toggleBtn,
                      {
                        backgroundColor: form.tipo === 'CAPITAL' ? colors.info : colors.surface,
                        borderColor: form.tipo === 'CAPITAL' ? colors.info : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        { color: form.tipo === 'CAPITAL' ? '#FFFFFF' : colors.textSecondary },
                      ]}
                    >
                      Capital
                    </Text>
                  </TouchableOpacity>
                </View>

                <AppInput
                  label="Proveedor (opcional)"
                  placeholder="Nombre del proveedor"
                  value={form.proveedor}
                  onChangeText={(v) => setForm((p) => ({ ...p, proveedor: v }))}
                />
                <AppInput
                  label="Referencia (opcional)"
                  placeholder="N° factura, recibo..."
                  value={form.referencia}
                  onChangeText={(v) => setForm((p) => ({ ...p, referencia: v }))}
                />
                <AppInput
                  label="Observaciones (opcional)"
                  placeholder="Notas adicionales"
                  value={form.observaciones}
                  onChangeText={(v) => setForm((p) => ({ ...p, observaciones: v }))}
                  multiline
                />

                <AppButton
                  title={isEditing ? 'Actualizar gasto' : 'Guardar gasto'}
                  onPress={handleSubmit}
                  loading={crearMutation.isPending || actualizarMutation.isPending}
                  icon={isEditing ? 'create-outline' : 'save-outline'}
                />

                {isEditing && (
                  <AppButton
                    title="Eliminar gasto"
                    onPress={() => setDeleteTarget(editingGasto)}
                    loading={eliminarMutation.isPending}
                    icon="trash-outline"
                    variant="danger"
                    style={{ marginTop: Spacing.sm }}
                  />
                )}
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        visible={!!deleteTarget}
        title="Eliminar gasto"
        message={
          deleteTarget
            ? `¿Eliminar gasto de ${formatFullCurrency(deleteTarget.monto)} por "${deleteTarget.descripcion}"?`
            : ''
        }
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={eliminarMutation.isPending}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  newBtnText: { color: '#FFFFFF', fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  kpiRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  kpiCard: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.sm,
    alignItems: 'center',
  },
  kpiValue: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  kpiLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.medium, marginTop: 1 },
  sectionCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, marginBottom: Spacing.sm },
  catBar: { flexDirection: 'row', height: 16, borderRadius: BorderRadius.sm, overflow: 'hidden', marginBottom: Spacing.sm },
  catSegment: { height: '100%' },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: 3,
  },
  catDot: { width: 8, height: 8, borderRadius: 4 },
  catLabel: { fontSize: FontSize.xs, flex: 1 },
  catValue: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, marginRight: Spacing.xs },
  catPct: { fontSize: FontSize.xs, width: 40, textAlign: 'right' },
  filterRow: { flexDirection: 'row', gap: Spacing.sm },
  filterHalf: { flex: 1 },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  chipText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  gastoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.xs,
  },
  gastoIcon: { width: 36, height: 36, borderRadius: BorderRadius.sm, justifyContent: 'center', alignItems: 'center' },
  gastoInfo: { flex: 1 },
  gastoTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: 1 },
  gastoCat: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  tipoBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: BorderRadius.sm,
  },
  tipoBadgeText: { fontSize: 10, fontWeight: FontWeight.bold },
  gastoDesc: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  gastoMeta: { fontSize: FontSize.xs, marginTop: 1 },
  gastoMonto: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl * 2, gap: Spacing.sm },
  emptyText: { fontSize: FontSize.sm, textAlign: 'center' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
    maxHeight: '90%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  formRow: { flexDirection: 'row', gap: Spacing.sm },
  formHalf: { flex: 1 },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, marginBottom: Spacing.xs },
  toggleRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  toggleBtn: {
    flex: 1,
    height: 40,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },

});
