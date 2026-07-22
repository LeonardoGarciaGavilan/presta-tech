import { memo, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { BorderRadius, Colors, FontSize, FontWeight, Spacing, Shadows, getColor, scale} from '@/constants/theme';
import { useTheme } from '@/components/ui/theme-provider';

interface KpiCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  accent?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  delay?: number;
}

const ACCENT_MAP = {
  primary: { bg: 'primaryLight', icon: 'primary', text: 'primaryDark' },
  success: { bg: 'secondaryLight', icon: 'secondary', text: 'secondary' },
  warning: { bg: 'warningLight', icon: 'warning', text: 'warning' },
  danger: { bg: 'errorLight', icon: 'error', text: 'error' },
  info: { bg: 'infoLight', icon: 'info', text: 'info' },
};

function KpiCardBase({
  icon,
  value,
  label,
  accent = 'primary',
  delay = 0,
}: KpiCardProps) {
  const { colors } = useTheme();
  const animScale = useSharedValue(0.8);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      animScale.value = withSpring(1, { damping: 12, stiffness: 200 });
      opacity.value = withSpring(1);
    }, delay);
    return () => clearTimeout(timer);
  }, [delay, animScale, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: animScale.value }],
    opacity: opacity.value,
  }));

  const accentColors = ACCENT_MAP[accent];

  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        Shadows.sm,
        animatedStyle,
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: getColor(colors, accentColors.bg) },
        ]}
      >
        <Ionicons
          name={icon}
          size={scale(20)}
          color={getColor(colors, accentColors.icon)}
        />
      </View>
      <Text style={[styles.value, { color: colors.text }]} accessibilityRole="text">{value}</Text>
      <Text style={[styles.label, { color: colors.textSecondary }]} accessibilityRole="text">
        {label}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  iconWrap: {
    width: scale(36),
    height: scale(36),
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  value: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    marginBottom: scale(2),
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    textAlign: 'center',
  },
});

const KpiCard = memo(KpiCardBase);
KpiCard.displayName = 'KpiCard';

export default KpiCard;
