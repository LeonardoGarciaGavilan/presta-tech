import { useCallback, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRefinanciarPrestamo } from '@/hooks/use-prestamos';
import { AppButton } from '@/components/ui/app-button';
import { useTheme } from '@/components/ui/theme-provider';
import { FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';

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

export default RefinanciarModal;
