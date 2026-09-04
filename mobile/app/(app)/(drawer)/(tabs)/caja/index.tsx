import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, Text, View, Alert } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ui/screen-container';
import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import ModalCerrarCaja from '@/components/caja/cerrar-caja-modal';

import { SkeletonCard } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { useCajaActiva, useAbrirCaja, useCerrarCaja, useCajas } from '@/hooks/use-caja';
import { usePermisos } from '@/permisos/use-permisos';
import { obtenerPago } from '@/api/pagos.api';
import { useImprimirRecibo } from '@/hooks/use-imprimir-recibo';
import { guardarReciboPDF, reciboPagoImprimible } from '@/utils/recibo-pdf';
import { AppStyles, FontSize, FontWeight, Spacing, BorderRadius, scale } from '@/constants/theme';
import { formatCurrency, formatDateTime, unformatIngresosInput } from '@/utils/formatters';
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
  const { imprimir } = useImprimirRecibo();

  const fecha = hoyStr();
  const { data: caja, isLoading, refetch } = useCajaActiva(fecha);
  const { mutateAsync: abrirCajaFn, isPending: abriendo } = useAbrirCaja();
  const { mutateAsync: cerrarCajaFn, isPending: cerrando } = useCerrarCaja();

  const { tienePermiso } = usePermisos();
  const puedeControlar = tienePermiso('caja:ajuste');
  const { data: cajasAbiertas } = useCajas(puedeControlar ? 'ABIERTA' : undefined);
  const abiertasCount = cajasAbiertas?.length ?? 0;

  const [showAbrirModal, setShowAbrirModal] = useState(false);
  const [montoInicial, setMontoInicial] = useState('');
  const [showCerrarModal, setShowCerrarModal] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const cajaAbierta = caja && caja.estado === 'ABIERTA' ? caja : null;
  const cajaCerrada = caja && caja.estado === 'CERRADA' ? caja : null;
  const resumen = cajaAbierta?.resumen;

  const handleAbrirCaja = useCallback(async () => {
    const monto = parseFloat(unformatIngresosInput(montoInicial)) || 0;
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

  const handleConfirmCierre = useCallback(async (datos: { monto: number; observaciones?: string }) => {
    if (!cajaAbierta) return;
    if (cajaAbierta.id.startsWith('caja_temp_')) {
      setShowCerrarModal(false);
      Alert.alert(
        'Caja sin sincronizar',
        'Debes sincronizar la apertura de caja antes de cerrarla. Ve a Sincronización y presiona "Sincronizar ahora".',
      );
      return;
    }
    try {
      const result = await cerrarCajaFn({
        id: cajaAbierta.id,
        dto: { montoCierre: datos.monto, observaciones: datos.observaciones },
      });
      setShowCerrarModal(false);
      if (result.diferencia === 0) {
        showToast('Caja cerrada — ¡Cuadrada!', 'success');
      } else {
        const tipo = result.diferencia > 0 ? 'sobrante' : 'faltante';
        showToast(`Caja cerrada con ${tipo} de ${formatCurrency(Math.abs(result.diferencia))}`, 'info');
      }
    } catch (err: any) {
      showToast(err?.message || 'Error al cerrar caja', 'error');
    }
  }, [cajaAbierta, cerrarCajaFn, showToast]);


  const handleReimprimir = useCallback(async (pagoId: string) => {
    try {
      const detalle = await obtenerPago(pagoId);
      if (!detalle) throw new Error('No se encontró el pago');
      const resultado = await imprimir(reciboPagoImprimible(detalle));
      if (resultado.ok) {
        showToast('Recibo enviado a la impresora', 'success');
        return;
      }
      await guardarReciboPDF(detalle);
      showToast(`${resultado.mensaje}. Se guardó el recibo como PDF.`, 'info');
    } catch (err: any) {
      showToast(err?.message || 'Error al reimprimir recibo', 'error');
    }
  }, [imprimir, showToast]);

  if (isLoading) {
    return (
      <ScreenContainer style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ padding: Spacing.md }}>
          <SkeletonCard lines={2} />
          <SkeletonCard lines={4} style={{ marginTop: scale(16) }} />
          <SkeletonCard lines={6} style={{ marginTop: scale(16) }} />
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
          <Text style={{ fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: colors.text }} accessibilityRole="header">
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
              <Ionicons name="wallet-outline" size={scale(64)} color={colors.textTertiary} style={{ opacity: 0.4 }} />
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
              <Ionicons name="checkmark-done-circle" size={scale(48)} color={colors.textTertiary} />
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
            <View style={[styles.banner, { backgroundColor: colors.successLight, borderColor: colors.success }]}>
              <Ionicons name="checkmark-circle" size={scale(20)} color={colors.success} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: colors.success }}>
                  Caja abierta
                </Text>
                <Text style={{ fontSize: FontSize.xs, color: colors.success }}>
                  Inicial: {formatCurrency(cajaAbierta.montoInicial)}
                  {cajaAbierta.createdAt
                    ? ` · Apertura ${new Date(cajaAbierta.createdAt).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}`
                    : ''}
                </Text>
              </View>
            </View>

            {/* Resumen cards */}
            <View style={styles.resumenGrid}>
              <View style={[styles.resumenCard, { backgroundColor: colors.surface, borderColor: colors.border }]} accessibilityRole="text" accessibilityLabel={`Cobrado hoy: ${formatCurrency(resumen?.totalCobrado || 0)}`}>
                <Text style={[styles.resumenValue, { color: colors.success }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{formatCurrency(resumen?.totalCobrado || 0)}</Text>
                <Text style={[styles.resumenLabel, { color: colors.textSecondary }]}>Cobrado hoy</Text>
              </View>
              <View style={[styles.resumenCard, { backgroundColor: colors.surface, borderColor: colors.border }]} accessibilityRole="text" accessibilityLabel={`${resumen?.cantidadPagos || 0} pagos`}>
                <Text style={[styles.resumenValue, { color: colors.primary }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{resumen?.cantidadPagos || 0}</Text>
                <Text style={[styles.resumenLabel, { color: colors.textSecondary }]}>Pagos</Text>
              </View>
              <View style={[styles.resumenCard, { backgroundColor: colors.surface, borderColor: colors.border }]} accessibilityRole="text" accessibilityLabel={`Efectivo esperado: ${formatCurrency(resumen?.efectivoEnCaja || 0)}`}>
                <Text style={[styles.resumenValue, { color: colors.success }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{formatCurrency(resumen?.efectivoEnCaja || 0)}</Text>
                <Text style={[styles.resumenLabel, { color: colors.textSecondary }]}>Efectivo esperado</Text>
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
                      accessibilityRole="button"
                      accessibilityLabel={`Reimprimir recibo de ${p.prestamo?.cliente?.nombre}`}
                    >
                      <Ionicons name="print-outline" size={scale(18)} color={colors.primary} />
                    </Pressable>
                    <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                      <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: colors.text }}>
                        {p.prestamo?.cliente?.nombre} {p.prestamo?.cliente?.apellido || ''}
                      </Text>
                      <Text style={{ fontSize: scale(10), color: colors.textTertiary }}>
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
                accessibilityRole="button"
                accessibilityLabel="Registrar nuevo pago"
              >
                <View style={[styles.navIcon, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name="cash" size={scale(22)} color={colors.primary} />
                </View>
                <Text style={[styles.navButtonText, { color: colors.text }]}>Nuevo Pago</Text>
                <Text style={[styles.navButtonSub, { color: colors.textTertiary }]}>Registrar un cobro</Text>
                <Ionicons name="chevron-forward" size={scale(18)} color={colors.primary} />
              </Pressable>

              <Pressable
                onPress={() => setShowCerrarModal(true)}
                style={[styles.navButton, { backgroundColor: colors.surface, borderColor: colors.error }]}
                accessibilityRole="button"
                accessibilityLabel="Cerrar caja"
              >
                <View style={[styles.navIcon, { backgroundColor: colors.errorLight }]}>
                  <Ionicons name="lock-closed" size={scale(22)} color={colors.error} />
                </View>
                <Text style={[styles.navButtonText, { color: colors.text }]}>Cerrar Caja</Text>
                <Text style={[styles.navButtonSub, { color: colors.textTertiary }]}>Finalizar jornada</Text>
                <Ionicons name="chevron-forward" size={scale(18)} color={colors.error} />
              </Pressable>
            </View>
          </>
        )}

        {/* Navigation buttons - always visible */}
        <View style={{ gap: Spacing.sm, marginTop: Spacing.md }}>
          <Pressable
            onPress={() => router.push('/caja/historial')}
            style={[styles.navButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel="Historial de caja"
          >
            <View style={[styles.navIcon, { backgroundColor: colors.borderLight }]}>
              <Ionicons name="time-outline" size={scale(22)} color={colors.textTertiary} />
            </View>
            <Text style={[styles.navButtonText, { color: colors.text }]}>Historial de Caja</Text>
            <Text style={[styles.navButtonSub, { color: colors.textTertiary }]}>Sesiones anteriores</Text>
            <Ionicons name="chevron-forward" size={scale(18)} color={colors.textTertiary} />
          </Pressable>

          {puedeControlar && (
            <Pressable
              onPress={() => router.push('/caja/activas')}
              style={[styles.navButton, { backgroundColor: colors.surface, borderColor: colors.primary }]}
              accessibilityRole="button"
              accessibilityLabel="Control de cajas"
            >
              <View style={[styles.navIcon, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons name="shield-checkmark" size={scale(22)} color={colors.primary} />
              </View>
              <Text style={[styles.navButtonText, { color: colors.text }]}>Control de Cajas</Text>
              <Text style={[styles.navButtonSub, { color: colors.textTertiary }]}>Supervisar cajas activas</Text>
              {abiertasCount > 0 && (
                <View style={[styles.navBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.navBadgeText}>{abiertasCount}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={scale(18)} color={colors.primary} />
            </Pressable>
          )}
        </View>
      </ScrollView>

      {/* Modal Abrir Caja */}
      <Modal visible={showAbrirModal} transparent animationType="fade" onRequestClose={() => setShowAbrirModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
            <View style={[styles.modalCard, { backgroundColor: colors.surfaceElevated }]}>
              <View style={[styles.modalHeaderBar, { backgroundColor: colors.success }]}>
                <Ionicons name="add-circle" size={scale(22)} color="#FFFFFF" />
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
                  format="currency"
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
      <ModalCerrarCaja
        visible={showCerrarModal}
        onClose={() => setShowCerrarModal(false)}
        onConfirm={handleConfirmCierre}
        confirmando={cerrando}
        esperado={resumen?.efectivoEnCaja ?? 0}
        filas={
          cajaAbierta && resumen
            ? [
                { label: 'Monto inicial', valor: formatCurrency(cajaAbierta.montoInicial) },
                { label: 'Cobros en efectivo', valor: formatCurrency(resumen.totalEfectivo) },
                {
                  label: 'Desembolsos',
                  valor: `-${formatCurrency(resumen.totalDesembolsado)}`,
                  color: colors.error,
                },
              ]
            : undefined
        }
      />
    </ScreenContainer>
  );
}

const styles = {
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  } as AppStyles,
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  } as AppStyles,
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.sm,
  },
  resumenGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  } as AppStyles,
  resumenCard: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    alignItems: 'center',
  } as AppStyles,
  resumenValue: { fontSize: FontSize.lg, fontWeight: FontWeight.bold } as AppStyles,
  resumenLabel: { fontSize: FontSize.xs, marginTop: 2, textAlign: 'center' } as AppStyles,
  metodoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  } as AppStyles,
  pagoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
  } as AppStyles,
  reprintIcon: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    alignItems: 'center',
    justifyContent: 'center',
  } as AppStyles,
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.sm,
  } as AppStyles,
  navIcon: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(22),
    alignItems: 'center',
    justifyContent: 'center',
  } as AppStyles,
  navButtonText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    flex: 1,
  },
  navButtonSub: {
    fontSize: 9,
    display: 'none',
  } as AppStyles,
  navBadge: {
    borderRadius: scale(10),
    minWidth: scale(20),
    height: scale(20),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scale(6),
  } as AppStyles,
  navBadgeText: {
    color: '#FFFFFF',
    fontSize: scale(10),
    fontWeight: FontWeight.bold,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  } as AppStyles,
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  } as AppStyles,
  modalHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
  } as AppStyles,
  modalTitle: { color: '#FFFFFF', fontSize: FontSize.md, fontWeight: FontWeight.bold },
  modalBody: { padding: Spacing.md },
  modalLabel: { fontSize: FontSize.sm, marginBottom: Spacing.md },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm } as AppStyles,
};
