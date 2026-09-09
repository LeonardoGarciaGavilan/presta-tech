import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppButton } from '@/components/ui/app-button';
import { HoldToConfirmButton } from '@/components/ui/hold-to-confirm-button';
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

  const handleCancelar = () => {
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancelar}>
      <KeyboardAvoidingView
        style={[styles.overlay, { backgroundColor: colors.overlay }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
          <View style={[styles.headerBar, { backgroundColor: colors.primary }]}>
            <Ionicons name="cash" size={scale(24)} color="#FFFFFF" />
            <Text style={[styles.title, { color: '#FFFFFF' }]}>Desembolsar Préstamo</Text>
          </View>
          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled" bounces={false} contentContainerStyle={{ paddingBottom: Spacing.sm }}>
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
              <View style={styles.actions}>
                <HoldToConfirmButton
                  title="Desembolsar"
                  loading={loading}
                  onConfirm={onConfirm}
                  hint="Mantén presionado para confirmar el desembolso"
                />
                <AppButton
                  title="Cancelar"
                  onPress={handleCancelar}
                  variant="ghost"
                />
              </View>
            </ScrollView>
          </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  title: {
    color: '#FFFFFF',
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  body: {
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
  actions: {
    gap: Spacing.sm,
    flexShrink: 0,
  },
});
