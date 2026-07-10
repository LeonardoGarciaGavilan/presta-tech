import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ui/screen-container';
import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';

import { SkeletonCard } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { useCajaActiva, useAbrirCaja, useCerrarCaja, useCajas } from '@/hooks/use-caja';
import { useAuthStore } from '@/store/auth.store';
import { obtenerPago } from '@/api/pagos.api';
import { guardarReciboPDF } from '@/utils/recibo-pdf';
import { FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { formatCurrency, formatDateTime } from '@/utils/formatters';
import type { CajaActivaResponse } from '@/types/caja.types';
import { useTheme } from '@/components/ui/theme-provider';

function hoyStr() {
  const formatter = new Intl.DateTimeFormat('es-DO', {
    timeZone: 'America/Santo_Domingo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(new Date());
  const y = parts.find(p => p.type === 'year')!.value;
  const m = parts.find(p => p.type === 'month')!.value;
  const d = parts.find(p => p.type === 'day')!.value;
  return `${y}-${m}-${d}`;
}

export default function CajaScreen() {
  const { colorScheme, colors } = useTheme();
  const { showToast } = useToast();

  const fecha = hoyStr();
  const { data: caja, isLoading, refetch } = useCajaActiva(fecha);
  const { mutateAsync: abrirCajaFn, isPending: abriendo } = useAbrirCaja();
  const { mutateAsync: cerrarCajaFn, isPending: cerrando } = useCerrarCaja();

  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.rol === 'SUPERADMIN' || user?.rol === 'ADMIN';
  const { data: cajasAbiertas } = useCajas(isAdmin ? 'ABIERTA' : undefined);
  const abiertasCount = cajasAbiertas?.length ?? 0;

  const [showAbrirModal, setShowAbrirModal] = useState(false);
  const [montoInicial, setMontoInicial] = useState('');
  const [showCerrarModal, setShowCerrarModal] = useState(false);
  const [montoCierre, setMontoCierre] = useState('');
  const [observaciones, setObservaciones] = useState('');

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const cajaAbierta = caja && caja.estado === 'ABIERTA' ? caja : null;
  const cajaCerrada = caja && caja.estado === 'CERRADA' ? caja : null;
  const resumen = cajaAbierta?.resumen;

  const handleAbrirCaja = useCallback(async () => {
    const monto = parseFloat(montoInicial.replace(/[^0-9.]/g, '')) || 0;
    if (monto < 0) {
      showToast('El monto inicial debe ser mayor o igual a 0', 'error');
      return;
    }
    try {
      await abrirCajaFn({ montoInicial: monto, fecha });
      setShowAbrirModal(false);
      setMontoInicial('');
      showToast('Caja abierta exitosamente', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Error al abrir caja', 'error');
    }
  }, [montoInicial, fecha, abrirCajaFn, showToast]);

  const handleCerrarCaja = useCallback(async () => {
    if (!cajaAbierta) return;
    const monto = parseFloat(montoCierre.replace(/[^0-9.]/g, '')) || 0;
    try {
      const result = await cerrarCajaFn({
        id: cajaAbierta.id,
        dto: { montoCierre: monto, observaciones: observaciones || undefined },
      });
      setShowCerrarModal(false);
      setMontoCierre('');
      setObservaciones('');
      if (result.diferencia === 0) {
        showToast('Caja cerrada — ¡Cuadrada!', 'success');
      } else {
        const tipo = result.diferencia > 0 ? 'sobrante' : 'faltante';
        showToast(`Caja cerrada con ${tipo} de ${formatCurrency(Math.abs(result.diferencia))}`, 'info');
      }
    } catch (err: any) {
      showToast(err?.message || 'Error al cerrar caja', 'error');
    }
  }, [cajaAbierta, montoCierre, observaciones, cerrarCajaFn, showToast]);

  const handleReimprimir = useCallback(async (pagoId: string) => {
    try {
      const detalle = await obtenerPago(pagoId);
      if (!detalle) throw new Error('No se encontró el pago');
      await guardarReciboPDF(detalle);
      showToast('Recibo reimpreso exitosamente', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Error al reimprimir recibo', 'error');
    }
  }, [showToast]);

  if (isLoading) {
    return (
      <ScreenContainer style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ padding: Spacing.md }}>
          <SkeletonCard lines={2} />
          <SkeletonCard lines={4} style={{ marginTop: 16 }} />
          <SkeletonCard lines={6} style={{ marginTop: 16 }} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ padding: Spacing.md, paddingBottom: Spacing.xxl }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
      >
        {/* Header */}
        <View style={{ marginBottom: Spacing.md }}>
          <Text style={{ fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: colors.text }}>
            Caja
          </Text>
          <Text style={{ fontSize: FontSize.sm, color: colors.textTertiary }}>
            {fecha}
          </Text>
        </View>

        {/* Sin caja — estado inicial */}
        {!caja && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={{ alignItems: 'center', paddingVertical: Spacing.lg }}>
              <Ionicons name="wallet-outline" size={64} color={colors.textTertiary} style={{ opacity: 0.4 }} />
              <Text style={{ fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: colors.text, marginTop: Spacing.md }}>
                Sin caja abierta
              </Text>
              <Text style={{ fontSize: FontSize.sm, color: colors.textTertiary, textAlign: 'center', marginTop: Spacing.xs, marginBottom: Spacing.lg }}>
                Abre tu caja para comenzar a registrar pagos
              </Text>
              <AppButton
                title="Abrir Caja"
                onPress={() => setShowAbrirModal(true)}
                icon="add-circle"
              />
            </View>
          </View>
        )}

        {/* Caja cerrada hoy */}
        {cajaCerrada && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={{ alignItems: 'center', paddingVertical: Spacing.lg }}>
              <Ionicons name="checkmark-done-circle" size={48} color={colors.textTertiary} />
              <Text style={{ fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: colors.text, marginTop: Spacing.md }}>
                Caja cerrada hoy
              </Text>
              <Text style={{ fontSize: FontSize.sm, color: colors.textTertiary, marginTop: Spacing.xs }}>
                Monto inicial: {formatCurrency(cajaCerrada.montoInicial)}
              </Text>
              {cajaCerrada.montoCierre != null && (
                <Text style={{ fontSize: FontSize.sm, color: colors.textTertiary }}>
                  Cierre: {formatCurrency(cajaCerrada.montoCierre)}
                </Text>
              )}
              {cajaCerrada.diferencia != null && cajaCerrada.diferencia !== 0 && (
                <Text style={{ fontSize: FontSize.sm, color: cajaCerrada.diferencia > 0 ? colors.warning : colors.error, marginTop: Spacing.xs }}>
                  {cajaCerrada.diferencia > 0 ? 'Sobrante' : 'Faltante'}: {formatCurrency(Math.abs(cajaCerrada.diferencia))}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Caja abierta — resumen */}
        {cajaAbierta && (
          <>
            {/* Estado banner */}
            <View style={[styles.banner, { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }]}>
              <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: '#16A34A' }}>
                  Caja abierta
                </Text>
                <Text style={{ fontSize: FontSize.xs, color: '#16A34A' }}>
                  Inicial: {formatCurrency(cajaAbierta.montoInicial)}
                </Text>
              </View>
            </View>

            {/* Resumen cards */}
            <View style={styles.resumenGrid}>
              <View style={[styles.resumenCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.resumenValue, { color: colors.primary }]}>{formatCurrency(resumen?.totalCobrado || 0)}</Text>
                <Text style={[styles.resumenLabel, { color: colors.textTertiary }]}>Cobrado hoy</Text>
              </View>
              <View style={[styles.resumenCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.resumenValue, { color: colors.text }]}>{resumen?.cantidadPagos || 0}</Text>
                <Text style={[styles.resumenLabel, { color: colors.textTertiary }]}>Pagos</Text>
              </View>
              <View style={[styles.resumenCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.resumenValue, { color: colors.warning }]}>{formatCurrency(resumen?.efectivoEnCaja || 0)}</Text>
                <Text style={[styles.resumenLabel, { color: colors.textTertiary }]}>Efectivo en caja</Text>
              </View>
            </View>

            {/* Pagos por método */}
            {resumen?.pagosPorMetodo && Object.keys(resumen.pagosPorMetodo).length > 0 && (
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Cobros por método</Text>
                {Object.entries(resumen.pagosPorMetodo).map(([metodo, data]: [string, any]) => (
                  <View key={metodo} style={styles.metodoRow}>
                    <Text style={{ fontSize: FontSize.sm, color: colors.text }}>{metodo}</Text>
                    <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: colors.text }}>
                      {formatCurrency(data.monto)} ({data.cantidad})
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Últimos 10 pagos */}
            {resumen?.pagos && resumen.pagos.length > 0 && (
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Últimos 5 pagos</Text>
                {resumen.pagos.slice(0, 5).map((p: any) => (
                  <View key={p.id} style={[styles.pagoRow, { borderBottomColor: colors.borderLight }]}>
                    <Pressable
                      onPress={() => handleReimprimir(p.id)}
                      hitSlop={8}
                      style={styles.reprintIcon}
                    >
                      <Ionicons name="print-outline" size={18} color={colors.primary} />
                    </Pressable>
                    <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                      <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: colors.text }}>
                        {p.prestamo?.cliente?.nombre} {p.prestamo?.cliente?.apellido || ''}
                      </Text>
                      <Text style={{ fontSize: 10, color: colors.textTertiary }}>
                        {formatDateTime(p.createdAt)} · {p.metodo}
                      </Text>
                    </View>
                    <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: colors.text }}>
                      {formatCurrency(p.montoTotal)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Action buttons */}
            <View style={{ gap: Spacing.sm, marginTop: Spacing.md }}>
              <Pressable
                onPress={() => router.push('/caja/pago')}
                style={[styles.navButton, { backgroundColor: colors.surface, borderColor: colors.primary }]}
              >
                <View style={[styles.navIcon, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name="cash" size={22} color={colors.primary} />
                </View>
                <Text style={[styles.navButtonText, { color: colors.text }]}>Nuevo Pago</Text>
                <Text style={[styles.navButtonSub, { color: colors.textTertiary }]}>Registrar un cobro</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.primary} />
              </Pressable>

              <Pressable
                onPress={() => setShowCerrarModal(true)}
                style={[styles.navButton, { backgroundColor: colors.surface, borderColor: '#FCA5A5' }]}
              >
                <View style={[styles.navIcon, { backgroundColor: '#FEF2F2' }]}>
                  <Ionicons name="lock-closed" size={22} color="#DC2626" />
                </View>
                <Text style={[styles.navButtonText, { color: colors.text }]}>Cerrar Caja</Text>
                <Text style={[styles.navButtonSub, { color: colors.textTertiary }]}>Finalizar jornada</Text>
                <Ionicons name="chevron-forward" size={18} color="#DC2626" />
              </Pressable>
            </View>
          </>
        )}

        {/* Navigation buttons - always visible */}
        <View style={{ gap: Spacing.sm, marginTop: Spacing.md }}>
          <Pressable
            onPress={() => router.push('/caja/historial')}
            style={[styles.navButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <View style={[styles.navIcon, { backgroundColor: colors.borderLight }]}>
              <Ionicons name="time-outline" size={22} color={colors.textTertiary} />
            </View>
            <Text style={[styles.navButtonText, { color: colors.text }]}>Historial de Caja</Text>
            <Text style={[styles.navButtonSub, { color: colors.textTertiary }]}>Sesiones anteriores</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </Pressable>

          {isAdmin && (
            <Pressable
              onPress={() => router.push('/caja/activas')}
              style={[styles.navButton, { backgroundColor: colors.surface, borderColor: colors.primary }]}
            >
              <View style={[styles.navIcon, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons name="shield-checkmark" size={22} color={colors.primary} />
              </View>
              <Text style={[styles.navButtonText, { color: colors.text }]}>Control de Cajas</Text>
              <Text style={[styles.navButtonSub, { color: colors.textTertiary }]}>Supervisar cajas activas</Text>
              {abiertasCount > 0 && (
                <View style={[styles.navBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.navBadgeText}>{abiertasCount}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={18} color={colors.primary} />
            </Pressable>
          )}
        </View>
      </ScrollView>

      {/* Modal Abrir Caja */}
      <Modal visible={showAbrirModal} transparent animationType="fade" onRequestClose={() => setShowAbrirModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
            <View style={[styles.modalCard, { backgroundColor: colors.surfaceElevated }]}>
              <View style={[styles.modalHeaderBar, { backgroundColor: '#16A34A' }]}>
                <Ionicons name="add-circle" size={22} color="#FFFFFF" />
                <Text style={styles.modalTitle}>Abrir Caja</Text>
              </View>
              <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
                <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>
                  Fecha: {fecha}
                </Text>
                <AppInput
                  label="Monto inicial (RD$)"
                  value={montoInicial}
                  onChangeText={setMontoInicial}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  prefix="RD$"
                />
                <View style={styles.modalActions}>
                  <AppButton title="Cancelar" onPress={() => setShowAbrirModal(false)} variant="ghost" style={{ flex: 1 }} />
                  <AppButton title="Abrir" onPress={handleAbrirCaja} loading={abriendo} disabled={!montoInicial} style={{ flex: 1 }} />
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Cerrar Caja */}
      <Modal visible={showCerrarModal} transparent animationType="fade" onRequestClose={() => setShowCerrarModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
            <View style={[styles.modalCard, { backgroundColor: colors.surfaceElevated }]}>
              <View style={[styles.modalHeaderBar, { backgroundColor: '#DC2626' }]}>
                <Ionicons name="lock-closed" size={22} color="#FFFFFF" />
                <Text style={styles.modalTitle}>Cerrar Caja</Text>
              </View>
              <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
                {cajaAbierta && resumen && (
                  <View style={[styles.summaryBox, { backgroundColor: colors.borderLight, borderColor: colors.border }]}>
                    <View style={styles.summaryRow}>
                      <Text style={{ fontSize: FontSize.xs, color: colors.textTertiary }}>Monto inicial</Text>
                      <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: colors.text }}>
                        {formatCurrency(cajaAbierta.montoInicial)}
                      </Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={{ fontSize: FontSize.xs, color: colors.textTertiary }}>Cobros en efectivo</Text>
                      <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: colors.text }}>
                        {formatCurrency(resumen.totalEfectivo)}
                      </Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={{ fontSize: FontSize.xs, color: colors.textTertiary }}>Desembolsos</Text>
                      <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: colors.error }}>
                        -{formatCurrency(resumen.totalDesembolsado)}
                      </Text>
                    </View>
                    <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: Spacing.sm, marginTop: Spacing.xs }]}>
                      <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: colors.text }}>Efectivo esperado</Text>
                      <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: colors.text }}>
                        {formatCurrency(resumen.efectivoEnCaja)}
                      </Text>
                    </View>
                  </View>
                )}
                <AppInput
                  label="Monto real en caja (RD$)"
                  value={montoCierre}
                  onChangeText={setMontoCierre}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  prefix="RD$"
                />
                <AppInput
                  label="Observaciones (opcional)"
                  value={observaciones}
                  onChangeText={setObservaciones}
                  placeholder="Notas del cierre..."
                />
                <View style={styles.modalActions}>
                  <AppButton
                    title="Cancelar"
                    onPress={() => { setShowCerrarModal(false); setMontoCierre(''); setObservaciones(''); }}
                    variant="ghost"
                    style={{ flex: 1 }}
                  />
                  <AppButton
                    title="Cerrar Caja"
                    onPress={handleCerrarCaja}
                    loading={cerrando}
                    disabled={!montoCierre}
                    variant="danger"
                    style={{ flex: 1 }}
                  />
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenContainer>
  );
}

const styles = {
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  } as any,
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  } as any,
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.sm,
  },
  resumenGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  } as any,
  resumenCard: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    alignItems: 'center',
  } as any,
  resumenValue: { fontSize: FontSize.lg, fontWeight: FontWeight.bold } as any,
  resumenLabel: { fontSize: FontSize.xs, marginTop: 2, textAlign: 'center' } as any,
  metodoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  } as any,
  pagoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
  } as any,
  reprintIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  } as any,
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.sm,
  } as any,
  navIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  } as any,
  navButtonText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    flex: 1,
  },
  navButtonSub: {
    fontSize: 9,
    display: 'none',
  } as any,
  navBadge: {
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  } as any,
  navBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: FontWeight.bold,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  } as any,
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  } as any,
  modalHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
  } as any,
  modalTitle: { color: '#FFFFFF', fontSize: FontSize.md, fontWeight: FontWeight.bold },
  modalBody: { padding: Spacing.md },
  modalLabel: { fontSize: FontSize.sm, marginBottom: Spacing.md },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm } as any,
  summaryBox: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  } as any,
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  } as any,
};
