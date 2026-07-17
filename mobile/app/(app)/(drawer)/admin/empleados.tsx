import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useEmpleados,
  useEmpleadosResumen,
  useCrearEmpleado,
  useActualizarEmpleado,
  useDesactivarEmpleado,
  useReactivarEmpleado,
  useAsistencia,
  useRegistrarAsistencia,
  usePagos,
  useRegistrarPago,
  useDescuentos,
  useCrearDescuento,
  useEliminarDescuento } from '@/hooks/use-empleados';
import type {
  Empleado,
  EmpleadoConAsistencia,
  EstadoAsistencia,
  FrecuenciaPago,
  MetodoPago,
  PagoSalario,
  TipoDescuento,
} from '@/types/empleados.types';
import { AppInput } from '@/components/ui/app-input';
import { AppButton } from '@/components/ui/app-button';
import PickerField from '@/components/ui/picker-field';
import DatePickerField from '@/components/ui/date-picker-field';
import { Skeleton } from '@/components/ui/skeleton';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { useTheme } from '@/components/ui/theme-provider';
import { formatCurrencyCompact, formatFullCurrency, getTodayISO } from '@/utils/formatters';

type Tab = 'empleados' | 'asistencia' | 'pagos' | 'descuentos';

const TABS: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'empleados', label: 'Empleados', icon: 'people-outline' },
  { key: 'asistencia', label: 'Asistencia', icon: 'calendar-outline' },
  { key: 'pagos', label: 'Pagos', icon: 'cash-outline' },
  { key: 'descuentos', label: 'Descuentos', icon: 'pricetag-outline' },
];

const ESTADO_LABELS: Record<EstadoAsistencia, string> = {
  PRESENTE: 'Presente',
  AUSENTE: 'Ausente',
  TARDANZA: 'Tardanza',
  MEDIO_DIA: 'Medio día',
  FERIADO: 'Feriado',
  VACACIONES: 'Vacaciones',
};

const ESTADO_COLORS: Record<EstadoAsistencia, string> = {
  PRESENTE: '#16A34A',
  AUSENTE: '#DC2626',
  TARDANZA: '#D97706',
  MEDIO_DIA: '#0891B2',
  FERIADO: '#7C3AED',
  VACACIONES: '#2563EB',
};

const TIPO_DESC_LABELS: Record<TipoDescuento, string> = {
  TARDANZA: 'Tardanza',
  AUSENCIA: 'Ausencia',
  PRESTAMO: 'Préstamo',
  OTRO: 'Otro',
};

const METODO_PAGO_OPTIONS: MetodoPago[] = ['EFECTIVO', 'TRANSFERENCIA', 'CHEQUE'];
const METODO_PAGO_LABELS: Record<MetodoPago, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  CHEQUE: 'Cheque',
};

const FRECUENCIA_OPTIONS: FrecuenciaPago[] = ['SEMANAL', 'QUINCENAL', 'MENSUAL'];
const FRECUENCIA_LABELS: Record<FrecuenciaPago, string> = {
  SEMANAL: 'Semanal',
  QUINCENAL: 'Quincenal',
  MENSUAL: 'Mensual',
};



type EmpleadoForm = {
  nombre: string; apellido: string; cedula: string;
  telefono: string; celular: string; email: string;
  cargo: string; departamento: string;
  salario: string; frecuenciaPago: FrecuenciaPago;
  fechaIngreso: string; observaciones: string;
};

const EMPTY_EMP_FORM: EmpleadoForm = {
  nombre: '', apellido: '', cedula: '', telefono: '', celular: '', email: '',
  cargo: '', departamento: '', salario: '', frecuenciaPago: 'QUINCENAL',
  fechaIngreso: getTodayISO(), observaciones: '',
};

export default function EmpleadosScreen() {
  const { colorScheme, colors } = useTheme();
  const { showToast } = useToast();

  // ─── Tab state ──────────────────────────────────────────────
  const [tab, setTab] = useState<Tab>('empleados');

  // ─── Empleados tab state ────────────────────────────────────
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const [search, setSearch] = useState('');
  const { data: empleados, isLoading: empLoading, refetch: empRefetch, isRefetching: empRefetching } = useEmpleados(mostrarInactivos);
  const { data: resumen } = useEmpleadosResumen();
  const crearMutation = useCrearEmpleado();
  const actualizarMutation = useActualizarEmpleado();
  const desactivarMutation = useDesactivarEmpleado();
  const reactivarMutation = useReactivarEmpleado();

  const [showForm, setShowForm] = useState(false);
  const [editingEmpleado, setEditingEmpleado] = useState<Empleado | null>(null);
  const [empForm, setEmpForm] = useState<EmpleadoForm>(EMPTY_EMP_FORM);
  const [toggleTarget, setToggleTarget] = useState<Empleado | null>(null);

  const filtered = useMemo(() => {
    if (!empleados) return [];
    if (!search.trim()) return empleados;
    const q = search.toLowerCase();
    return empleados.filter(
      (e) => e.nombre.toLowerCase().includes(q) || e.apellido.toLowerCase().includes(q) || e.cedula.includes(q) || e.cargo.toLowerCase().includes(q),
    );
  }, [empleados, search]);

  const isEditing = !!editingEmpleado;

  function openCreate() { setEditingEmpleado(null); setEmpForm(EMPTY_EMP_FORM); setShowForm(true); }
  function openEdit(emp: Empleado) {
    setEditingEmpleado(emp);
    setEmpForm({
      nombre: emp.nombre, apellido: emp.apellido, cedula: emp.cedula,
      telefono: emp.telefono ?? '', celular: emp.celular ?? '', email: emp.email ?? '',
      cargo: emp.cargo, departamento: emp.departamento ?? '',
      salario: String(emp.salario), frecuenciaPago: emp.frecuenciaPago,
      fechaIngreso: emp.fechaIngreso.split('T')[0], observaciones: emp.observaciones ?? '',
    });
    setShowForm(true);
  }
  function closeForm() { setShowForm(false); setEditingEmpleado(null); setEmpForm(EMPTY_EMP_FORM); }

  const handleSubmit = useCallback(async () => {
    if (!empForm.nombre.trim()) { showToast('Ingrese el nombre', 'error'); return; }
    if (!empForm.apellido.trim()) { showToast('Ingrese el apellido', 'error'); return; }
    if (!empForm.cedula.trim()) { showToast('Ingrese la cédula', 'error'); return; }
    if (!empForm.cargo.trim()) { showToast('Ingrese el cargo', 'error'); return; }
    const salario = parseFloat(empForm.salario);
    if (!salario || salario <= 0) { showToast('Ingrese un salario válido', 'error'); return; }
    const payload = {
      nombre: empForm.nombre.trim(), apellido: empForm.apellido.trim(), cedula: empForm.cedula.trim(),
      telefono: empForm.telefono.trim() || undefined, celular: empForm.celular.trim() || undefined,
      email: empForm.email.trim() || undefined, cargo: empForm.cargo.trim(),
      departamento: empForm.departamento.trim() || undefined, salario,
      frecuenciaPago: empForm.frecuenciaPago, fechaIngreso: empForm.fechaIngreso,
      observaciones: empForm.observaciones.trim() || undefined,
    };
    try {
      if (isEditing && editingEmpleado) {
        await actualizarMutation.mutateAsync({ id: editingEmpleado.id, data: payload });
        showToast('Empleado actualizado', 'success');
      } else {
        await crearMutation.mutateAsync(payload);
        showToast('Empleado registrado', 'success');
      }
      closeForm();
    } catch { showToast('Error al guardar el empleado', 'error'); }
  }, [empForm, isEditing, editingEmpleado, crearMutation, actualizarMutation, showToast]);

  const handleToggleActivo = useCallback(async () => {
    if (!toggleTarget) return;
    try {
      if (toggleTarget.activo) await desactivarMutation.mutateAsync(toggleTarget.id);
      else await reactivarMutation.mutateAsync(toggleTarget.id);
      showToast(toggleTarget.activo ? 'Empleado desactivado' : 'Empleado reactivado', 'success');
      setToggleTarget(null);
    } catch { showToast('Error al cambiar estado', 'error'); }
  }, [toggleTarget, desactivarMutation, reactivarMutation, showToast]);

  // ─── Asistencia tab state ───────────────────────────────────
  const [asiFecha, setAsiFecha] = useState(getTodayISO());
  const { data: asistenciaData, isLoading: asiLoading, refetch: asiRefetch, isRefetching: asiRefetching } = useAsistencia(asiFecha);
  const registrarAsiMutation = useRegistrarAsistencia();

  const [asiDetalleTarget, setAsiDetalleTarget] = useState<string | null>(null);
  const [asiDetalleForm, setAsiDetalleForm] = useState<{ estado: EstadoAsistencia; entrada: string; salida: string; observacion: string }>({
    estado: 'PRESENTE', entrada: '', salida: '', observacion: '',
  });

  const asiStats = useMemo(() => {
    if (!asistenciaData) return { presentes: 0, ausentes: 0, tardanzas: 0, otros: 0, total: 0 };
    let p = 0, a = 0, t = 0, o = 0;
    asistenciaData.forEach((item) => {
      const e = item.asistencia?.estado;
      if (e === 'PRESENTE') p++;
      else if (e === 'AUSENTE') a++;
      else if (e === 'TARDANZA') t++;
      else o++;
    });
    return { presentes: p, ausentes: a, tardanzas: t, otros: o, total: asistenciaData.length };
  }, [asistenciaData]);

  const handleAsiQuick = useCallback(async (empleadoId: string, estado: EstadoAsistencia) => {
    try {
      await registrarAsiMutation.mutateAsync({ empleadoId, fecha: asiFecha, estado });
      showToast(`${ESTADO_LABELS[estado]} registrado`, 'success');
    } catch { showToast('Error al registrar asistencia', 'error'); }
  }, [asiFecha, registrarAsiMutation, showToast]);

  const handleAsiDetalle = useCallback(async () => {
    if (!asiDetalleTarget) return;
    try {
      await registrarAsiMutation.mutateAsync({
        empleadoId: asiDetalleTarget, fecha: asiFecha,
        estado: asiDetalleForm.estado,
        entrada: asiDetalleForm.entrada || undefined,
        salida: asiDetalleForm.salida || undefined,
        observacion: asiDetalleForm.observacion || undefined,
      });
      showToast('Asistencia actualizada', 'success');
      setAsiDetalleTarget(null);
    } catch { showToast('Error al registrar asistencia', 'error'); }
  }, [asiDetalleTarget, asiFecha, asiDetalleForm, registrarAsiMutation, showToast]);

  // ─── Pagos tab state ────────────────────────────────────────
  const [pagoFilterEmp, setPagoFilterEmp] = useState<string>('');
  const { data: pagos, isLoading: pagosLoading, refetch: pagosRefetch, isRefetching: pagosRefetching } = usePagos(pagoFilterEmp || undefined);
  const registrarPagoMutation = useRegistrarPago();

  const [showPagoForm, setShowPagoForm] = useState(false);
  const [pagoForm, setPagoForm] = useState<{ empleadoId: string; periodo: string; metodoPago: MetodoPago; descripcion: string; descuentoIds: string[] }>({
    empleadoId: '', periodo: new Date().toISOString().slice(0, 7), metodoPago: 'EFECTIVO', descripcion: '', descuentoIds: [],
  });
  const [pagoEmpDescuentos, setPagoEmpDescuentos] = useState<any[]>([]);
  const [pagoSalarioBruto, setPagoSalarioBruto] = useState(0);

  const { data: pagoDescuentos } = useDescuentos(pagoForm.empleadoId);

  const pagoTotales = useMemo(() => {
    const selectedDescs = pagoDescuentos?.filter((d) => pagoForm.descuentoIds.includes(d.id)) ?? [];
    const totalDesc = selectedDescs.reduce((s, d) => s + d.monto, 0);
    return { bruto: pagoSalarioBruto, descuentos: totalDesc, neto: Math.max(0, pagoSalarioBruto - totalDesc) };
  }, [pagoDescuentos, pagoForm.descuentoIds, pagoSalarioBruto]);

  function openPagoForm() {
    setPagoForm({ empleadoId: '', periodo: new Date().toISOString().slice(0, 7), metodoPago: 'EFECTIVO', descripcion: '', descuentoIds: [] });
    setPagoSalarioBruto(0);
    setPagoEmpDescuentos([]);
    setShowPagoForm(true);
  }

  const handlePagoEmpChange = useCallback((empId: string) => {
    setPagoForm((p) => ({ ...p, empleadoId: empId, descuentoIds: [] }));
    const emp = empleados?.find((e) => e.id === empId);
    if (emp) setPagoSalarioBruto(emp.salario);
  }, [empleados]);

  const handleRegistrarPago = useCallback(async () => {
    if (!pagoForm.empleadoId) { showToast('Seleccione un empleado', 'error'); return; }
    if (!pagoForm.periodo.trim()) { showToast('Ingrese el período', 'error'); return; }
    try {
      await registrarPagoMutation.mutateAsync({
        empleadoId: pagoForm.empleadoId, periodo: pagoForm.periodo,
        metodoPago: pagoForm.metodoPago, descripcion: pagoForm.descripcion.trim() || undefined,
        descuentoIds: pagoForm.descuentoIds.length > 0 ? pagoForm.descuentoIds : undefined,
      });
      showToast('Pago registrado', 'success');
      setShowPagoForm(false);
    } catch { showToast('Error al registrar pago', 'error'); }
  }, [pagoForm, registrarPagoMutation, showToast]);

  // ─── Descuentos tab state ───────────────────────────────────
  const [descEmpId, setDescEmpId] = useState('');
  const { data: descuentos, isLoading: descLoading, refetch: descRefetch, isRefetching: descRefetching } = useDescuentos(descEmpId);
  const crearDescMutation = useCrearDescuento();
  const eliminarDescMutation = useEliminarDescuento();

  const [showDescForm, setShowDescForm] = useState(false);
  const [descForm, setDescForm] = useState<{ empleadoId: string; tipo: TipoDescuento; monto: string; descripcion: string }>({
    empleadoId: '', tipo: 'OTRO', monto: '', descripcion: '',
  });
  const [deleteDescTarget, setDeleteDescTarget] = useState<string | null>(null);

  function openDescForm() {
    if (!descEmpId) { showToast('Seleccione un empleado primero', 'error'); return; }
    setDescForm({ empleadoId: descEmpId, tipo: 'OTRO', monto: '', descripcion: '' });
    setShowDescForm(true);
  }

  const handleCrearDesc = useCallback(async () => {
    const monto = parseFloat(descForm.monto);
    if (!descForm.empleadoId) { showToast('Seleccione un empleado', 'error'); return; }
    if (!descForm.descripcion.trim()) { showToast('Ingrese una descripción', 'error'); return; }
    if (!monto || monto <= 0) { showToast('Ingrese un monto válido', 'error'); return; }
    try {
      await crearDescMutation.mutateAsync({
        empleadoId: descForm.empleadoId, tipo: descForm.tipo,
        descripcion: descForm.descripcion.trim(), monto,
      });
      showToast('Descuento creado', 'success');
      setShowDescForm(false);
    } catch { showToast('Error al crear descuento', 'error'); }
  }, [descForm, crearDescMutation, showToast]);

  const handleEliminarDesc = useCallback(async () => {
    if (!deleteDescTarget) return;
    try {
      await eliminarDescMutation.mutateAsync(deleteDescTarget);
      showToast('Descuento eliminado', 'success');
      setDeleteDescTarget(null);
    } catch { showToast('Error al eliminar descuento', 'error'); }
  }, [deleteDescTarget, eliminarDescMutation, showToast]);

  const descTotalPendiente = useMemo(() => {
    if (!descuentos) return 0;
    return descuentos.filter((d) => !d.aplicado).reduce((s, d) => s + d.monto, 0);
  }, [descuentos]);

  // ─── Render helpers ─────────────────────────────────────────

  function renderTabBar() {
    return (
      <View style={[styles.tabBar, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[styles.tab, active && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            >
              <Ionicons name={t.icon} size={16} color={active ? colors.primary : colors.textTertiary} />
              <Text style={[styles.tabLabel, { color: active ? colors.primary : colors.textTertiary }]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  // ─── Render: Empleados tab ──────────────────────────────────
  const renderEmpleadoCard = useCallback(({ item }: { item: Empleado }) => (
    <TouchableOpacity onPress={() => openEdit(item)} activeOpacity={0.7}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={[styles.avatar, { backgroundColor: colors.primaryLight }]}>
        <Text style={[styles.avatarText, { color: colors.primary }]}>{item.nombre[0]}{item.apellido[0]}</Text>
      </View>
      <View style={styles.cardInfo}>
        <View style={styles.cardTop}>
          <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>{item.nombre} {item.apellido}</Text>
          <Text style={[styles.cardAmount, { color: colors.primary }]}>{formatCurrencyCompact(item.salario)}</Text>
        </View>
        <Text style={[styles.cardSub, { color: colors.textSecondary }]} numberOfLines={1}>
          {item.cargo}{item.departamento ? ` · ${item.departamento}` : ''}
        </Text>
        <View style={styles.cardBottom}>
          <Text style={[styles.cardMeta, { color: colors.textTertiary }]}>{item.cedula}</Text>
          <View style={[styles.badge, { backgroundColor: item.activo ? colors.successLight : colors.errorLight }]}>
            <View style={[styles.dot, { backgroundColor: item.activo ? colors.success : colors.error }]} />
            <Text style={[styles.badgeText, { color: item.activo ? colors.success : colors.error }]}>
              {item.activo ? 'Activo' : 'Inactivo'}
            </Text>
          </View>
        </View>
      </View>
      <TouchableOpacity onPress={() => setToggleTarget(item)} hitSlop={8} style={styles.cardAction}>
        <Ionicons name={item.activo ? 'close-circle-outline' : 'checkmark-circle-outline'} size={20} color={item.activo ? colors.error : colors.success} />
      </TouchableOpacity>
    </TouchableOpacity>
  ), [colors]);

  function renderEmpleadosTab() {
    if (empLoading) return <Skeleton height={200} />;
    return (
      <FlatList
        data={filtered} keyExtractor={(i) => i.id} renderItem={renderEmpleadoCard}
        refreshing={empRefetching} onRefresh={empRefetch}
        contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            <TouchableOpacity onPress={openCreate} style={[styles.actionBtn, { backgroundColor: colors.primary }]}>
              <Ionicons name="person-add-outline" size={18} color="#FFFFFF" />
              <Text style={styles.actionBtnText}>Nuevo empleado</Text>
            </TouchableOpacity>
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { backgroundColor: colors.primaryLight }]}>
                <Text style={[styles.statValue, { color: colors.primary }]}>{resumen?.totalEmpleados ?? 0}</Text>
                <Text style={[styles.statLabel, { color: colors.primary }]}>Empleados</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.secondaryLight }]}>
                <Text style={[styles.statValue, { color: colors.secondary }]}>{formatCurrencyCompact(resumen?.nominalMensual ?? 0)}</Text>
                <Text style={[styles.statLabel, { color: colors.secondary }]}>Nómina/mes</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.infoLight }]}>
                <Text style={[styles.statValue, { color: colors.info }]}>{formatCurrencyCompact(resumen?.pagadoEsteMes ?? 0)}</Text>
                <Text style={[styles.statLabel, { color: colors.info }]}>Pagado/mes</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.warningLight }]}>
                <Text style={[styles.statValue, { color: colors.warning }]}>{formatCurrencyCompact(resumen?.descuentosPendientesMonto ?? 0)}</Text>
                <Text style={[styles.statLabel, { color: colors.warning }]}>Desc. pend.</Text>
              </View>
            </View>
            {resumen && (resumen.presentesHoy > 0 || resumen.ausentesHoy > 0) && (
              <View style={[styles.hoyRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.hoyText, { color: colors.textSecondary }]}>Hoy:</Text>
                <View style={[styles.hoyBadge, { backgroundColor: colors.successLight }]}>
                  <Text style={[styles.hoyBadgeText, { color: colors.success }]}>{resumen.presentesHoy} presente{resumen.presentesHoy !== 1 ? 's' : ''}</Text>
                </View>
                <View style={[styles.hoyBadge, { backgroundColor: colors.errorLight }]}>
                  <Text style={[styles.hoyBadgeText, { color: colors.error }]}>{resumen.ausentesHoy} ausente{resumen.ausentesHoy !== 1 ? 's' : ''}</Text>
                </View>
              </View>
            )}
            <View style={[styles.searchInput, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <Ionicons name="search" size={16} color={colors.textTertiary} />
              <TextInput style={[styles.searchField, { color: colors.text }]} placeholder="Buscar..." placeholderTextColor={colors.textTertiary}
                value={search} onChangeText={setSearch} autoCapitalize="none" autoCorrect={false} />
              {search ? <TouchableOpacity onPress={() => setSearch('')} hitSlop={6}><Ionicons name="close-circle" size={16} color={colors.textTertiary} /></TouchableOpacity> : null}
            </View>
            <View style={styles.filterRow}>
              <TouchableOpacity onPress={() => setMostrarInactivos(false)}
                style={[styles.filterChip, { borderColor: colors.border }, !mostrarInactivos && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                <Text style={[styles.filterChipText, { color: !mostrarInactivos ? '#FFFFFF' : colors.textSecondary }]}>Activos</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setMostrarInactivos(true)}
                style={[styles.filterChip, { borderColor: colors.border }, mostrarInactivos && { backgroundColor: colors.error, borderColor: colors.error }]}>
                <Text style={[styles.filterChipText, { color: mostrarInactivos ? '#FFFFFF' : colors.textSecondary }]}>Inactivos</Text>
              </TouchableOpacity>
              <Text style={[styles.countText, { color: colors.textTertiary }]}>{filtered.length} empleado{filtered.length !== 1 ? 's' : ''}</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>{search ? 'No se encontraron empleados' : 'No hay empleados registrados'}</Text>
          </View>
        }
      />
    );
  }

  // ─── Render: Asistencia tab ─────────────────────────────────
  const renderAsistenciaItem = useCallback(({ item }: { item: EmpleadoConAsistencia }) => {
    const emp = item.empleado;
    const asi = item.asistencia;
    const estado = asi?.estado ?? null;
    const ec = estado ? ESTADO_COLORS[estado] : colors.textTertiary;
    const el = estado ? ESTADO_LABELS[estado] : 'Sin registro';
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.avatar, { backgroundColor: colors.primaryLight }]}>
          <Text style={[styles.avatarText, { color: colors.primary }]}>{emp.nombre[0]}{emp.apellido[0]}</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>{emp.nombre} {emp.apellido}</Text>
          <Text style={[styles.cardSub, { color: colors.textSecondary }]}>{emp.cargo}</Text>
          {estado && (
            <View style={[styles.badge, { backgroundColor: ec + '18', alignSelf: 'flex-start', marginTop: 2 }]}>
              <View style={[styles.dot, { backgroundColor: ec }]} />
              <Text style={[styles.badgeText, { color: ec }]}>{el}</Text>
            </View>
          )}
          {!estado && <Text style={[styles.cardMeta, { color: colors.textTertiary, marginTop: 2 }]}>Sin registro</Text>}
        </View>
        <View style={styles.asiQuick}>
          <TouchableOpacity onPress={() => handleAsiQuick(emp.id, 'PRESENTE')} style={[styles.asiBtn, { backgroundColor: '#16A34A18' }]}>
            <Ionicons name="checkmark" size={18} color="#16A34A" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleAsiQuick(emp.id, 'AUSENTE')} style={[styles.asiBtn, { backgroundColor: '#DC262618' }]}>
            <Ionicons name="close" size={18} color="#DC2626" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleAsiQuick(emp.id, 'TARDANZA')} style={[styles.asiBtn, { backgroundColor: '#D9770618' }]}>
            <Ionicons name="time-outline" size={18} color="#D97706" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => {
            setAsiDetalleTarget(emp.id);
            setAsiDetalleForm({
              estado: asi?.estado ?? 'PRESENTE',
              entrada: asi?.entrada ?? '',
              salida: asi?.salida ?? '',
              observacion: asi?.observacion ?? '',
            });
          }} hitSlop={6}>
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [colors, handleAsiQuick]);

  function renderAsistenciaTab() {
    return (
      <FlatList
        data={asistenciaData ?? []} keyExtractor={(i) => i.empleado.id} renderItem={renderAsistenciaItem}
        refreshing={asiRefetching} onRefresh={asiRefetch}
        contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <View style={styles.asiHeader}>
              <View style={{ flex: 1 }}>
                <DatePickerField label="Fecha" value={asiFecha} onChange={setAsiFecha} />
              </View>
              <TouchableOpacity onPress={() => setAsiFecha(getTodayISO())} style={[styles.asiHoyBtn, { backgroundColor: colors.primary }]}>
                <Text style={styles.asiHoyText}>Hoy</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.asiStats}>
              <View style={[styles.asiStat, { backgroundColor: '#16A34A18' }]}>
                <Text style={[styles.asiStatValue, { color: '#16A34A' }]}>{asiStats.presentes}</Text>
                <Text style={[styles.asiStatLabel, { color: '#16A34A' }]}>Presentes</Text>
              </View>
              <View style={[styles.asiStat, { backgroundColor: '#D9770618' }]}>
                <Text style={[styles.asiStatValue, { color: '#D97706' }]}>{asiStats.tardanzas}</Text>
                <Text style={[styles.asiStatLabel, { color: '#D97706' }]}>Tardanzas</Text>
              </View>
              <View style={[styles.asiStat, { backgroundColor: '#DC262618' }]}>
                <Text style={[styles.asiStatValue, { color: '#DC2626' }]}>{asiStats.ausentes}</Text>
                <Text style={[styles.asiStatLabel, { color: '#DC2626' }]}>Ausentes</Text>
              </View>
              <View style={[styles.asiStat, { backgroundColor: colors.infoLight }]}>
                <Text style={[styles.asiStatValue, { color: colors.info }]}>{asiStats.otros}</Text>
                <Text style={[styles.asiStatLabel, { color: colors.info }]}>Otros</Text>
              </View>
            </View>
            <Text style={[styles.asiSubtitle, { color: colors.textSecondary }]}>
              {asiStats.total} empleado{asiStats.total !== 1 ? 's' : ''} · Toque ✓ ✗ ~ para acción rápida
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No hay empleados activos</Text>
          </View>
        }
      />
    );
  }

  // ─── Render: Pagos tab ──────────────────────────────────────
  const renderPagoItem = useCallback(({ item }: { item: PagoSalario }) => (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.cardInfo}>
        <View style={styles.cardTop}>
          <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
            {item.empleado.nombre} {item.empleado.apellido}
          </Text>
          <Text style={[styles.cardAmount, { color: colors.primary }]}>{formatCurrencyCompact(item.salarioNeto)}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' }}>
          <Text style={[styles.cardSub, { color: colors.textSecondary }]}>Período {item.periodo}</Text>
          <View style={[styles.badge, { backgroundColor: colors.primaryLight }]}>
            <Text style={[styles.badgeText, { color: colors.primary }]}>{METODO_PAGO_LABELS[item.metodoPago]}</Text>
          </View>
        </View>
        <Text style={[styles.cardMeta, { color: colors.textTertiary }]}>
          Bruto: {formatFullCurrency(item.salarioBruto)} · Desc: {formatFullCurrency(item.totalDescuentos)}
        </Text>
      </View>
    </View>
  ), [colors]);

  function renderPagosTab() {
    return (
      <FlatList
        data={pagos ?? []} keyExtractor={(i) => i.id} renderItem={renderPagoItem}
        refreshing={pagosRefetching} onRefresh={pagosRefetch}
        contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {empleados && empleados.length > 0 && (
              <TouchableOpacity onPress={openPagoForm} style={[styles.actionBtn, { backgroundColor: colors.primary }]}>
                <Ionicons name="cash-outline" size={18} color="#FFFFFF" />
                <Text style={styles.actionBtnText}>Registrar pago</Text>
              </TouchableOpacity>
            )}
            {empleados && (
              <View style={{ marginBottom: Spacing.sm }}>
                <PickerField label="Filtrar por empleado" placeholder="Todos los empleados" value={pagoFilterEmp}
                  options={empleados.filter((e) => e.activo).map((e) => `${e.id}|${e.nombre} ${e.apellido}`)}
                  onSelect={(v) => setPagoFilterEmp(v.split('|')[0])} searchable
                />
              </View>
            )}
            {pagos && pagos.length > 0 && (
              <View style={[styles.card, { backgroundColor: colors.infoLight, borderColor: colors.info, borderWidth: 1, marginBottom: Spacing.sm }]}>
                <Text style={[styles.cardTitle, { color: colors.info, fontWeight: FontWeight.bold }]}>
                  Totales: {formatFullCurrency(pagos.reduce((s: number, p: any) => s + p.salarioBruto, 0))} bruto · {formatFullCurrency(pagos.reduce((s: number, p: any) => s + p.totalDescuentos, 0))} desc · {formatFullCurrency(pagos.reduce((s: number, p: any) => s + p.salarioNeto, 0))} neto
                </Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="cash-outline" size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No hay pagos registrados</Text>
          </View>
        }
      />
    );
  }

  // ─── Render: Descuentos tab ─────────────────────────────────
  function renderDescuentosTab() {
    return (
      <FlatList
        data={descuentos?.filter((d) => !d.aplicado) ?? []} keyExtractor={(i) => i.id}
        refreshing={descRefetching} onRefresh={descRefetch}
        contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {empleados && (
              <View style={{ marginBottom: Spacing.sm }}>
                <PickerField label="Empleado" placeholder="Seleccionar empleado" value={descEmpId}
                  options={empleados.filter((e) => e.activo).map((e) => `${e.id}|${e.nombre} ${e.apellido}`)}
                  onSelect={(v) => setDescEmpId(v.split('|')[0])} searchable
                />
              </View>
            )}
            {descEmpId ? (
              <TouchableOpacity onPress={openDescForm} style={[styles.actionBtn, { backgroundColor: colors.primary }]}>
                <Ionicons name="pricetag-outline" size={18} color="#FFFFFF" />
                <Text style={styles.actionBtnText}>Nuevo descuento</Text>
              </TouchableOpacity>
            ) : null}
            {descuentos && descuentos.filter((d) => !d.aplicado).length > 0 && (
              <View style={[styles.card, { backgroundColor: colors.warningLight, borderColor: colors.warning, borderWidth: 1, marginBottom: Spacing.sm }]}>
                <Text style={[styles.cardTitle, { color: colors.warning, fontWeight: FontWeight.bold }]}>
                  Total pendiente: {formatFullCurrency(descTotalPendiente)}
                </Text>
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.cardInfo}>
              <View style={styles.cardTop}>
                <View style={[styles.badge, { backgroundColor: ESTADO_COLORS.TARDANZA + '18' }]}>
                  <Text style={[styles.badgeText, { color: ESTADO_COLORS.TARDANZA }]}>{TIPO_DESC_LABELS[item.tipo]}</Text>
                </View>
                <Text style={[styles.cardAmount, { color: colors.error }]}>{formatCurrencyCompact(item.monto)}</Text>
              </View>
              <Text style={[styles.cardSub, { color: colors.text }]}>{item.descripcion}</Text>
              <Text style={[styles.cardMeta, { color: colors.textTertiary }]}>
                {new Date(item.fecha).toLocaleDateString('es-DO')} · {item.aplicado ? 'Aplicado' : 'Pendiente'}
              </Text>
            </View>
            {!item.aplicado && (
              <TouchableOpacity onPress={() => setDeleteDescTarget(item.id)} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={colors.error} />
              </TouchableOpacity>
            )}
          </View>
        )}
        ListEmptyComponent={
          descEmpId ? (
            <View style={styles.emptyState}>
              <Ionicons name="pricetag-outline" size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textTertiary }]}>Sin descuentos pendientes</Text>
            </View>
          ) : null
        }
      />
    );
  }

  // ─── Main render ────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {renderTabBar()}

      {tab === 'empleados' && renderEmpleadosTab()}
      {tab === 'asistencia' && renderAsistenciaTab()}
      {tab === 'pagos' && renderPagosTab()}
      {tab === 'descuentos' && renderDescuentosTab()}

      {/* ─── Modal: Crear/Editar Empleado ──────────────────────── */}
      <Modal visible={showForm} transparent animationType="slide" onRequestClose={closeForm}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={[styles.overlay, { backgroundColor: colors.overlay }]} onPress={closeForm}>
            <Pressable style={[styles.sheet, { backgroundColor: colors.surfaceElevated }]}>
              <View style={styles.sheetHeader}>
                <Text style={[styles.sheetTitle, { color: colors.text }]}>{isEditing ? 'Editar empleado' : 'Nuevo empleado'}</Text>
                <TouchableOpacity onPress={closeForm} hitSlop={8}><Ionicons name="close" size={24} color={colors.textTertiary} /></TouchableOpacity>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={styles.formRow}>
                  <View style={styles.formHalf}><AppInput label="Nombre" placeholder="Nombres" value={empForm.nombre} onChangeText={(v) => setEmpForm((p) => ({ ...p, nombre: v }))} /></View>
                  <View style={styles.formHalf}><AppInput label="Apellido" placeholder="Apellidos" value={empForm.apellido} onChangeText={(v) => setEmpForm((p) => ({ ...p, apellido: v }))} /></View>
                </View>
                <AppInput label="Cédula" placeholder="000-0000000-0" value={empForm.cedula} onChangeText={(v) => setEmpForm((p) => ({ ...p, cedula: v }))} />
                <View style={styles.formRow}>
                  <View style={styles.formHalf}><AppInput label="Cargo" placeholder="Ej: Cobrador" value={empForm.cargo} onChangeText={(v) => setEmpForm((p) => ({ ...p, cargo: v }))} /></View>
                  <View style={styles.formHalf}><AppInput label="Departamento" placeholder="Opcional" value={empForm.departamento} onChangeText={(v) => setEmpForm((p) => ({ ...p, departamento: v }))} /></View>
                </View>
                <View style={styles.formRow}>
                  <View style={styles.formHalf}><AppInput label="Salario" placeholder="0.00" value={empForm.salario} onChangeText={(v) => setEmpForm((p) => ({ ...p, salario: v }))} keyboardType="decimal-pad" /></View>
                  <View style={styles.formHalf}><PickerField label="Frecuencia" placeholder="Seleccionar..." value={empForm.frecuenciaPago} options={FRECUENCIA_OPTIONS} onSelect={(v) => setEmpForm((p) => ({ ...p, frecuenciaPago: v as FrecuenciaPago }))} /></View>
                </View>
                <DatePickerField label="Fecha de ingreso" value={empForm.fechaIngreso} onChange={(v) => setEmpForm((p) => ({ ...p, fechaIngreso: v }))} />
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Contacto (opcional)</Text>
                <View style={styles.formRow}>
                  <View style={styles.formHalf}><AppInput label="Teléfono" placeholder="809-000-0000" value={empForm.telefono} onChangeText={(v) => setEmpForm((p) => ({ ...p, telefono: v }))} keyboardType="phone-pad" /></View>
                  <View style={styles.formHalf}><AppInput label="Celular" placeholder="809-000-0000" value={empForm.celular} onChangeText={(v) => setEmpForm((p) => ({ ...p, celular: v }))} keyboardType="phone-pad" /></View>
                </View>
                <AppInput label="Email" placeholder="correo@ejemplo.com" value={empForm.email} onChangeText={(v) => setEmpForm((p) => ({ ...p, email: v }))} keyboardType="email-address" autoCapitalize="none" />
                <AppInput label="Observaciones (opcional)" placeholder="Notas adicionales..." value={empForm.observaciones} onChangeText={(v) => setEmpForm((p) => ({ ...p, observaciones: v }))} multiline />
                <AppButton title={isEditing ? 'Actualizar empleado' : 'Guardar empleado'} onPress={handleSubmit} loading={crearMutation.isPending || actualizarMutation.isPending} icon={isEditing ? 'create-outline' : 'save-outline'} />
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Modal: Detalle Asistencia ─────────────────────────── */}
      <Modal visible={!!asiDetalleTarget} transparent animationType="slide" onRequestClose={() => setAsiDetalleTarget(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={[styles.overlay, { backgroundColor: colors.overlay }]} onPress={() => setAsiDetalleTarget(null)}>
            <Pressable style={[styles.sheet, { backgroundColor: colors.surfaceElevated }]}>
              <View style={styles.sheetHeader}>
                <Text style={[styles.sheetTitle, { color: colors.text }]}>Registrar asistencia</Text>
                <TouchableOpacity onPress={() => setAsiDetalleTarget(null)} hitSlop={8}><Ionicons name="close" size={24} color={colors.textTertiary} /></TouchableOpacity>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={styles.fieldLabel}>Estado</Text>
                <View style={styles.asiEstadoGrid}>
                  {(['PRESENTE', 'AUSENTE', 'TARDANZA', 'MEDIO_DIA', 'FERIADO', 'VACACIONES'] as EstadoAsistencia[]).map((est) => {
                    const sel = asiDetalleForm.estado === est;
                    return (
                      <TouchableOpacity key={est} onPress={() => setAsiDetalleForm((p) => ({ ...p, estado: est }))}
                        style={[styles.asiEstadoBtn, { borderColor: ESTADO_COLORS[est], backgroundColor: sel ? ESTADO_COLORS[est] + '18' : 'transparent' }]}>
                        <Text style={[styles.asiEstadoText, { color: ESTADO_COLORS[est], fontWeight: sel ? FontWeight.bold : FontWeight.medium }]}>{ESTADO_LABELS[est]}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={styles.formRow}>
                  <View style={styles.formHalf}><AppInput label="Entrada (HH:MM)" placeholder="08:00" value={asiDetalleForm.entrada} onChangeText={(v) => setAsiDetalleForm((p) => ({ ...p, entrada: v }))} /></View>
                  <View style={styles.formHalf}><AppInput label="Salida (HH:MM)" placeholder="17:00" value={asiDetalleForm.salida} onChangeText={(v) => setAsiDetalleForm((p) => ({ ...p, salida: v }))} /></View>
                </View>
                <AppInput label="Observación" placeholder="Opcional..." value={asiDetalleForm.observacion} onChangeText={(v) => setAsiDetalleForm((p) => ({ ...p, observacion: v }))} />
                <AppButton title="Guardar asistencia" onPress={handleAsiDetalle} loading={registrarAsiMutation.isPending} icon="save-outline" />
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Modal: Registrar Pago ─────────────────────────────── */}
      <Modal visible={showPagoForm} transparent animationType="slide" onRequestClose={() => setShowPagoForm(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={[styles.overlay, { backgroundColor: colors.overlay }]} onPress={() => setShowPagoForm(false)}>
            <Pressable style={[styles.sheet, { backgroundColor: colors.surfaceElevated }]}>
              <View style={styles.sheetHeader}>
                <Text style={[styles.sheetTitle, { color: colors.text }]}>Registrar pago</Text>
                <TouchableOpacity onPress={() => setShowPagoForm(false)} hitSlop={8}><Ionicons name="close" size={24} color={colors.textTertiary} /></TouchableOpacity>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                {empleados && (
                  <PickerField label="Empleado" placeholder="Seleccionar..." value={pagoForm.empleadoId}
                    options={empleados.filter((e) => e.activo).map((e) => `${e.id}|${e.nombre} ${e.apellido} · ${e.cargo}`)}
                    onSelect={handlePagoEmpChange} searchable
                  />
                )}
                {pagoForm.empleadoId && empleados && (() => {
                  const emp = empleados.find((e) => e.id === pagoForm.empleadoId);
                  if (!emp) return null;
                  return (
                    <View style={[styles.card, { backgroundColor: colors.primaryLight, marginBottom: Spacing.md, padding: Spacing.sm, borderRadius: BorderRadius.md }]}>
                      <Text style={[styles.cardTitle, { color: colors.primary }]}>{emp.nombre} {emp.apellido}</Text>
                      <Text style={[{ color: colors.primary, fontSize: FontSize.sm }]}>
                        Salario: {formatFullCurrency(emp.salario)} · {FRECUENCIA_LABELS[emp.frecuenciaPago]}
                      </Text>
                    </View>
                  );
                })()}
                <View style={styles.formRow}>
                  <View style={styles.formHalf}><AppInput label="Período" placeholder="YYYY-MM" value={pagoForm.periodo} onChangeText={(v) => setPagoForm((p) => ({ ...p, periodo: v }))} /></View>
                  <View style={styles.formHalf}><PickerField label="Método" placeholder="Seleccionar..." value={pagoForm.metodoPago} options={METODO_PAGO_OPTIONS} onSelect={(v) => setPagoForm((p) => ({ ...p, metodoPago: v as MetodoPago }))} /></View>
                </View>
                <AppInput label="Descripción" placeholder="Opcional..." value={pagoForm.descripcion} onChangeText={(v) => setPagoForm((p) => ({ ...p, descripcion: v }))} />
                {pagoDescuentos && pagoDescuentos.filter((d) => !d.aplicado).length > 0 && (
                  <>
                    <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Descuentos pendientes</Text>
                    {pagoDescuentos.filter((d) => !d.aplicado).map((d) => {
                      const sel = pagoForm.descuentoIds.includes(d.id);
                      return (
                        <TouchableOpacity key={d.id} onPress={() => setPagoForm((p) => ({
                          ...p, descuentoIds: sel ? p.descuentoIds.filter((id) => id !== d.id) : [...p.descuentoIds, d.id],
                        }))} style={[styles.pagoDescItem, { backgroundColor: sel ? colors.primaryLight : colors.surface, borderColor: colors.border }]}>
                          <Ionicons name={sel ? 'checkbox' : 'square-outline'} size={20} color={sel ? colors.primary : colors.textTertiary} />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.cardSub, { color: colors.text }]}>{d.descripcion}</Text>
                            <Text style={[styles.cardMeta, { color: colors.textTertiary }]}>{TIPO_DESC_LABELS[d.tipo]} · {formatFullCurrency(d.monto)}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </>
                )}
                <View style={[styles.card, { backgroundColor: colors.infoLight, padding: Spacing.sm, borderRadius: BorderRadius.md, marginTop: Spacing.sm }]}>
                  <Text style={[{ color: colors.info, fontSize: FontSize.sm }]}>
                    Bruto: {formatFullCurrency(pagoTotales.bruto)} · Descuentos: {formatFullCurrency(pagoTotales.descuentos)} · Neto: {formatFullCurrency(pagoTotales.neto)}
                  </Text>
                </View>
                <AppButton title="Registrar pago" onPress={handleRegistrarPago} loading={registrarPagoMutation.isPending} icon="cash-outline" />
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Modal: Crear Descuento ────────────────────────────── */}
      <Modal visible={showDescForm} transparent animationType="slide" onRequestClose={() => setShowDescForm(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={[styles.overlay, { backgroundColor: colors.overlay }]} onPress={() => setShowDescForm(false)}>
            <Pressable style={[styles.sheet, { backgroundColor: colors.surfaceElevated }]}>
              <View style={styles.sheetHeader}>
                <Text style={[styles.sheetTitle, { color: colors.text }]}>Nuevo descuento</Text>
                <TouchableOpacity onPress={() => setShowDescForm(false)} hitSlop={8}><Ionicons name="close" size={24} color={colors.textTertiary} /></TouchableOpacity>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                {empleados && (
                  <PickerField label="Empleado" placeholder="Seleccionar..." value={descForm.empleadoId}
                    options={empleados.filter((e) => e.activo).map((e) => `${e.id}|${e.nombre} ${e.apellido}`)}
                    onSelect={(v) => setDescForm((p) => ({ ...p, empleadoId: v.split('|')[0] }))} searchable
                  />
                )}
                <Text style={styles.fieldLabel}>Tipo</Text>
                <View style={styles.asiEstadoGrid}>
                  {(['TARDANZA', 'AUSENCIA', 'PRESTAMO', 'OTRO'] as TipoDescuento[]).map((t) => {
                    const sel = descForm.tipo === t;
                    return (
                      <TouchableOpacity key={t} onPress={() => setDescForm((p) => ({ ...p, tipo: t }))}
                        style={[styles.asiEstadoBtn, { borderColor: colors.border, backgroundColor: sel ? colors.primary : 'transparent' }]}>
                        <Text style={[styles.asiEstadoText, { color: sel ? '#FFFFFF' : colors.textSecondary, fontWeight: sel ? FontWeight.bold : FontWeight.medium }]}>{TIPO_DESC_LABELS[t]}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <AppInput label="Monto" placeholder="0.00" value={descForm.monto} onChangeText={(v) => setDescForm((p) => ({ ...p, monto: v }))} keyboardType="decimal-pad" />
                <AppInput label="Descripción" placeholder="Ej: Descuento por tardanza" value={descForm.descripcion} onChangeText={(v) => setDescForm((p) => ({ ...p, descripcion: v }))} />
                <AppButton title="Crear descuento" onPress={handleCrearDesc} loading={crearDescMutation.isPending} icon="pricetag-outline" />
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Confirm: Toggle activo ────────────────────────────── */}
      <ConfirmDialog
        visible={!!toggleTarget}
        title={toggleTarget?.activo ? 'Desactivar empleado' : 'Reactivar empleado'}
        message={toggleTarget ? (toggleTarget.activo ? `¿Desactivar a ${toggleTarget.nombre} ${toggleTarget.apellido}?` : `¿Reactivar a ${toggleTarget.nombre} ${toggleTarget.apellido}?`) : ''}
        confirmLabel={toggleTarget?.activo ? 'Desactivar' : 'Reactivar'}
        cancelLabel="Cancelar" destructive={!!toggleTarget?.activo}
        onConfirm={handleToggleActivo} onCancel={() => setToggleTarget(null)}
        loading={desactivarMutation.isPending || reactivarMutation.isPending}
      />

      {/* ─── Confirm: Eliminar descuento ───────────────────────── */}
      <ConfirmDialog
        visible={!!deleteDescTarget}
        title="Eliminar descuento"
        message="¿Eliminar este descuento pendiente?"
        confirmLabel="Eliminar" cancelLabel="Cancelar" destructive
        onConfirm={handleEliminarDesc} onCancel={() => setDeleteDescTarget(null)}
        loading={eliminarDescMutation.isPending}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { padding: Spacing.md, paddingBottom: Spacing.xxl },

  // Tab bar
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, paddingHorizontal: Spacing.sm },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: Spacing.sm },
  tabLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },

  // Action button
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 44, borderRadius: BorderRadius.md, gap: Spacing.sm, marginBottom: Spacing.md, ...Shadows.sm },
  actionBtnText: { color: '#FFFFFF', fontSize: FontSize.sm, fontWeight: FontWeight.semibold },

  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.sm },
  statCard: { width: '48%', borderRadius: BorderRadius.lg, padding: Spacing.md, alignItems: 'center' },
  statValue: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  statLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.medium, marginTop: 1 },
  hoyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: Spacing.sm },
  hoyText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  hoyBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.sm },
  hoyBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },

  // Search + filter
  searchInput: { flexDirection: 'row', alignItems: 'center', height: 40, borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, gap: Spacing.sm, marginBottom: Spacing.sm },
  searchField: { flex: 1, fontSize: FontSize.sm, paddingVertical: 0 },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  filterChip: { paddingHorizontal: Spacing.md, paddingVertical: 5, borderRadius: BorderRadius.full, borderWidth: 1 },
  filterChipText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  countText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium, flex: 1, textAlign: 'right' },

  // Card
  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: Spacing.xs },
  avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  cardInfo: { flex: 1 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 1 },
  cardTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, flex: 1, marginRight: Spacing.sm },
  cardAmount: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  cardSub: { fontSize: FontSize.xs, marginBottom: 1 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardMeta: { fontSize: FontSize.xs },
  cardAction: { padding: Spacing.xs },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.sm },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },

  // Asistencia
  asiHeader: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm, marginBottom: Spacing.sm },
  asiHoyBtn: { height: 48, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center' },
  asiHoyText: { color: '#FFFFFF', fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  asiStats: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  asiStat: { flex: 1, borderRadius: BorderRadius.md, padding: Spacing.sm, alignItems: 'center' },
  asiStatValue: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  asiStatLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.medium, marginTop: 1 },
  asiSubtitle: { fontSize: FontSize.xs, marginBottom: Spacing.sm },
  asiQuick: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  asiBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  asiEstadoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.md },
  asiEstadoBtn: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: BorderRadius.full, borderWidth: 1 },
  asiEstadoText: { fontSize: FontSize.xs },

  // Pagos
  pagoDescItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: Spacing.xs },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl * 2, gap: Spacing.sm },
  emptyText: { fontSize: FontSize.sm, textAlign: 'center' },

  // Modals
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.lg, paddingBottom: Spacing.xxl, maxHeight: '92%' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  sheetTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  formRow: { flexDirection: 'row', gap: Spacing.sm },
  formHalf: { flex: 1 },
  sectionLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, marginBottom: Spacing.xs, marginTop: Spacing.xs },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: '#6B7280', marginBottom: Spacing.xs },
});
