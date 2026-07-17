import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/components/ui/theme-provider';
import { AppButton } from '@/components/ui/app-button';
import { FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { formatCurrency } from '@/utils/formatters';
import type { ClienteVistaDia } from '@/types/rutas.types';

type PagoMetodo = 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA' | 'CHEQUE';

interface CobroRapidoModalProps {
  visible: boolean;
  cliente: ClienteVistaDia | null;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (data: { metodo: PagoMetodo; referencia?: string }) => void;
}

export default function CobroRapidoModal({
  visible,
  cliente,
  loading = false,
  onClose,
  onConfirm,
}: CobroRapidoModalProps) {
  const { colors } = useTheme();
  const [pagoMetodo, setPagoMetodo] = useState<PagoMetodo>('EFECTIVO');
  const [pagoRef, setPagoRef] = useState('');

  const handleConfirm = () => {
    onConfirm({
      metodo: pagoMetodo,
      referencia: pagoRef || undefined,
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={styles.modalOverlay} onPress={onClose}>
          <Pressable
            style={[styles.cobroModal, { backgroundColor: colors.surfaceElevated }]}
            onPress={() => {}}
          >
            <View style={styles.cobroModalHeader}>
              <Text style={[styles.cobroModalTitle, { color: colors.text }]}>
                Cobro Rápido
              </Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>

            {cliente && (
              <>
                <Text style={[styles.cobroClienteName, { color: colors.text }]}>
                  {cliente.cliente.nombre} {cliente.cliente.apellido || ''}
                </Text>
                {cliente.cliente.telefono && (
                  <Text style={[styles.cobroClientePhone, { color: colors.textTertiary }]}>
                    {cliente.cliente.telefono}
                  </Text>
                )}

                {cliente.prestamos?.map((p) => p.proximaCuota).filter(Boolean).length > 0 && (
                  <View style={styles.cobroCuotasSection}>
                    <Text style={[styles.cobroSectionLabel, { color: colors.textSecondary }]}>
                      Cuotas pendientes
                    </Text>
                    {cliente.prestamos.map(
                      (p) =>
                        p.proximaCuota && (
                          <View
                            key={p.proximaCuota.id}
                            style={[styles.cobroCuotaRow, { borderColor: colors.border }]}
                          >
                            <Text style={[styles.cobroCuotaNum, { color: colors.text }]}>
                              Cuota #{p.proximaCuota.numero}
                            </Text>
                            <View>
                              <Text style={[styles.cobroCuotaMonto, { color: colors.text }]}>
                                RD$ {formatCurrency(p.proximaCuota.total)}
                              </Text>
                              {p.proximaCuota.mora > 0 && (
                                <Text style={[styles.cobroCuotaMora, { color: colors.error }]}>
                                  Mora: RD$ {formatCurrency(p.proximaCuota.mora)}
                                </Text>
                              )}
                            </View>
                          </View>
                        ),
                    )}
                  </View>
                )}

                <View style={[styles.cobroTotalRow, { borderTopColor: colors.border }]}>
                  <Text style={[styles.cobroTotalLabel, { color: colors.text }]}>
                    Total a cobrar
                  </Text>
                  <Text style={[styles.cobroTotalAmount, { color: colors.primary }]}>
                    RD$ {formatCurrency(cliente.totalACobrar)}
                  </Text>
                </View>

                <Text style={[styles.cobroSectionLabel, { color: colors.textSecondary }]}>
                  Método de pago
                </Text>
                <View style={styles.metodoRow}>
                  {(['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'CHEQUE'] as const).map((m) => (
                    <Pressable
                      key={m}
                      style={[
                        styles.metodoChip,
                        {
                          backgroundColor:
                            pagoMetodo === m ? colors.primaryLight : colors.surface,
                          borderColor: pagoMetodo === m ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => setPagoMetodo(m)}
                    >
                      <Text
                        style={[
                          styles.metodoChipText,
                          {
                            color: pagoMetodo === m ? colors.primary : colors.textSecondary,
                            fontWeight: pagoMetodo === m ? '600' : '400',
                          },
                        ]}
                      >
                        {m === 'EFECTIVO'
                          ? 'Efectivo'
                          : m === 'TRANSFERENCIA'
                            ? 'Transferencia'
                            : m === 'TARJETA'
                              ? 'Tarjeta'
                              : 'Cheque'}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <TextInput
                  style={[
                    styles.cobroRefInput,
                    {
                      color: colors.text,
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                  placeholder="Referencia (opcional)"
                  placeholderTextColor={colors.textTertiary}
                  value={pagoRef}
                  onChangeText={setPagoRef}
                />

                <View style={styles.cobroActions}>
                  <AppButton title="Cancelar" variant="ghost" onPress={onClose} />
                  <AppButton
                    title="Cobrar"
                    loading={loading}
                    disabled={!cliente.totalACobrar}
                    onPress={handleConfirm}
                    icon="cash-outline"
                  />
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  cobroModal: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    maxHeight: '80%',
    gap: Spacing.md,
  },
  cobroModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cobroModalTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  cobroClienteName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  cobroClientePhone: {
    fontSize: FontSize.sm,
  },
  cobroCuotasSection: {
    gap: Spacing.xs,
  },
  cobroSectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cobroCuotaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingVertical: Spacing.xs,
  },
  cobroCuotaNum: {
    fontSize: FontSize.sm,
  },
  cobroCuotaMonto: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    textAlign: 'right',
  },
  cobroCuotaMora: {
    fontSize: FontSize.xs,
    textAlign: 'right',
  },
  cobroTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: Spacing.sm,
  },
  cobroTotalLabel: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  cobroTotalAmount: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  metodoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  metodoChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  metodoChipText: {
    fontSize: FontSize.xs,
  },
  cobroRefInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.sm,
  },
  cobroActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
});
