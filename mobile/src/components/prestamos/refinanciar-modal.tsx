import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRefinanciarPrestamo } from '@/hooks/use-prestamos';
import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import { useTheme } from '@/components/ui/theme-provider';
import { useToast } from '@/components/ui/toast';
import { FontSize, FontWeight, Spacing, BorderRadius, scale} from '@/constants/theme';

interface RefinanciarModalProps {
  visible: boolean;
  onClose: () => void;
  prestamoId: string;
  onSuccess?: () => void;
}

const RefinanciarModal = ({ visible, onClose, prestamoId, onSuccess }: RefinanciarModalProps) => {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const refinanciarMutation = useRefinanciarPrestamo();
  const [nuevasCuotas, setNuevasCuotas] = useState('');
  const [nuevaTasa, setNuevaTasa] = useState('');

  const handleRefinanciar = useCallback(async () => {
    const cuotasNum = parseInt(nuevasCuotas, 10);
    const tasaNum = parseFloat(nuevaTasa);
    if (!cuotasNum || cuotasNum <= 0 || !tasaNum || tasaNum <= 0) {
      showToast('Ingresa valores válidos', 'error');
      return;
    }
    try {
      await refinanciarMutation.mutateAsync({
        id: prestamoId,
        data: { nuevasCuotas: cuotasNum, nuevaTasa: tasaNum },
      });
      onSuccess?.();
      onClose();
    } catch (err: any) {
      showToast(err?.message || 'Error al refinanciar', 'error');
    }
  }, [nuevasCuotas, nuevaTasa, prestamoId, refinanciarMutation, onSuccess, onClose, showToast]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
            <View style={[styles.headerBar, { backgroundColor: colors.primary }]}>
              <Ionicons name="refresh" size={scale(22)} color="#FFFFFF" />
              <Text style={[styles.title, { color: '#FFFFFF' }]}>Refinanciar Préstamo</Text>
            </View>
            <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
              <AppInput
                label="Nuevo número de cuotas"
                placeholder="Ej: 12"
                keyboardType="numeric"
                value={nuevasCuotas}
                onChangeText={setNuevasCuotas}
              />
              <AppInput
                label="Nueva tasa de interés (%)"
                placeholder="Ej: 3.5"
                keyboardType="decimal-pad"
                value={nuevaTasa}
                onChangeText={setNuevaTasa}
              />
              <View style={styles.actions}>
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
  title: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  body: { padding: Spacing.md },
  actions: { flexDirection: 'row', gap: Spacing.sm },
});

export default RefinanciarModal;
