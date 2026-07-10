import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScreenContainer } from '@/components/ui/screen-container';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { usePrestamo,
  useCancelarPrestamo,
  useDesembolsarPrestamo,
  useRefinanciarPrestamo,
  useCambiarEstadoPrestamo } from '@/hooks/use-prestamos';
import { AppButton } from '@/components/ui/app-button';
import ActionConfirmModal from '@/components/ui/action-confirm-modal';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import EmptyState from '@/components/ui/empty-state';
import LoadingScreen from '@/components/ui/loading-screen';
import { SkeletonCard, SkeletonKPIGrid } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { useAuthStore } from '@/store/auth.store';
import { FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { ESTADO_CONFIG, ACCIONES_FLOW_CONFIG } from '@/constants/prestamos.constants';
import { formatCurrency, formatDate, formatDateTime } from '@/utils/formatters';
import type { ApiError } from '@/types/api.types';
import type { EstadoPrestamo, Cuota, Pago, FrecuenciaPago } from '@/types/prestamo.types';
import { useTheme } from '@/components/ui/theme-provider';

const FLOW_ACCION_CONFIG = ACCIONES_FLOW_CONFIG;

const FREQ_LABEL: Record<string, string> = {
  DIARIO: 'diario',
  SEMANAL: 'semanal',
  QUINCENAL: 'quincenal',
  MENSUAL: 'mensual',
};

const RefinanciarModal = ({ visible, onClose, prestamoId, onSuccess }: any) => {
  const { colorScheme, colors } = useTheme();
  const refinanciarMutation = useRefinanciarPrestamo();
  const [nuevasCuotas, setNuevasCuotas] = useState('');
  const [nuevaTasa, setNuevaTasa] = useState('');

  const handleRefinanciar = useCallback(async () => {
    if (!nuevasCuotas || !nuevaTasa) return;
    try {
      await refinanciarMutation.mutateAsync({
        id: prestamoId,
        data: { nuevasCuotas: parseInt(nuevasCuotas), nuevaTasa: parseFloat(nuevaTasa) },
      });
      onSuccess?.();
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Error al refinanciar');
    }
  }, [nuevasCuotas, nuevaTasa, prestamoId, refinanciarMutation, onSuccess, onClose]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={refiStyles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[refiStyles.overlay, { backgroundColor: colors.overlay }]}>
          <View style={[refiStyles.card, { backgroundColor: colors.surfaceElevated }]}>
            <View style={[refiStyles.headerBar, { backgroundColor: '#6D28D9' }]}>
              <Ionicons name="refresh" size={22} color="#FFFFFF" />
              <Text style={refiStyles.title}>Refinanciar Préstamo</Text>
            </View>
            <ScrollView style={refiStyles.body} keyboardShouldPersistTaps="handled">
              <Text style={[refiStyles.label, { color: colors.textSecondary }]}>
                Nuevo número de cuotas
              </Text>
              <TextInput
                value={nuevasCuotas}
                onChangeText={setNuevasCuotas}
                placeholder="Ej: 12"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numeric"
                style={[refiStyles.input, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, color: colors.text }]}
              />
              <Text style={[refiStyles.label, { color: colors.textSecondary }]}>
                Nueva tasa de interés (%)
              </Text>
              <TextInput
                value={nuevaTasa}
                onChangeText={setNuevaTasa}
                placeholder="Ej: 3.5"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
                style={[refiStyles.input, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, color: colors.text }]}
              />
              <View style={refiStyles.actions}>
                <AppButton title="Cancelar" onPress={onClose} variant="ghost" style={{ flex: 1 }} />
                <AppButton
                  title="Refinanciar"
                  onPress={handleRefinanciar}
                  loading={refinanciarMutation.isPending}
                  disabled={!nuevasCuotas || !nuevaTasa}
                  style={{ flex: 1 }}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const refiStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  title: { color: '#FFFFFF', fontSize: FontSize.md, fontWeight: FontWeight.bold },
  body: { padding: Spacing.md },
  label: { fontSize: FontSize.sm, marginBottom: Spacing.xs },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    fontSize: FontSize.sm,
    marginBottom: Spacing.md,
  },
  actions: { flexDirection: 'row', gap: Spacing.sm },
});

const InfoItem = ({ label, value }: { label: string; value: string }) => (
  <View style={infoStyles.item}>
    <Text style={infoStyles.label}>{label}</Text>
    <Text style={infoStyles.value} numberOfLines={2}>{value || '—'}</Text>
  </View>
);

const infoStyles = StyleSheet.create({
  item: { marginBottom: Spacing.xs },
  label: { fontSize: 10, color: '#94A3B8', fontWeight: FontWeight.medium, textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, marginTop: 1 },
});

const CuotaBadge = ({ pagada, vencida }: { pagada: boolean; vencida: boolean }) => {
  const { colorScheme, colors } = useTheme();
  if (pagada) {
    return <Text style={[badgeStyles.badge, { backgroundColor: colors.successLight, borderColor: colors.success, color: colors.success }]}>Pagada</Text>;
  }
  if (vencida) {
    return <Text style={[badgeStyles.badge, { backgroundColor: colors.errorLight, borderColor: colors.error, color: colors.error }]}>Vencida</Text>;
  }
  return <Text style={[badgeStyles.badge, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textTertiary }]}>Pendiente</Text>;
};

const badgeStyles = StyleSheet.create({
  badge: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    overflow: 'hidden',
  },
});

export default function PrestamoDetalleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colorScheme, colors } = useTheme();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.rol === 'SUPERADMIN' || user?.rol === 'ADMIN';
  const userId = user?.id;
  const { showToast } = useToast();

  const { data: prestamo, isLoading, error: queryError, refetch } = usePrestamo(id!);
  const { mutateAsync: cancelarMutation, isPending: isCancelando } = useCancelarPrestamo();
  const { mutateAsync: desembolsarMutation, isPending: isDesembolsando } = useDesembolsarPrestamo();
  const cambiarEstadoMutation = useCambiarEstadoPrestamo();

  const [tab, setTab] = useState<'cuotas' | 'pagos'>('cuotas');
  const [filtroCuotas, setFiltroCuotas] = useState<string>('todas');
  const [showDesembolsoModal, setShowDesembolsoModal] = useState(false);
  const [showCancelarConfirm, setShowCancelarConfirm] = useState(false);
  const [showRefinanciarModal, setShowRefinanciarModal] = useState(false);
  const [confirmacionTexto, setConfirmacionTexto] = useState('');
  const [showFlowModal, setShowFlowModal] = useState(false);
  const [flowAccion, setFlowAccion] = useState<{ accion: string; estado: string } | null>(null);

  const cuotas = prestamo?.cuotas || [];
  const pagos = prestamo?.pagos || [];
  const cuotasPendientes = cuotas.filter(c => !c.pagada);
  const cuotasPagadas = cuotas.filter(c => c.pagada);
  const cuotasVencidas = cuotasPendientes.filter(c => new Date(c.fechaVencimiento) < new Date());
  const proximaCuota = [...cuotasPendientes].sort((a, b) => new Date(a.fechaVencimiento).getTime() - new Date(b.fechaVencimiento).getTime())[0];
  const progresoPorc = cuotas.length > 0 ? Math.round((cuotasPagadas.length / cuotas.length) * 100) : 0;
  const puedeCancelar = prestamo && !['PAGADO', 'CANCELADO'].includes(prestamo.estado);
  const puedeRefinanciar = prestamo && ['ACTIVO', 'ATRASADO'].includes(prestamo.estado);
  const puedePagar = prestamo && ['ACTIVO', 'ATRASADO'].includes(prestamo.estado);
  const puedeDesembolsar = prestamo?.estado === 'APROBADO' && (isAdmin || prestamo.solicitadoPor === userId);

  const cuotasFiltradas = useMemo(() => {
    if (filtroCuotas === 'pendientes') return cuotasPendientes;
    if (filtroCuotas === 'vencidas') return cuotasVencidas;
    if (filtroCuotas === 'pagadas') return cuotasPagadas;
    return cuotas;
  }, [filtroCuotas, cuotas, cuotasPendientes, cuotasVencidas, cuotasPagadas]);

  const FILTROS_CUOTAS = [
    { id: 'todas', label: 'Todas', count: cuotas.length },
    { id: 'pendientes', label: 'Pendientes', count: cuotasPendientes.length },
    { id: 'vencidas', label: 'Vencidas', count: cuotasVencidas.length, color: colors.error },
    { id: 'pagadas', label: 'Pagadas', count: cuotasPagadas.length, color: colors.success },
  ];

  const handleCancelar = useCallback(async () => {
    if (!prestamo) return;
    try {
      await cancelarMutation(prestamo.id);
      setShowCancelarConfirm(false);
      showToast('Préstamo cancelado exitosamente', 'success');
      refetch();
    } catch (err) {
      const { message } = err as ApiError;
      showToast(message || 'Error al cancelar el préstamo', 'error');
    }
  }, [prestamo, cancelarMutation, showToast, refetch]);

  const handleDesembolsar = useCallback(async () => {
    if (!prestamo) return;
    try {
      await desembolsarMutation(prestamo.id);
      setShowDesembolsoModal(false);
      setConfirmacionTexto('');
      showToast('Préstamo desembolsado exitosamente', 'success');
      refetch();
    } catch (err) {
      const { message } = err as ApiError;
      showToast(message || 'Error al desembolsar', 'error');
      setShowDesembolsoModal(false);
    }
  }, [prestamo, desembolsarMutation, showToast, refetch]);

  const ejecutarFlowAccion = useCallback(async (motivo?: string) => {
    if (!flowAccion || !prestamo) return;
    const { accion, estado } = flowAccion;
    try {
      await cambiarEstadoMutation.mutateAsync({
        id: prestamo.id,
        data: { estado: estado as EstadoPrestamo, motivo },
      });
      setShowFlowModal(false);
      setFlowAccion(null);
      showToast(`Estado actualizado a ${estado}`, 'success');
      refetch();
    } catch (err: any) {
      setShowFlowModal(false);
      setFlowAccion(null);
      showToast(err?.message || 'Error al cambiar estado', 'error');
    }
  }, [flowAccion, prestamo, cambiarEstadoMutation, showToast, refetch]);

  if (isLoading) {
    return (
      <ScreenContainer style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={styles.skeletonContainer}>
          <SkeletonCard lines={2} />
          <SkeletonCard lines={4} style={{ marginTop: 16 }} />
          <SkeletonCard lines={6} style={{ marginTop: 16 }} />
        </View>
      </ScreenContainer>
    );
  }

  if (queryError && !prestamo) {
    return (
      <ScreenContainer style={[styles.screen, { backgroundColor: colors.background }]}>
        <EmptyState
          icon="alert-circle-outline"
          title="Préstamo no encontrado"
          subtitle={(queryError as any)?.message || 'Error al cargar el préstamo'}
          actionLabel="Volver"
          onAction={() => router.back()}
        />
      </ScreenContainer>
    );
  }

  if (!prestamo) return null;

  const cliente = prestamo.cliente;
  const estadoCfg = ESTADO_CONFIG[prestamo.estado] || ESTADO_CONFIG.ACTIVO;
  const flowCfg = flowAccion ? FLOW_ACCION_CONFIG[flowAccion.accion] : null;

  return (
    <ScreenContainer style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerInfo}>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            Detalle del Préstamo
          </Text>
          <Text style={[styles.headerSub, { color: colors.textTertiary }]}>
            #{prestamo.id.slice(0, 8)}
          </Text>
        </View>
        <View style={[styles.estadoBadge, { backgroundColor: estadoCfg.bg }]}>
          <Ionicons name={estadoCfg.icon as any} size={12} color={estadoCfg.color} />
          <Text style={[styles.estadoBadgeText, { color: estadoCfg.color }]}>{estadoCfg.label}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Action buttons */}
        <View style={styles.actionRow}>
          {/* Flow actions: Revisar / Aprobar / Rechazar */}
          {prestamo.estado === 'SOLICITADO' && isAdmin && (
            <>
              <Pressable
                onPress={() => { setFlowAccion({ accion: 'EN_REVISION', estado: 'EN_REVISION' }); setShowFlowModal(true); }}
                style={[styles.actionButton, { backgroundColor: '#6D28D9' }]}
              >
                <Ionicons name="search-outline" size={16} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>Revisar</Text>
              </Pressable>
              <Pressable
                onPress={() => { setFlowAccion({ accion: 'RECHAZADO', estado: 'RECHAZADO' }); setShowFlowModal(true); }}
                style={[styles.actionButton, { backgroundColor: colors.error }]}
              >
                <Ionicons name="close-circle-outline" size={16} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>Rechazar</Text>
              </Pressable>
            </>
          )}
          {prestamo.estado === 'EN_REVISION' && isAdmin && (
            <>
              <Pressable
                onPress={() => { setFlowAccion({ accion: 'APROBADO', estado: 'APROBADO' }); setShowFlowModal(true); }}
                style={[styles.actionButton, { backgroundColor: '#047857' }]}
              >
                <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>Aprobar</Text>
              </Pressable>
              <Pressable
                onPress={() => { setFlowAccion({ accion: 'RECHAZADO', estado: 'RECHAZADO' }); setShowFlowModal(true); }}
                style={[styles.actionButton, { backgroundColor: colors.error }]}
              >
                <Ionicons name="close-circle-outline" size={16} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>Rechazar</Text>
              </Pressable>
            </>
          )}
          {prestamo.estado === 'APROBADO' && isAdmin && (
            <>
              <Pressable
                onPress={() => { setFlowAccion({ accion: 'RECHAZADO', estado: 'RECHAZADO' }); setShowFlowModal(true); }}
                style={[styles.actionButton, { backgroundColor: colors.error }]}
              >
                <Ionicons name="close-circle-outline" size={16} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>Rechazar</Text>
              </Pressable>
            </>
          )}

          {/* Registrar Pago */}
          {puedePagar && (
            <Pressable
              onPress={() => router.push(`/caja/pago?prestamoId=${prestamo.id}`)}
              style={[styles.actionButton, { backgroundColor: '#16A34A' }]}
            >
              <Ionicons name="cash" size={16} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Cobrar</Text>
            </Pressable>
          )}

          {/* Existing actions */}
          {puedeDesembolsar && (
            <Pressable
              onPress={() => setShowDesembolsoModal(true)}
              style={[styles.actionButton, { backgroundColor: '#1A56DB' }]}
            >
              <Ionicons name="cash" size={16} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Desembolsar</Text>
            </Pressable>
          )}
          {puedeRefinanciar && (
            <Pressable
              onPress={() => setShowRefinanciarModal(true)}
              style={[styles.actionButton, { backgroundColor: '#6D28D9' }]}
            >
              <Ionicons name="refresh" size={16} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Refinanciar</Text>
            </Pressable>
          )}
          {puedeCancelar && (
            <Pressable
              onPress={() => setShowCancelarConfirm(true)}
              disabled={isCancelando}
              style={[styles.actionButton, { backgroundColor: colors.error }]}
            >
              <Ionicons name="close" size={16} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>{isCancelando ? '...' : 'Cancelar'}</Text>
            </Pressable>
          )}
        </View>

        {/* Info Grid */}
        <View style={styles.infoGrid}>
          {/* Cliente — pressable to profile */}
          {cliente && (
            <Pressable
              onPress={() => router.push(`/clientes/${cliente.id}?from=prestamos`)}
              style={({ pressed }) => [
                styles.infoCard,
                { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <View style={styles.infoCardHeader}>
                <Text style={styles.infoCardTitle}>Cliente</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
              </View>
              <InfoItem label="Nombre" value={`${cliente.nombre} ${cliente.apellido || ''}`} />
              <InfoItem label="Cédula" value={cliente.cedula} />
              <InfoItem label="Teléfono" value={cliente.telefono || cliente.celular || '—'} />
            </Pressable>
          )}

          {/* Garante — pressable to profile */}
          {prestamo.garante && (
            <Pressable
              onPress={() => router.push(`/clientes/${prestamo.garante!.id}?from=prestamos`)}
              style={({ pressed }) => [
                styles.infoCard,
                { backgroundColor: colors.surface, borderColor: colors.success, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <View style={styles.infoCardHeader}>
                <Text style={[styles.infoCardTitle, { color: colors.success }]}>Garante</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
              </View>
              <InfoItem label="Nombre" value={`${prestamo.garante.nombre} ${prestamo.garante.apellido || ''}`} />
              <InfoItem label="Cédula" value={prestamo.garante.cedula} />
              <InfoItem label="Teléfono" value={prestamo.garante.telefono || prestamo.garante.celular || '—'} />
            </Pressable>
          )}

          {/* Condiciones */}
          <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={styles.infoCardTitle}>Condiciones</Text>
            <InfoItem label="Monto original" value={formatCurrency(prestamo.monto)} />
            <InfoItem label="Monto total" value={formatCurrency(prestamo.montoTotal)} />
            <InfoItem label="Tasa" value={prestamo.tasaInteres > 0 ? `${prestamo.tasaInteres}%` : 'Cuota fija'} />
            <InfoItem label="Plazo" value={`${prestamo.numeroCuotas} cuotas`} />
            <InfoItem label="Frecuencia" value={prestamo.frecuenciaPago} />
            <InfoItem label="Inicio" value={formatDate(prestamo.fechaInicio)} />
            <InfoItem label="Vencimiento" value={formatDate(prestamo.fechaVencimiento)} />
          </View>

          {/* Estado actual */}
          <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={styles.infoCardTitle}>Estado actual</Text>
            <InfoItem label="Saldo pendiente" value={formatCurrency(prestamo.saldoPendiente)} />
            <InfoItem label="Mora acumulada" value={formatCurrency(prestamo.moraAcumulada)} />
            <InfoItem
              label="Próxima cuota"
              value={proximaCuota
                ? `${formatCurrency(proximaCuota.monto + (proximaCuota.mora || 0))} — ${formatDate(proximaCuota.fechaVencimiento)}`
                : '—'}
            />
            {/* Progress bar */}
            <View style={{ marginTop: Spacing.sm }}>
              <View style={styles.progressHeader}>
                <Text style={{ fontSize: FontSize.xs, color: colors.textTertiary }}>
                  {cuotasPagadas.length} pagadas
                </Text>
                <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: colors.primary }}>
                  {progresoPorc}%
                </Text>
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${progresoPorc}%`, backgroundColor: colors.primary }]} />
              </View>
              <View style={styles.progressFooter}>
                <Text style={{ fontSize: 10, color: colors.textTertiary }}>
                  {cuotasPendientes.length} pendientes
                  {cuotasVencidas.length > 0 && (
                    <Text style={{ color: colors.error }}> ({cuotasVencidas.length} vencidas)</Text>
                  )}
                </Text>
                <Text style={{ fontSize: 10, color: colors.textTertiary }}>{cuotas.length} total</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Tabs: Cuotas / Pagos */}
        <View style={[styles.tabContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.tabHeader}>
            {[
              { key: 'cuotas', label: `Cuotas (${cuotas.length})` },
              { key: 'pagos', label: `Pagos (${pagos.length})` },
            ].map(({ key, label }) => (
              <Pressable
                key={key}
                onPress={() => setTab(key as 'cuotas' | 'pagos')}
                style={[
                  styles.tabBtn,
                  tab === key && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
                ]}
              >
                <Text style={[
                  styles.tabBtnText,
                  { color: tab === key ? colors.primary : colors.textTertiary },
                  tab === key && { fontWeight: FontWeight.bold },
                ]}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Cuotas tab */}
          {tab === 'cuotas' && (
            <>
              <View style={styles.cuotaFilters}>
                {FILTROS_CUOTAS.map(f => (
                  <Pressable
                    key={f.id}
                    onPress={() => setFiltroCuotas(f.id)}
                    style={[
                      styles.cuotaFilterChip,
                      {
                        backgroundColor: filtroCuotas === f.id ? colors.primary : colors.borderLight,
                        borderColor: filtroCuotas === f.id ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text style={[
                      styles.cuotaFilterText,
                      { color: filtroCuotas === f.id ? '#FFFFFF' : colors.textSecondary },
                    ]}>
                      {f.label} {f.count > 0 && `(${f.count})`}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {cuotasFiltradas.length === 0 ? (
                <View style={styles.tabEmpty}>
                  <Text style={[styles.tabEmptyText, { color: colors.textTertiary }]}>
                    Sin cuotas en esta categoría
                  </Text>
                </View>
              ) : (
                <View>
                  {cuotasFiltradas.map((c: Cuota) => {
                    const vencida = !c.pagada && new Date(c.fechaVencimiento) < new Date();
                    return (
                      <View
                        key={c.id}
                        style={[
                          styles.cuotaCard,
                          {
                            backgroundColor: c.pagada ? colors.borderLight : vencida ? colors.errorLight : colors.surface,
                            borderColor: colors.borderLight,
                          },
                        ]}
                      >
                        <View style={styles.cuotaCardHeader}>
                          <View style={styles.cuotaCardNum}>
                            <Text style={[styles.cuotaCardNumText, { color: colors.text }]}>
                              #{c.numero}
                            </Text>
                            <Text style={[styles.cuotaCardDate, { color: colors.textTertiary }]}>
                              {formatDate(c.fechaVencimiento)}
                            </Text>
                          </View>
                          <CuotaBadge pagada={c.pagada} vencida={vencida} />
                        </View>
                        <View style={styles.cuotaCardAmounts}>
                          <View style={styles.cuotaCardAmt}>
                            <Text style={[styles.cuotaAmtLabel, { color: colors.textTertiary }]}>Capital</Text>
                            <Text style={[styles.cuotaAmtVal, { color: colors.text }]}>{formatCurrency(c.capital)}</Text>
                          </View>
                          <View style={styles.cuotaCardAmt}>
                            <Text style={[styles.cuotaAmtLabel, { color: colors.textTertiary }]}>Interés</Text>
                            <Text style={[styles.cuotaAmtVal, { color: colors.warning }]}>{formatCurrency(c.interes)}</Text>
                          </View>
                          <View style={styles.cuotaCardAmt}>
                            <Text style={[styles.cuotaAmtLabel, { color: colors.textTertiary }]}>Mora</Text>
                            <Text style={[styles.cuotaAmtVal, { color: c.mora > 0 ? colors.error : colors.textTertiary }]}>
                              {c.mora > 0 ? formatCurrency(c.mora) : '—'}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.cuotaCardTotal}>
                          <Text style={[styles.cuotaAmtLabel, { color: colors.textTertiary }]}>Total</Text>
                          <Text style={[styles.cuotaAmtVal, { fontWeight: FontWeight.bold }]}>
                            {formatCurrency(c.monto + (c.mora || 0))}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </>
          )}

          {/* Pagos tab */}
          {tab === 'pagos' && (
            <>
              <Pressable
                onPress={() => router.push(`/pagos/prestamo/${prestamo.id}`)}
                style={[styles.viewAllLink, { backgroundColor: colors.borderLight, borderColor: colors.border }]}
              >
                <Text style={[styles.viewAllLinkText, { color: colors.primary }]}>
                  Ver todos los pagos
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.primary} />
              </Pressable>
              {pagos.length === 0 ? (
                <View style={styles.tabEmpty}>
                  <Ionicons name="cash-outline" size={40} color={colors.textTertiary} style={{ opacity: 0.3 }} />
                  <Text style={[styles.tabEmptyText, { color: colors.textTertiary, marginTop: Spacing.sm }]}>
                    Aún no hay pagos registrados
                  </Text>
                </View>
              ) : (
                <View>
                  {pagos.map((p: Pago) => (
                    <View
                      key={p.id}
                      style={[styles.pagoCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
                    >
                      <View style={styles.pagoCardHeader}>
                        <Text style={[styles.pagoDate, { color: colors.text }]}>
                          {formatDateTime(p.createdAt)}
                        </Text>
                        <View style={[styles.pagoMetodo, { backgroundColor: colors.primaryLight }]}>
                          <Text style={[styles.pagoMetodoText, { color: colors.primary }]}>{p.metodo}</Text>
                        </View>
                      </View>
                      <View style={styles.cuotaCardAmounts}>
                        <View style={styles.cuotaCardAmt}>
                          <Text style={[styles.cuotaAmtLabel, { color: colors.textTertiary }]}>Capital</Text>
                          <Text style={[styles.cuotaAmtVal, { color: colors.text }]}>{formatCurrency(p.capital)}</Text>
                        </View>
                        <View style={styles.cuotaCardAmt}>
                          <Text style={[styles.cuotaAmtLabel, { color: colors.textTertiary }]}>Interés</Text>
                          <Text style={[styles.cuotaAmtVal, { color: colors.warning }]}>{formatCurrency(p.interes)}</Text>
                        </View>
                        <View style={styles.cuotaCardAmt}>
                          <Text style={[styles.cuotaAmtLabel, { color: colors.textTertiary }]}>Mora</Text>
                          <Text style={[styles.cuotaAmtVal, { color: p.mora > 0 ? colors.error : colors.textTertiary }]}>
                            {p.mora > 0 ? formatCurrency(p.mora) : '—'}
                          </Text>
                        </View>
                      </View>
                      <View style={[styles.cuotaCardTotal, { borderTopWidth: 1, borderTopColor: colors.borderLight, marginTop: Spacing.xs, paddingTop: Spacing.xs }]}>
                        <Text style={[styles.cuotaAmtLabel, { color: colors.textTertiary }]}>Total pagado</Text>
                        <Text style={[styles.cuotaAmtVal, { fontWeight: FontWeight.bold, fontSize: FontSize.md }]}>
                          {formatCurrency(p.montoTotal)}
                        </Text>
                      </View>
                      {p.usuario && (
                        <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: Spacing.xs }}>
                          Registrado por: {p.usuario.nombre}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </View>

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>

      {/* Desembolso Modal */}
      <Modal visible={showDesembolsoModal} transparent animationType="fade" onRequestClose={() => setShowDesembolsoModal(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
            <View style={[styles.modalCard, { backgroundColor: colors.surfaceElevated }]}>
              <View style={[styles.modalHeaderBar, { backgroundColor: '#1A56DB' }]}>
                <Ionicons name="cash" size={24} color="#FFFFFF" />
                <Text style={styles.modalTitle}>Desembolsar Préstamo</Text>
              </View>
              <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
                <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>
                  Monto a desembolsar: <Text style={{ fontWeight: FontWeight.bold, color: colors.text }}>{formatCurrency(prestamo.monto)}</Text>
                </Text>
                <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>
                  Cuotas: {prestamo.numeroCuotas} · {prestamo.tasaInteres > 0 ? `${prestamo.tasaInteres}% ${FREQ_LABEL[prestamo.frecuenciaPago] || prestamo.frecuenciaPago}` : 'Cuota fija'}
                </Text>
                <View style={[styles.modalWarning, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
                  <Text style={{ color: '#92400E', fontSize: FontSize.xs }}>
                    El monto saldrá de tu caja. Asegúrate de tener tu caja abierta antes de continuar.
                  </Text>
                </View>
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>
                  Escribe <Text style={{ fontWeight: FontWeight.bold }}>CONFIRMAR</Text> para continuar
                </Text>
                <TextInput
                  value={confirmacionTexto}
                  onChangeText={setConfirmacionTexto}
                  placeholder="CONFIRMAR"
                  placeholderTextColor={colors.textTertiary}
                  style={[styles.confirmInput, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, color: colors.text }]}
                />
                <View style={styles.modalActions}>
                  <AppButton
                    title="Cancelar"
                    onPress={() => { setShowDesembolsoModal(false); setConfirmacionTexto(''); }}
                    variant="ghost"
                    style={{ flex: 1 }}
                  />
                  <AppButton
                    title="Desembolsar"
                    loading={isDesembolsando}
                    disabled={confirmacionTexto.toUpperCase() !== 'CONFIRMAR'}
                    onPress={handleDesembolsar}
                    style={{ flex: 1 }}
                  />
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Confirmar Cancelación */}
      <ConfirmDialog
        visible={showCancelarConfirm}
        title="Cancelar Préstamo"
        message="¿Estás seguro de cancelar este préstamo? Esta acción no se puede deshacer."
        confirmLabel="Cancelar préstamo"
        destructive
        loading={isCancelando}
        onConfirm={handleCancelar}
        onCancel={() => setShowCancelarConfirm(false)}
      />

      {/* Refinanciar Modal */}
      <RefinanciarModal
        visible={showRefinanciarModal}
        onClose={() => setShowRefinanciarModal(false)}
        prestamoId={prestamo.id}
        onSuccess={() => { showToast('Préstamo refinanciado exitosamente', 'success'); refetch(); }}
      />

      <ActionConfirmModal
        visible={showFlowModal}
        titulo={flowCfg?.titulo || ''}
        desc={flowCfg?.desc || ''}
        icon={flowCfg?.icon || ''}
        colorAccion={flowCfg?.color || ''}
        pedirMotivo={flowCfg?.pedirMotivo || false}
        prestamo={prestamo ? { monto: prestamo.monto, numeroCuotas: prestamo.numeroCuotas, frecuenciaPago: prestamo.frecuenciaPago } : null}
        cliente={cliente ? { nombre: cliente.nombre, apellido: cliente.apellido } : null}
        loading={cambiarEstadoMutation.isPending}
        onConfirm={ejecutarFlowAccion}
        onCancel={() => { setShowFlowModal(false); setFlowAccion(null); }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  skeletonContainer: { padding: Spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  headerInfo: { flex: 1, marginHorizontal: Spacing.sm },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  headerSub: { fontSize: FontSize.xs, fontFamily: 'monospace', marginTop: 1 },
  estadoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  estadoBadgeText: { fontSize: 10, fontWeight: FontWeight.bold },
  scrollContent: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    flexWrap: 'wrap',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  actionButtonText: { color: '#FFFFFF', fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  infoGrid: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  infoCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
  },
  infoCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  infoCardTitle: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  tabContainer: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tabHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    alignItems: 'center',
  },
  tabBtnText: {
    fontSize: FontSize.sm,
  },
  cuotaFilters: {
    flexDirection: 'row',
    gap: Spacing.xs,
    padding: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    flexWrap: 'wrap',
  },
  cuotaFilterChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  cuotaFilterText: {
    fontSize: 10,
    fontWeight: FontWeight.semibold,
  },
  tabEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
  },
  tabEmptyText: {
    fontSize: FontSize.sm,
  },
  cuotaCard: {
    padding: Spacing.sm,
    borderBottomWidth: 1,
  },
  cuotaCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  cuotaCardNum: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  cuotaCardNumText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  cuotaCardDate: {
    fontSize: FontSize.xs,
  },
  cuotaCardAmounts: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  cuotaCardAmt: {
    flex: 1,
    alignItems: 'center',
  },
  cuotaAmtLabel: {
    fontSize: 9,
  },
  cuotaAmtVal: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    marginTop: 1,
  },
  cuotaCardTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pagoCard: {
    padding: Spacing.sm,
    borderBottomWidth: 1,
  },
  pagoCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  pagoDate: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  pagoMetodo: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  pagoMetodoText: {
    fontSize: 10,
    fontWeight: FontWeight.semibold,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  modalHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  modalBody: {
    padding: Spacing.md,
  },
  modalLabel: {
    fontSize: FontSize.sm,
    marginBottom: Spacing.sm,
  },
  modalWarning: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
  },
  formLabel: {
    fontSize: FontSize.sm,
    marginBottom: Spacing.xs,
  },
  confirmInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.md,
    marginBottom: Spacing.md,
    textAlign: 'center',
    fontWeight: FontWeight.bold,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  summaryCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.sm + 2,
    marginBottom: Spacing.md,
    gap: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  viewAllLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  viewAllLinkText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
});
