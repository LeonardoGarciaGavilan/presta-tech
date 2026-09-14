import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/ui/app-button';
import { HoldToConfirmButton } from '@/components/ui/hold-to-confirm-button';
import AnimatedModal from '@/components/ui/animated-modal';
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
  useHold?: boolean;
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
  useHold = false,
}: ConfirmDialogProps) {
  const { colors } = useTheme();

  return (
    <AnimatedModal
      visible={visible}
      onRequestClose={onCancel}
      accessibilityLabel={title}
      cardStyle={styles.card}
    >
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text accessibilityRole="text" style={[styles.message, { color: colors.textSecondary }]}>
        {message}
      </Text>
      {useHold ? (
        <View style={styles.actionsHold}>
          <HoldToConfirmButton
            title={confirmLabel}
            loading={loading}
            variant={destructive ? 'danger' : 'primary'}
            onConfirm={onConfirm}
            icon={destructive ? 'warning' : 'lock-closed'}
            hint="Mantén presionado para confirmar"
          />
          <AppButton
            title={cancelLabel}
            onPress={onCancel}
            disabled={loading}
            variant="ghost"
          />
        </View>
      ) : (
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
      )}
    </AnimatedModal>
  );
}

const styles = StyleSheet.create({
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
  actionsHold: {
    gap: Spacing.sm,
  },
  flexButton: {
    flex: 1,
  },
});
