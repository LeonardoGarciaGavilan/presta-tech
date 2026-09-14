import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/ui/app-button';
import { HoldToConfirmButton } from '@/components/ui/hold-to-confirm-button';
import AnimatedModal from '@/components/ui/animated-modal';
import ModalHeader from '@/components/ui/modal-header';
import { useTheme } from '@/components/ui/theme-provider';
import { FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { FREQ_LABEL } from '@/constants/prestamos.constants';
import { formatCurrency } from '@/utils/formatters';

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
    <AnimatedModal visible={visible} onRequestClose={handleCancelar} avoidKeyboard>
      <ModalHeader
        icon="cash"
        title="Desembolsar Préstamo"
        onClose={handleCancelar}
      />
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
    </AnimatedModal>
  );
}

const styles = StyleSheet.create({
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
