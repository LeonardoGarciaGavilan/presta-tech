import { useCallback, useRef } from 'react';
import { type TouchableOpacityProps, ActivityIndicator, StyleSheet, Text, TouchableOpacity, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { BorderRadius, Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { useTheme } from '@/components/ui/theme-provider';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';

interface AppButtonProps extends TouchableOpacityProps {
  title: string;
  loading?: boolean;
  variant?: ButtonVariant;
  icon?: keyof typeof Ionicons.glyphMap;
  iconSize?: number;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

function getButtonStyle(
  variant: ButtonVariant,
  isDisabled: boolean,
  colors: typeof Colors.light,
): ViewStyle {
  if (isDisabled) {
    return {
      backgroundColor: variant === 'ghost' ? 'transparent' : colors.disabled,
      borderWidth: variant === 'ghost' || variant === 'outline' ? 1 : 0,
      borderColor: colors.disabled,
    };
  }

  switch (variant) {
    case 'primary':
      return { backgroundColor: colors.primary, borderWidth: 0 };
    case 'secondary':
      return { backgroundColor: colors.secondary, borderWidth: 0 };
    case 'danger':
      return { backgroundColor: colors.error, borderWidth: 0 };
    case 'ghost':
      return {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: colors.border,
      };
    case 'outline':
      return {
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderColor: colors.primary,
      };
    default:
      return { backgroundColor: colors.primary, borderWidth: 0 };
  }
}

function getTextColor(variant: ButtonVariant, isDisabled: boolean, colors: typeof Colors.light): string {
  if (isDisabled) return '#FFFFFF';
  if (variant === 'ghost') {
    return colors.textSecondary;
  }
  if (variant === 'outline') {
    return colors.primary;
  }
  return '#FFFFFF';
}

export function AppButton({
  title,
  loading = false,
  disabled,
  variant = 'primary',
  icon,
  iconSize = 20,
  style,
  onPress,
  ...props
}: AppButtonProps) {
  const { colorScheme, colors } = useTheme();
  const isDisabled = disabled || loading;
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  }, [scale]);

  return (
    <AnimatedTouchable
      style={[
        styles.button,
        getButtonStyle(variant, isDisabled, colors),
        animatedStyle,
        style,
      ]}
      disabled={isDisabled}
      activeOpacity={0.8}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      accessible
      accessibilityRole="button"
      accessibilityLabel={loading ? `${title}, cargando` : title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <>
          {icon && (
            <Ionicons
              name={icon}
              size={iconSize}
              color={getTextColor(variant, isDisabled, colors)}
              style={styles.icon}
            />
          )}
          <Text
            style={[
              styles.text,
              { color: getTextColor(variant, isDisabled, colors) },
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </AnimatedTouchable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 48,
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  icon: {
    marginRight: Spacing.sm,
  },
  text: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
});
