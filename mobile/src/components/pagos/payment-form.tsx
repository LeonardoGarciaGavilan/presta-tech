import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ui/screen-container';
import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import PickerField from '@/components/ui/picker-field';
import { useToast } from '@/components/ui/toast';
import { useRegistrarPago, useSaldarPrestamo } from '@/hooks/use-pagos';
import { FontSize, FontWeight, IoniconsName, Spacing, BorderRadius, scale} from '@/constants/theme';
import { formatCurrency, formatDate, formatDateTime } from '@/utils/formatters';
import { guardarReciboPDF } from '@/utils/recibo-pdf';
import type { Cuota, MetodoPago, Prestamo } from '@/types/prestamo.types';
import { useTheme } from '@/components/ui/theme-provider';
import { METODO_PAGO_LABELS, METODO_PAGO_ICONS, METODO_PAGO_OPTIONS } from '@/constants/pagos.constants';

interface PaymentFormProps {
  prestamo: Prestamo;
  onBack: () => void;
  afterPayment?: () => void;
  showConfirmStep?: boolean;
  showCancelButton?: boolean;
  saldarCuotaThreshold?: number;
  reciboCloseLabel?: string;
}

export default function PaymentForm({
  prestamo,
  onBack,
  afterPayment,
  showConfirmStep = false,
  showCancelButton = false,
  saldarCuotaThreshold = 0,
  reciboCloseLabel = 'Cerrar',
}: PaymentFormProps) {
  const { colorScheme, colors } = useTheme();
  const { showToast } = useToast();

  const { mutateAsync: registrarPago, isPending: isPaying } = useRegistrarPago();
  const { mutateAsync: saldarPrestamo, isPending: isSalding } = useSaldarPrestamo();

  const [selectedCuotaId, setSelectedCuotaId] = useState('PROXIMA');
  const [montoPagado, setMontoPagado] = useState('');
  const [metodo, setMetodo] = useState<MetodoPago>('EFECTIVO');
  const [referencia, setReferencia] = useState('');
  const [observacion, setObservacion] = useState('');

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showRecibo, setShowRecibo] = useState(false);
  const [reciboData, setReciboData] = useState<any>(null);
  const [showSaldarModal, setShowSaldarModal] = useState(false);
  const [confirmacionTexto, setConfirmacionTexto] = useState('');

  useEffect(() => {
    const montoInicial = cuotasPendientes[0];
    if (montoInicial) {
      setMontoPagado(((montoInicial.monto + (montoInicial.mora || 0))).toFixed(2));
      setSelectedCuotaId('PROXIMA');
    }
  }, [prestamo?.id]);

  const cuotas = prestamo?.cuotas || [];
  const cuotasPendientes = cuotas.filter((c: Cuota) => !c.pagada);
  const selectedCuota = cuotasPendientes.find((c: Cuota) =>
    selectedCuotaId === 'PROXIMA' ? true : c.id === selectedCuotaId,
  );
  const montoCuota = selectedCuota
    ? Math.round((selectedCuota.monto + (selectedCuota.mora || 0)) * 100) / 100
    : 0;

  const cuotaLabels: Record<string, string> = {};
  cuotasPendientes.forEach((c: Cuota) => {
    cuotaLabels[c.id] = `Cuota #${c.numero} — ${formatCurrency(c.monto + (c.mora || 0))} (Vence: ${formatDate(c.fechaVencimiento)})`;
  });
  if (cuotasPendientes[0]) {
    cuotaLabels.PROXIMA = `Próxima: Cuota #${cuotasPendientes[0].numero} — ${formatCurrency(cuotasPendientes[0].monto + (cuotasPendientes[0].mora || 0))}`;
  }

  const montoIngresado = parseFloat(montoPagado.replace(/[^0-9.]/g, '')) || 0;
  const excedente = montoIngresado > montoCuota
    ? Math.round((montoIngresado - montoCuota) * 100) / 100
    : 0;
  const montoMaximo = prestamo?.saldoPendiente ?? 0;
  const totalSaldar = cuotasPendientes.reduce(
    (sum: number, c: Cuota) => sum + c.capital + c.interes + (c.mora || 0), 0,
  );

  const handleSelectCuota = useCallback((label: string) => {
    const id = Object.entries(cuotaLabels).find(([, v]) => v === label)?.[0] || 'PROXIMA';
    setSelectedCuotaId(id);
    const cuota = cuotasPendientes.find((c: Cuota) =>
      id === 'PROXIMA' ? c.id === cuotasPendientes[0]?.id : c.id === id,
    );
    if (cuota) {
      setMontoPagado((cuota.monto + (cuota.mora || 0)).toFixed(2));
    }
  }, [cuotasPendientes, cuotaLabels]);

  const handleSubmit = useCallback(async () => {
    if (!prestamo?.id || !metodo) return;
    if (montoIngresado <= 0) {
      showToast('Ingresa un monto válido', 'error');
      return;
    }
    if (montoIngresado > montoMaximo + 0.01) {
      showToast('El monto excede el saldo pendiente', 'error');
      return;
    }
    if (!selectedCuota) {
      showToast('Selecciona una cuota', 'error');
      return;
    }
    try {
      const result = await registrarPago({
        prestamoId: prestamo.id,
        cuotaId: selectedCuotaId === 'PROXIMA' ? undefined : selectedCuotaId,
        montoPagado: montoIngresado,
        metodo,
        referencia: referencia || undefined,
        observacion: observacion || undefined,
      });
      setShowConfirmModal(false);
      setReciboData(result);
      setShowRecibo(true);
      afterPayment?.();
    } catch (err: any) {
      showToast(err?.message || 'Error al registrar pago', 'error');
    }
  }, [prestamo?.id, metodo, montoIngresado, montoMaximo, selectedCuota, selectedCuotaId, referencia, observacion, registrarPago, showToast, afterPayment]);

  const handleSaldar = useCallback(async () => {
    if (!prestamo?.id || !metodo) return;
    try {
      const result = await saldarPrestamo({
        prestamoId: prestamo.id,
        dto: { metodo, referencia: referencia || undefined, observacion: observacion || undefined },
      });
      setShowSaldarModal(false);
      setConfirmacionTexto('');
      setReciboData(result);
      setShowRecibo(true);
      afterPayment?.();
    } catch (err: any) {
      showToast(err?.message || 'Error al saldar préstamo', 'error');
      setShowSaldarModal(false);
    }
  }, [prestamo?.id, metodo, referencia, observacion, saldarPrestamo, showToast, afterPayment]);

  const handleCerrarRecibo = useCallback(() => {
    setShowRecibo(false);
    setReciboData(null);
    onBack();
  }, [onBack]);

  const handlePressGuardarPDF = useCallback(async () => {
    if (!reciboData) return;
    try {
      await guardarReciboPDF(reciboData);
      showToast(`PDF guardado: recibo_${(reciboData?.pago?.id?.slice(-8) ?? 'pago').toUpperCase()}.pdf`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Error al guardar PDF', 'error');
    }
  }, [reciboData, showToast]);

  const cliente = prestamo?.cliente;

  return (
    <ScreenContainer style={[styles.screen, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={onBack} hitSlop={8}>
            <Ionicons name="arrow-back" size={scale(24)} color={colors.text} />
          </Pressable>
          <View style={styles.headerInfo}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Registrar Pago</Text>
            <Text style={[styles.headerSub, { color: colors.textTertiary }]} numberOfLines={1}>
              {cliente?.nombre} {cliente?.apellido || ''}
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Loan summary */}
        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.summaryRow}>
            <Ionicons name="cash-outline" size={scale(16)} color={colors.primary} />
            <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>Préstamo:</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              {formatCurrency(prestamo.monto)} · {prestamo.numeroCuotas} cuotas
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Ionicons name="trending-down-outline" size={scale(16)} color={colors.warning} />
            <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>Saldo pendiente:</Text>
            <Text style={[styles.summaryValue, { color: colors.warning }]}>
              {formatCurrency(prestamo.saldoPendiente)}
            </Text>
          </View>
          {prestamo.moraAcumulada > 0 && (
            <View style={styles.summaryRow}>
              <Ionicons name="alert-circle-outline" size={scale(16)} color={colors.error} />
              <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>Mora acumulada:</Text>
              <Text style={[styles.summaryValue, { color: colors.error }]}>
                {formatCurrency(prestamo.moraAcumulada)}
              </Text>
            </View>
          )}
          <View style={styles.summaryRow}>
            <Ionicons name="repeat-outline" size={scale(16)} color={colors.textTertiary} />
            <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>Cuotas:</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              {cuotas.filter((c: Cuota) => c.pagada).length}/{cuotas.length} pagadas
            </Text>
          </View>
        </View>

        {/* Cuota selector */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Cuota a pagar</Text>
        <PickerField
          label="Seleccionar cuota"
          placeholder="Selecciona una cuota..."
          value={selectedCuotaId ? cuotaLabels[selectedCuotaId] : undefined}
          options={Object.values(cuotaLabels)}
          onSelect={handleSelectCuota}
        />

        {/* Amount input */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Monto del pago</Text>
        <AppInput
          label="Monto (RD$)"
          value={montoPagado}
          onChangeText={setMontoPagado}
          placeholder="0.00"
          keyboardType="decimal-pad"
          prefix="RD$"
        />

        {montoCuota > 0 && (
          <View style={styles.montoInfo}>
            <Text style={[styles.montoInfoText, { color: colors.textTertiary }]}>
              Total de la cuota: {formatCurrency(montoCuota)}
              {selectedCuota && selectedCuota.mora > 0 && (
                <Text style={{ color: colors.error }}> (incluye {formatCurrency(selectedCuota.mora)} de mora)</Text>
              )}
            </Text>
          </View>
        )}

        {excedente > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.successLight, borderColor: colors.success }]}>
            <Ionicons name="information-circle" size={scale(14)} color={colors.success} />
            <Text style={[styles.badgeText, { color: colors.success }]}>
              Excedente: {formatCurrency(excedente)} será aplicado como abono a capital de cuotas futuras
            </Text>
          </View>
        )}

        {montoIngresado > montoMaximo + 0.01 && (
          <View style={[styles.badge, { backgroundColor: '#FEF2F2', borderColor: colors.error }]}>
            <Ionicons name="warning" size={scale(14)} color={colors.error} />
            <Text style={[styles.badgeText, { color: colors.error }]}>
              El monto excede el saldo pendiente ({formatCurrency(montoMaximo)})
            </Text>
          </View>
        )}

        {/* Payment method */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Método de pago</Text>
        <View style={styles.metodoGrid}>
          {METODO_PAGO_OPTIONS.map((m) => (
            <Pressable
              key={m.value}
              onPress={() => setMetodo(m.value as MetodoPago)}
              style={[
                styles.metodoCard,
                {
                  backgroundColor: metodo === m.value ? colors.primaryLight : colors.surface,
                  borderColor: metodo === m.value ? colors.primary : colors.border,
                },
              ]}
            >
              <Ionicons
                name={METODO_PAGO_ICONS[m.value] as IoniconsName}
                size={scale(20)}
                color={metodo === m.value ? colors.primary : colors.textTertiary}
              />
              <Text
                style={[
                  styles.metodoText,
                  { color: metodo === m.value ? colors.primary : colors.textSecondary },
                ]}
              >
                {m.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Optional fields */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Información adicional</Text>
        <AppInput
          label="Referencia (opcional)"
          value={referencia}
          onChangeText={setReferencia}
          placeholder="Número de referencia, cheque, etc."
        />
        <AppInput
          label="Observación (opcional)"
          value={observacion}
          onChangeText={setObservacion}
          placeholder="Nota sobre el pago..."
          multiline
          numberOfLines={3}
        />

        {/* Action buttons */}
        <View style={styles.actionButtons}>
          <AppButton
            title="Registrar Pago"
            onPress={showConfirmStep ? () => setShowConfirmModal(true) : handleSubmit}
            loading={isPaying}
            disabled={!montoIngresado || !metodo || isPaying}
            icon="checkmark-circle"
          />
          {cuotasPendientes.length > saldarCuotaThreshold && (
            <AppButton
              title="Saldar Préstamo"
              onPress={() => setShowSaldarModal(true)}
              variant="danger"
              loading={isSalding}
              icon="flash"
            />
          )}
          {showCancelButton && (
            <AppButton
              title="Cancelar"
              onPress={onBack}
              variant="ghost"
            />
          )}
        </View>

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Confirm payment modal */}
      {showConfirmStep && (
        <Modal visible={showConfirmModal} transparent animationType="fade" onRequestClose={() => setShowConfirmModal(false)}>
          <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
            <View style={[styles.modalCard, { backgroundColor: colors.surfaceElevated }]}>
              <View style={[styles.modalHeaderBar, { backgroundColor: '#16A34A' }]}>
                <Ionicons name="checkmark-circle" size={scale(22)} color="#FFFFFF" />
                <Text style={styles.modalTitle}>Confirmar Pago</Text>
              </View>
              <View style={styles.modalBody}>
                <Text style={[styles.confirmText, { color: colors.textSecondary }]}>
                  {cliente?.nombre} {cliente?.apellido || ''} — {formatCurrency(montoIngresado)} por {METODO_PAGO_LABELS[metodo]}
                </Text>
                {excedente > 0 && (
                  <Text style={styles.confirmExcedente}>
                    Abono a capital de cuotas futuras: {formatCurrency(excedente)}
                  </Text>
                )}
                <View style={styles.modalActions}>
                  <AppButton title="Cancelar" onPress={() => setShowConfirmModal(false)} variant="ghost" style={{ flex: 1 }} />
                  <AppButton title="Confirmar" onPress={handleSubmit} loading={isPaying} style={{ flex: 1 }} />
                </View>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Saldar Modal */}
      <Modal visible={showSaldarModal} transparent animationType="fade" onRequestClose={() => setShowSaldarModal(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
            <View style={[styles.modalCard, { backgroundColor: colors.surfaceElevated }]}>
              <View style={[styles.modalHeaderBar, { backgroundColor: '#DC2626' }]}>
                <Ionicons name="flash" size={scale(22)} color="#FFFFFF" />
                <Text style={styles.modalTitle}>Saldar Préstamo</Text>
              </View>
              <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
                <Text style={[styles.saldarLabel, { color: colors.textSecondary }]}>
                  Se pagarán todas las cuotas pendientes ({cuotasPendientes.length}):
                </Text>
                <View style={[styles.summaryCard, { backgroundColor: colors.borderLight, borderColor: colors.border }]}>
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>Capital pendiente:</Text>
                    <Text style={[styles.summaryValue, { color: colors.text }]}>
                      {formatCurrency(cuotasPendientes.reduce((s: number, c: Cuota) => s + c.capital, 0))}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>Interés pendiente:</Text>
                    <Text style={[styles.summaryValue, { color: colors.warning }]}>
                      {formatCurrency(cuotasPendientes.reduce((s: number, c: Cuota) => s + c.interes, 0))}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>Mora:</Text>
                    <Text style={[styles.summaryValue, { color: colors.error }]}>
                      {formatCurrency(cuotasPendientes.reduce((s: number, c: Cuota) => s + (c.mora || 0), 0))}
                    </Text>
                  </View>
                  <View style={[styles.summaryRow, styles.saldarTotalRow, { borderTopColor: colors.border, paddingTop: Spacing.sm, marginTop: Spacing.xs }]}>
                    <Text style={[styles.summaryLabel, { fontWeight: FontWeight.bold, color: colors.text }]}>Total a pagar:</Text>
                    <Text style={[styles.summaryValue, { fontWeight: FontWeight.bold, color: colors.text }]}>
                      {formatCurrency(totalSaldar)}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.saldarLabel, { color: colors.textSecondary, marginTop: Spacing.sm }]}>
                  Método: {METODO_PAGO_LABELS[metodo] || 'EFECTIVO'}
                </Text>
                <View style={[styles.saldarWarning, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                  <Text style={{ color: '#991B1B', fontSize: FontSize.xs }}>
                    Esta acción liquidará TODAS las cuotas pendientes. No se puede deshacer.
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
                    onPress={() => { setShowSaldarModal(false); setConfirmacionTexto(''); }}
                    variant="ghost"
                    style={{ flex: 1 }}
                  />
                  <AppButton
                    title="Saldar"
                    loading={isSalding}
                    disabled={confirmacionTexto.toUpperCase() !== 'CONFIRMAR'}
                    onPress={handleSaldar}
                    variant="danger"
                    style={{ flex: 1 }}
                  />
                </View>
              </ScrollView>
            </View>
          </View>
      </KeyboardAvoidingView>
      </Modal>

      {/* Recibo Modal */}
      <Modal visible={showRecibo} transparent animationType="fade" onRequestClose={handleCerrarRecibo}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.reciboCard, { backgroundColor: colors.surfaceElevated }]}>
            <View style={styles.reciboContent}>
              <View style={styles.reciboHeader}>
                <Ionicons name="checkmark-circle" size={scale(48)} color="#16A34A" />
                <Text style={[styles.reciboTitle, { color: colors.text }]}>Pago Registrado</Text>
              </View>

              {reciboData && (
                <>
                  <View style={[styles.reciboDivider, { backgroundColor: colors.border }]} />

                  <ReciboField label="Recibo #" value={reciboData?.pago?.id?.slice(-8).toUpperCase()} colors={colors} />
                  <ReciboField label="Fecha" value={formatDateTime(reciboData?.pago?.createdAt)} colors={colors} />

                  <View style={[styles.reciboDivider, { backgroundColor: colors.border }]} />

                  <ReciboField label="Cliente" value={`${reciboData?.cliente?.nombre || ''} ${reciboData?.cliente?.apellido || ''}`} colors={colors} />
                  <ReciboField label="Cédula" value={reciboData?.cliente?.cedula} colors={colors} />

                  <View style={[styles.reciboDivider, { backgroundColor: colors.border }]} />

                  <View style={styles.reciboGrid}>
                    <View style={styles.reciboGridItem}>
                      <Text style={[styles.reciboGridLabel, { color: colors.textTertiary }]}>Capital</Text>
                      <Text style={[styles.reciboGridValue, { color: colors.text }]}>
                        {formatCurrency(reciboData?.pago?.capital || 0)}
                      </Text>
                    </View>
                    <View style={styles.reciboGridItem}>
                      <Text style={[styles.reciboGridLabel, { color: colors.textTertiary }]}>Interés</Text>
                      <Text style={[styles.reciboGridValue, { color: colors.warning }]}>
                        {formatCurrency(reciboData?.pago?.interes || 0)}
                      </Text>
                    </View>
                    <View style={styles.reciboGridItem}>
                      <Text style={[styles.reciboGridLabel, { color: colors.textTertiary }]}>Mora</Text>
                      <Text style={[styles.reciboGridValue, { color: colors.error }]}>
                        {formatCurrency(reciboData?.pago?.mora || 0)}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.reciboTotal, { backgroundColor: colors.primaryLight }]}>
                    <Text style={[styles.reciboTotalLabel, { color: colors.primary }]}>Total pagado</Text>
                    <Text style={[styles.reciboTotalValue, { color: colors.primary }]}>
                      {formatCurrency(reciboData?.pago?.montoTotal || 0)}
                    </Text>
                  </View>

                  <ReciboField label="Método" value={METODO_PAGO_LABELS[reciboData?.pago?.metodo] || reciboData?.pago?.metodo} colors={colors} />

                  {reciboData?.pago?.referencia && (
                    <ReciboField label="Referencia" value={reciboData.pago.referencia} colors={colors} />
                  )}

                  {reciboData?.pago?.observacion && (
                    <ReciboField label="Observación" value={reciboData.pago.observacion} colors={colors} />
                  )}

                  {reciboData?.pago?.abonoCapital > 0 && (
                    <View style={[styles.badge, { backgroundColor: '#F0FDF4', borderColor: '#86EFAC', marginTop: Spacing.sm }]}>
                      <Ionicons name="arrow-forward" size={scale(14)} color="#16A34A" />
                      <Text style={[styles.badgeText, { color: '#16A34A' }]}>
                        Abono a capital: {formatCurrency(reciboData.pago.abonoCapital)}
                      </Text>
                    </View>
                  )}

                  {reciboData?.prestamo?.saldoPendiente <= 0.01 && (
                    <View style={[styles.badge, { backgroundColor: '#F0FDF4', borderColor: '#86EFAC', marginTop: Spacing.sm }]}>
                      <Ionicons name="checkmark-done-circle" size={scale(16)} color="#16A34A" />
                      <Text style={[styles.badgeText, { color: '#16A34A', fontWeight: FontWeight.bold }]}>
                        ¡Préstamo completamente pagado!
                      </Text>
                    </View>
                  )}

                  <ReciboField label="Registrado por" value={reciboData?.usuario?.nombre || 'Sistema'} colors={colors} />
                </>
              )}

              <View style={styles.reciboActions}>
                <AppButton
                  title="Guardar PDF"
                  onPress={handlePressGuardarPDF}
                  variant="secondary"
                  icon="download-outline"
                />
                <AppButton
                  title={reciboCloseLabel}
                  onPress={handleCerrarRecibo}
                  variant="primary"
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const ReciboField = ({ label, value, colors }: { label: string; value?: string; colors: any }) => (
  <View style={styles.reciboFieldRow}>
    <Text style={[styles.reciboFieldLabel, { color: colors.textTertiary }]}>{label}</Text>
    <Text style={[styles.reciboFieldValue, { color: colors.text }]}>{value || '—'}</Text>
  </View>
);

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  headerInfo: { flex: 1, marginLeft: Spacing.sm },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  headerSub: { fontSize: FontSize.xs, marginTop: scale(1) },
  scrollContent: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  summaryCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  summaryLabel: { fontSize: FontSize.xs, width: scale(120) },
  summaryValue: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, flex: 1 },
  montoInfo: { marginTop: Spacing.xs, marginBottom: Spacing.xs },
  montoInfoText: { fontSize: FontSize.xs },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.sm,
    marginTop: Spacing.xs,
  },
  badgeText: { fontSize: FontSize.xs, flex: 1 },
  metodoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  metodoCard: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  metodoText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  actionButtons: { gap: Spacing.sm, marginTop: Spacing.lg },
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
  modalTitle: { color: '#FFFFFF', fontSize: FontSize.md, fontWeight: FontWeight.bold },
  modalBody: { padding: Spacing.md },
  confirmText: { fontSize: FontSize.sm, marginBottom: Spacing.md },
  confirmExcedente: { fontSize: FontSize.xs, color: '#16A34A', marginBottom: Spacing.sm },
  saldarLabel: { fontSize: FontSize.sm, marginBottom: Spacing.sm },
  saldarWarning: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
  },
  saldarTotalRow: { borderTopWidth: 1 },
  formLabel: { fontSize: FontSize.sm, marginBottom: Spacing.xs },
  confirmInput: {
    height: scale(48),
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.md,
    marginBottom: Spacing.md,
    textAlign: 'center',
    fontWeight: FontWeight.bold,
  },
  modalActions: { flexDirection: 'row', gap: Spacing.sm },
  reciboCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    maxHeight: '90%',
  },
  reciboContent: { padding: Spacing.md },
  reciboHeader: { alignItems: 'center', paddingVertical: Spacing.md },
  reciboTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, marginTop: Spacing.sm },
  reciboDivider: { height: scale(1), marginVertical: Spacing.md },
  reciboFieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  reciboFieldLabel: { fontSize: FontSize.xs, flex: 1 },
  reciboFieldValue: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, flex: 2, textAlign: 'right' },
  reciboGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  reciboGridItem: { flex: 1, alignItems: 'center' },
  reciboGridLabel: { fontSize: FontSize.xs, marginBottom: scale(2) },
  reciboGridValue: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  reciboTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginVertical: Spacing.sm,
  },
  reciboTotalLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  reciboTotalValue: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  reciboActions: { marginTop: Spacing.md, gap: Spacing.sm },
});
