import { useCallback } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/components/ui/theme-provider';
import { AppButton } from '@/components/ui/app-button';
import { useToast } from '@/components/ui/toast';
import { useImprimirRecibo } from '@/hooks/use-imprimir-recibo';
import { FontSize, FontWeight, Spacing, BorderRadius, scale } from '@/constants/theme';
import { formatCurrency, formatDateTime } from '@/utils/formatters';
import { guardarReciboPDF, reciboPagoImprimible, type ReciboData } from '@/utils/recibo-pdf';
import { METODO_PAGO_LABELS } from '@/constants/pagos.constants';

interface ReciboPagoModalProps {
  visible: boolean;
  reciboData: ReciboData | null;
  onClose: () => void;
  title?: string;
  closeLabel?: string;
}

export default function ReciboPagoModal({
  visible,
  reciboData,
  onClose,
  title = 'Pago Registrado',
  closeLabel = 'Cerrar',
}: ReciboPagoModalProps) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const { printer, imprimiendo, imprimir } = useImprimirRecibo();

  const handlePressImprimir = useCallback(async () => {
    if (!reciboData) return;
    const resultado = await imprimir(reciboPagoImprimible(reciboData));
    if (resultado.ok) {
      showToast('Recibo enviado a la impresora', 'success');
    } else if (resultado.motivo === 'sin-impresora') {
      showToast('No hay impresora configurada. Ve a Ajustes → Impresora.', 'error');
    } else {
      showToast(resultado.mensaje, 'error');
    }
  }, [reciboData, imprimir, showToast]);

  const handlePressGuardarPDF = useCallback(async () => {
    if (!reciboData) return;
    try {
      const numero = (reciboData?.pago?.id ?? '').slice(-8);
      await guardarReciboPDF(reciboData);
      showToast(`PDF guardado: recibo_${numero || 'pago'}.pdf`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Error al guardar PDF', 'error');
    }
  }, [reciboData, showToast]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
        <View style={[styles.reciboCard, { backgroundColor: colors.surfaceElevated }]}>
          <ScrollView contentContainerStyle={styles.reciboContent}>
            <View style={styles.reciboHeader}>
              <Ionicons name="checkmark-circle" size={scale(48)} color="#16A34A" />
              <Text style={[styles.reciboTitle, { color: colors.text }]}>{title}</Text>
            </View>

            {reciboData && (
              <>
                <View style={[styles.reciboDivider, { backgroundColor: colors.border }]} />

                <ReciboField label="Recibo #" value={reciboData?.pago?.id?.slice(-8).toUpperCase()} colors={colors} />
                <ReciboField label="Fecha" value={formatDateTime(reciboData?.pago?.createdAt ?? null)} colors={colors} />

                <View style={[styles.reciboDivider, { backgroundColor: colors.border }]} />

                <ReciboField
                  label="Cliente"
                  value={`${reciboData?.cliente?.nombre || ''} ${reciboData?.cliente?.apellido || ''}`}
                  colors={colors}
                />
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

                <ReciboField
                  label="Método"
                  value={METODO_PAGO_LABELS[reciboData?.pago?.metodo ?? ''] || reciboData?.pago?.metodo}
                  colors={colors}
                />

                {reciboData?.pago?.referencia && (
                  <ReciboField label="Referencia" value={reciboData.pago.referencia} colors={colors} />
                )}

                {reciboData?.pago?.observacion && (
                  <ReciboField label="Observación" value={reciboData.pago.observacion} colors={colors} />
                )}

                {(reciboData?.pago?.abonoCapital ?? 0) > 0 && (
                  <View style={[styles.badge, { backgroundColor: '#F0FDF4', borderColor: '#86EFAC', marginTop: Spacing.sm }]}>
                    <Ionicons name="arrow-forward" size={scale(14)} color="#16A34A" />
                    <Text style={[styles.badgeText, { color: '#16A34A' }]}>
                      Abono a capital: {formatCurrency(reciboData?.pago?.abonoCapital ?? 0)}
                    </Text>
                  </View>
                )}

                {(reciboData?.prestamo?.saldoPendiente ?? 0) <= 0.01 && (
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
              {Platform.OS === 'android' && (
                <View style={styles.printHintRow}>
                  <Ionicons
                    name="print-outline"
                    size={scale(14)}
                    color={printer ? colors.success : colors.textTertiary}
                  />
                  <Text style={[styles.printHintText, { color: printer ? colors.success : colors.textTertiary }]}>
                    {printer ? `Impresora: ${printer.name}` : 'Sin impresora configurada — configúrala en la pantalla Impresora'}
                  </Text>
                </View>
              )}
              <AppButton
                title="Imprimir"
                onPress={handlePressImprimir}
                variant="secondary"
                icon="print-outline"
                loading={imprimiendo}
              />
              <AppButton
                title="Guardar PDF"
                onPress={handlePressGuardarPDF}
                variant="secondary"
                icon="download-outline"
              />
              <AppButton
                title={closeLabel}
                onPress={onClose}
                variant="primary"
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const ReciboField = ({ label, value, colors }: { label: string; value?: string; colors: any }) => (
  <View style={styles.reciboFieldRow}>
    <Text style={[styles.reciboFieldLabel, { color: colors.textTertiary }]}>{label}</Text>
    <Text style={[styles.reciboFieldValue, { color: colors.text }]}>{value || '—'}</Text>
  </View>
);

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  reciboCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: BorderRadius.lg,
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
  printHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  printHintText: { fontSize: FontSize.xs, flex: 1 },
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
});