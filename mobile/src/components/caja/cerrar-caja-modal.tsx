import { useCallback, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppStyles, BorderRadius, FontSize, FontWeight, Spacing, scale } from '@/constants/theme';
import { formatCurrency, unformatIngresosInput } from '@/utils/formatters';
import { useTheme } from '@/components/ui/theme-provider';
import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import DiferenciaBadge from './diferencia-badge';

export interface DatosCierre {
  monto: number;
  observaciones?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onConfirm: (datos: DatosCierre) => Promise<void>;
  confirmando?: boolean;
  esperado: number;
  filas?: { label: string; valor: string; color?: string }[];
  cabecera?: string;
  umbralDiferencia?: number;
}

export default function ModalCerrarCaja({
  visible,
  onClose,
  onConfirm,
  confirmando,
  esperado,
  filas,
  cabecera,
  umbralDiferencia = 100,
}: Props) {
  const { colors } = useTheme();
  const [montoCierre, setMontoCierre] = useState('');
  const [observaciones, setObservaciones] = useState('');

  const cerrar = useCallback(async () => {
    const monto = parseFloat(unformatIngresosInput(montoCierre)) || 0;
    const dif = monto - esperado;
    if (Math.abs(dif) > umbralDiferencia) {
      Alert.alert(
        dif > 0 ? 'Sobrante detectado' : 'Faltante detectado',
        `La diferencia entre el monto real y el esperado es de ${formatCurrency(Math.abs(dif))} (${dif > 0 ? 'sobrante' : 'faltante'}). ¿Deseas continuar con el cierre?`,
        [
          { text: 'Revisar', style: 'cancel' },
          {
            text: 'Cerrar de todos modos',
            style: 'destructive',
            onPress: () => {
              void onConfirm({ monto, observaciones: observaciones || undefined });
            },
          },
        ],
      );
      return;
    }
    await onConfirm({ monto, observaciones: observaciones || undefined });
  }, [montoCierre, observaciones, esperado, umbralDiferencia, onConfirm]);

  const handleClose = useCallback(() => {
    setMontoCierre('');
    setObservaciones('');
    onClose();
  }, [onClose]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
            <View style={[styles.headerBar, { backgroundColor: colors.error }]}>
              <Ionicons name="lock-closed" size={scale(22)} color="#FFFFFF" />
              <Text style={styles.title}>Cerrar Caja{cabecera ? ` — ${cabecera}` : ''}</Text>
            </View>
            <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
              {filas && filas.length > 0 && (
                <View style={[styles.summaryBox, { backgroundColor: colors.borderLight, borderColor: colors.border }]}>
                  {filas.map((fila, i) => (
                    <View
                      key={i}
                      style={[
                        styles.summaryRow,
                        i === filas.length - 1 && {
                          borderBottomWidth: 1,
                          borderBottomColor: colors.borderLight,
                          paddingBottom: Spacing.xs,
                        },
                      ]}
                    >
                      <Text style={{ fontSize: FontSize.xs, color: colors.textTertiary }}>{fila.label}</Text>
                      <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: fila.color || colors.text }}>
                        {fila.valor}
                      </Text>
                    </View>
                  ))}
                  <View style={[styles.summaryRow, styles.summaryRowTotal]}>
                    <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: colors.text }}>
                      Efectivo esperado
                    </Text>
                    <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: colors.text }}>
                      {formatCurrency(esperado)}
                    </Text>
                  </View>
                </View>
              )}
              <AppInput
                label="Monto real en caja (RD$)"
                value={montoCierre}
                onChangeText={setMontoCierre}
                placeholder={formatCurrency(esperado).replace('RD$ ', '')}
                format="currency"
                keyboardType="decimal-pad"
                prefix="RD$"
              />
              {montoCierre ? (
                <DiferenciaBadge monto={parseFloat(unformatIngresosInput(montoCierre)) || 0} esperado={esperado} />
              ) : null}
              <AppInput
                label="Observaciones (opcional)"
                value={observaciones}
                onChangeText={setObservaciones}
                placeholder="Notas del cierre..."
              />
              <View style={styles.actions}>
                <AppButton title="Cancelar" onPress={handleClose} variant="ghost" style={{ flex: 1 }} />
                <AppButton
                  title="Cerrar Caja"
                  onPress={cerrar}
                  loading={confirmando}
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
  );
}

const styles = {
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  } as AppStyles,
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  } as AppStyles,
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
  } as AppStyles,
  title: { color: '#FFFFFF', fontSize: FontSize.md, fontWeight: FontWeight.bold },
  body: { padding: Spacing.md },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm } as AppStyles,
  summaryBox: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  } as AppStyles,
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: scale(2),
  } as AppStyles,
  summaryRowTotal: {
    paddingTop: Spacing.sm,
    marginTop: Spacing.xs,
  } as AppStyles,
} as const;
