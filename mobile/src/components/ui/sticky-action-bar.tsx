import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BorderRadius, Shadows, Spacing, scale } from '@/constants/theme';
import { useTheme } from '@/components/ui/theme-provider';
import { AppButton } from '@/components/ui/app-button';

export interface StickyAction {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  variant?: 'outline' | 'ghost' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
}

export interface StickyActionBarProps {
  primaryAction: Omit<StickyAction, 'variant'> & { color?: string };
  secondaryActions?: StickyAction[];
  style?: StyleProp<ViewStyle>;
  variant?: 'bar' | 'floating';
}

export function StickyActionBar({
  primaryAction,
  secondaryActions = [],
  style,
  variant = 'bar',
}: StickyActionBarProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const floating = variant === 'floating';

  if (floating && secondaryActions.length === 0) {
    return (
      <View style={[styles.fabWrap, { bottom: insets.bottom + Spacing.xs }, style]} pointerEvents="box-none">
        <AppButton
          title={primaryAction.label}
          icon={primaryAction.icon}
          onPress={primaryAction.onPress}
          loading={primaryAction.loading}
          disabled={primaryAction.disabled}
          style={[
            styles.fabBtn,
            Shadows.lg,
            primaryAction.color ? { backgroundColor: primaryAction.color } : null,
          ]}
        />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        floating ? styles.containerFloating : styles.containerBar,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        floating ? { bottom: insets.bottom + Spacing.sm } : { paddingBottom: insets.bottom },
        { borderTopColor: colors.border },
        floating && Shadows.lg,
        style,
      ]}
    >
      {secondaryActions.length > 0 && (
        <View style={styles.secondaryRow}>
          {secondaryActions.map((action, index) => (
            <AppButton
              key={index}
              title={action.label}
              icon={action.icon}
              variant={action.variant || 'outline'}
              onPress={action.onPress}
              loading={action.loading}
              disabled={action.disabled}
              style={styles.secondaryBtn}
            />
          ))}
        </View>
      )}
      <AppButton
        title={primaryAction.label}
        icon={primaryAction.icon}
        onPress={primaryAction.onPress}
        loading={primaryAction.loading}
        disabled={primaryAction.disabled}
        style={[
          styles.primaryBtn,
          primaryAction.color ? { backgroundColor: primaryAction.color } : null,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 8,
  },
  containerBar: {
    borderTopWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  containerFloating: {
    left: Spacing.md,
    right: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
    justifyContent: 'center',
  },
  secondaryBtn: {
    flex: 1,
    maxWidth: 160,
  },
  primaryBtn: {
    width: '100%',
    height: scale(54),
  },
  fabWrap: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    alignItems: 'center',
  },
  fabBtn: {
    height: scale(44),
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
  },
});