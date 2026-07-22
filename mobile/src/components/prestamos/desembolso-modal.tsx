import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppButton } from '@/components/ui/app-button';
import { useTheme } from '@/components/ui/theme-provider';
import { FontSize, FontWeight, Spacing, BorderRadius, scale} from '@/constants/theme';
import { formatCurrency } from '@/utils/formatters';

const FREQ_LABEL: Record<string, string> = {
  DIARIO: 'diario',
  SEMANAL: 'semanal',
  QUINCENAL: 'quincenal',
  MENSUAL: 'mensual',
};

interface DesembolsoModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
  monto: number;
  numeroCuotas: number;
  tasaInteres: number;
  frecuenciaPago: string;
}

export default function DesembolsoModal({
  visible,
  onClose,
  onConfirm,
  loading = false,
  monto,
  numeroCuotas,
  tasaInteres,
  frecuenciaPago,
}: DesembolsoModalProps) {
  const { colors } = useTheme();
  const [confirmacionTexto, setConfirmacionTexto] = useState('');

  const handleCancelar = () => {
    setConfirmacionTexto('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancelar}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalCard, { backgroundColor: colors.surfaceElevated }]}>
            <View style={[styles.modalHeaderBar, { backgroundColor: colors.primary }]}>
              <Ionicons name="cash" size={scale(24)} color="#FFFFFF" />
              <Text style={[styles.modalTitle, { color: '#FFFFFF' }]}>Desembolsar Préstamo</Text>
            </View>
            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>
                Monto a desembolsar: <Text style={{ fontWeight: FontWeight.bold, color: colors.text }}>{formatCurrency(monto)}</Text>
              </Text>
              <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>
                Cuotas: {numeroCuotas} · {tasaInteres > 0 ? `${tasaInteres}% ${FREQ_LABEL[frecuenciaPago] || frecuenciaPago}` : 'Cuota fija'}
              </Text>
              <View style={[styles.modalWarning, { backgroundColor: colors.warningLight, borderColor: colors.warning }]}>
                <Text style={{ color: colors.warning, fontSize: FontSize.xs }}>
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
                  onPress={handleCancelar}
                  variant="ghost"
                  style={{ flex: 1 }}
                />
                <AppButton
                  title="Desembolsar"
                  loading={loading}
                  disabled={confirmacionTexto.toUpperCase() !== 'CONFIRMAR'}
                  onPress={onConfirm}
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

const styles = StyleSheet.create({
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
    height: scale(48),
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
});
