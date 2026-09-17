import { memo, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { BorderRadius, FontSize, FontWeight, Spacing, Shadows, getColor, scale} from '@/constants/theme';
import { useTheme } from '@/components/ui/theme-provider';

interface KpiCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  accent?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  delay?: number;
  width?: number | `${number}%`;
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
  width,
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
        width != null ? { width, maxWidth: width } : { flex: 1 },
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
          size={scale(17)}
          color={getColor(colors, accentColors.icon)}
        />
      </View>
      <View style={styles.textWrap}>
        <Text
          style={[styles.value, { color: colors.text }]}
          accessibilityRole="text"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {value}
        </Text>
        <Text
          style={[styles.label, { color: colors.textSecondary }]}
          accessibilityRole="text"
          numberOfLines={2}
        >
          {label}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
  },
  iconWrap: {
    width: scale(32),
    height: scale(32),
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
  },
  value: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    marginTop: scale(1),
  },
});

const KpiCard = memo(KpiCardBase);
KpiCard.displayName = 'KpiCard';

export default KpiCard;