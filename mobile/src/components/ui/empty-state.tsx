import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppButton } from '@/components/ui/app-button';
import { FontSize, FontWeight, scale, Spacing } from '@/constants/theme';
import { useTheme } from '@/components/ui/theme-provider';

interface EmptyStateProps {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({
  title,
  subtitle,
  icon = 'folder-open-outline',
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const { colorScheme, colors } = useTheme();

  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={scale(64)} color={colors.textTertiary} accessibilityRole="image" accessibilityLabel={title} />
      <Text accessibilityRole="header" style={[styles.title, { color: colors.textSecondary }]}>{title}</Text>
      {subtitle && (
        <Text accessibilityRole="text" style={[styles.subtitle, { color: colors.textTertiary }]}>{subtitle}</Text>
      )}
      {actionLabel && onAction && (
        <AppButton title={actionLabel} onPress={onAction} style={styles.action} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
  subtitle: {
    fontSize: FontSize.md,
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: scale(22),
  },
  action: {
    marginTop: Spacing.lg,
    minWidth: scale(160),
  },
});
