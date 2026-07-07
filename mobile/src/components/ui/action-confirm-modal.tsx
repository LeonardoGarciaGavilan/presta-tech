import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { formatCurrency } from '@/utils/formatters';
import { AppButton } from '@/components/ui/app-button';
import { useTheme } from '@/components/ui/theme-provider';

interface ActionConfirmModalProps {
  visible: boolean;
  titulo: string;
  desc: string;
  icon: string;
  colorAccion: string;
  pedirMotivo: boolean;
  prestamo?: { monto: number; numeroCuotas?: number; frecuenciaPago?: string } | null;
  cliente?: { nombre: string; apellido?: string | null } | null;
  loading?: boolean;
  onConfirm: (motivo?: string) => void;
  onCancel: () => void;
}

export default function ActionConfirmModal({
  visible,
  titulo,
  desc,
  icon,
  colorAccion,
  pedirMotivo,
  prestamo,
  cliente,
  loading,
  onConfirm,
  onCancel,
}: ActionConfirmModalProps) {
  const { colorScheme, colors } = useTheme();
  const [motivo, setMotivo] = useState('');

  const handleCancel = () => {
    setMotivo('');
    onCancel();
  };

  const handleConfirm = () => {
    onConfirm(pedirMotivo ? motivo : undefined);
    setMotivo('');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
            <View style={[styles.headerBar, { backgroundColor: colorAccion }]}>
              <Ionicons name={icon as any} size={22} color="#FFFFFF" />
              <Text style={styles.title}>{titulo}</Text>
            </View>
            <ScrollView
              style={styles.body}
              keyboardShouldPersistTaps="handled"
              bounces={false}
            >
              <Text style={[styles.desc, { color: colors.textSecondary }]}>{desc}</Text>

              {prestamo && (
                <View style={[styles.summaryCard, { backgroundColor: colors.borderLight, borderColor: colors.border }]}>
                  {cliente && (
                    <View style={styles.summaryRow}>
                      <Ionicons name="person-outline" size={14} color={colors.textSecondary} />
                      <Text style={[styles.summaryText, { color: colors.text }]}>
                        {cliente.nombre} {cliente.apellido ?? ''}
                      </Text>
                    </View>
                  )}
                  <View style={styles.summaryRow}>
                    <Ionicons name="cash-outline" size={14} color={colors.textSecondary} />
                    <Text style={[styles.summaryText, { color: colors.text }]}>
                      {formatCurrency(prestamo.monto)}
                    </Text>
                  </View>
                  {prestamo.numeroCuotas && (
                    <View style={styles.summaryRow}>
                      <Ionicons name="repeat-outline" size={14} color={colors.textSecondary} />
                      <Text style={[styles.summaryText, { color: colors.text }]}>
                        {prestamo.numeroCuotas} cuotas · {prestamo.frecuenciaPago}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {pedirMotivo && (
                <>
                  <Text style={[styles.motivoLabel, { color: colors.text }]}>
                    Motivo del rechazo <Text style={{ color: colors.error }}>*</Text>
                  </Text>
                  <TextInput
                    value={motivo}
                    onChangeText={setMotivo}
                    placeholder="Indica el motivo..."
                    placeholderTextColor={colors.textTertiary}
                    multiline
                    numberOfLines={3}
                    style={[styles.motivoInput, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, color: colors.text }]}
                  />
                </>
              )}

              <View style={styles.actions}>
                <AppButton
                  title="Cancelar"
                  onPress={handleCancel}
                  variant="ghost"
                  style={{ flex: 1 }}
                />
                <AppButton
                  title={titulo}
                  loading={loading}
                  disabled={pedirMotivo && !motivo.trim()}
                  onPress={handleConfirm}
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
  desc: {
    fontSize: FontSize.sm,
    marginBottom: Spacing.md,
    lineHeight: 20,
  },
  motivoLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.xs,
  },
  motivoInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    fontSize: FontSize.sm,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: Spacing.md,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  summaryCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.sm + 2,
    marginBottom: Spacing.md,
    gap: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
});
