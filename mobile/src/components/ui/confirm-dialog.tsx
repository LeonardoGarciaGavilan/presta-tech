import { Modal, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/ui/app-button';
import { BorderRadius, FontSize, FontWeight, scale, Spacing } from '@/constants/theme';
import { useTheme } from '@/components/ui/theme-provider';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  destructive?: boolean;
}

export default function ConfirmDialog({
  visible,
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  loading = false,
  destructive = false,
}: ConfirmDialogProps) {
  const { colorScheme, colors } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]} accessible accessibilityRole="alert" accessibilityLabel={title}>
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text accessibilityRole="text" style={[styles.message, { color: colors.textSecondary }]}>
            {message}
          </Text>
          <View style={styles.actions}>
            <AppButton
              title={cancelLabel}
              onPress={onCancel}
              disabled={loading}
              style={styles.flexButton}
            />
            <AppButton
              title={confirmLabel}
              onPress={onConfirm}
              loading={loading}
              disabled={loading}
              style={[
                styles.flexButton,
                destructive ? { backgroundColor: colors.error } : undefined,
              ]}
            />
          </View>
        </View>
      </View>
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
    maxWidth: 340,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  message: {
    fontSize: FontSize.md,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    lineHeight: scale(22),
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  flexButton: {
    flex: 1,
  },
});
