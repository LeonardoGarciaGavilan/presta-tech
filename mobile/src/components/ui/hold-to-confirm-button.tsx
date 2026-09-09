import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { BorderRadius, FontSize, FontWeight, scale, Spacing } from '@/constants/theme';
import { useTheme } from '@/components/ui/theme-provider';

type HoldVariant = 'primary' | 'secondary' | 'danger';

interface HoldToConfirmButtonProps {
  title: string;
  onConfirm: () => void;
  loading?: boolean;
  variant?: HoldVariant;
  durationMs?: number;
  hint?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
  disabled?: boolean;
}

export function HoldToConfirmButton({
  title,
  onConfirm,
  loading = false,
  variant = 'primary',
  durationMs = 1500,
  hint,
  icon = 'lock-closed',
  style,
  disabled,
}: HoldToConfirmButtonProps) {
  const { colors } = useTheme();
  const [pct, setPct] = useState(0);
  const [holding, setHolding] = useState(false);

  const startRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firedRef = useRef(false);

  const progress = useSharedValue(0);
  const pulse = useSharedValue(0);

  const isDisabled = disabled || loading;

  const clearHold = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }, []);

  const handleHoldComplete = useCallback(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    clearHold();
    // eslint-disable-next-line react-hooks/immutability
    progress.value = withTiming(1, { duration: 100 });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onConfirm();
  }, [clearHold, onConfirm, progress]);

  const handlePressIn = useCallback(
    () => {
      if (isDisabled || firedRef.current || tickRef.current) return;
      firedRef.current = false;
      setHolding(true);
      setPct(0);
      startRef.current = Date.now();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      // eslint-disable-next-line react-hooks/immutability
      progress.value = withTiming(1, { duration: durationMs });
      tickRef.current = setInterval(() => {
        const ratio = Math.min((Date.now() - startRef.current) / durationMs, 1);
        setPct(Math.round(ratio * 100));
      }, 100);
      holdTimer.current = setTimeout(handleHoldComplete, durationMs);
    },
    [durationMs, handleHoldComplete, isDisabled, progress],
  );

  const handlePressOut = useCallback(() => {
    setHolding(false);
    clearHold();
    if (firedRef.current) return;
    cancelAnimation(progress);
    // eslint-disable-next-line react-hooks/immutability
    progress.value = withTiming(0, { duration: 150 });
    setPct(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [clearHold, progress]);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(withTiming(1, { duration: 900 }), withTiming(0, { duration: 900 })),
      -1,
      false,
    );
  }, [pulse]);

  useEffect(() => clearHold, [clearHold]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const markerStyle = useAnimatedStyle(() => ({
    left: `${progress.value * 100}%`,
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.05 }],
  }));

  const baseColor =
    variant === 'danger'
      ? colors.error
      : variant === 'secondary'
        ? colors.secondary
        : colors.primary;

  return (
    <View style={[styles.wrapper, style]}>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: isDisabled ? colors.disabled : baseColor },
          pressed && !isDisabled && styles.pressed,
        ]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        accessible
        accessibilityRole="button"
        accessibilityLabel={loading ? `${title}, cargando` : title}
        accessibilityHint={hint}
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        accessibilityActions={[{ name: 'confirm', label: 'Confirmar' }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'confirm') handleHoldComplete();
        }}
      >
        <Animated.View
          pointerEvents="none"
          style={[styles.fill, { backgroundColor: 'rgba(255, 255, 255, 0.28)' }, fillStyle]}
        />
        <Animated.View pointerEvents="none" style={[styles.marker, markerStyle]} />
        {loading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <View style={styles.content}>
            <Animated.View style={pulseStyle}>
              <Ionicons
                name={holding ? 'hand-left' : icon}
                size={scale(20)}
                color="#FFFFFF"
                style={styles.icon}
              />
            </Animated.View>
            <Text numberOfLines={1} style={styles.text}>
              {title}
            </Text>
            {holding && !isDisabled ? (
              <Text style={styles.pct}>{pct}%</Text>
            ) : null}
          </View>
        )}
      </Pressable>
      {hint ? (
        <Text style={[styles.hint, { color: colors.textTertiary }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'stretch',
  },
  button: {
    height: scale(48),
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  fill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
  },
  marker: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: Spacing.sm,
  },
  text: {
    color: '#FFFFFF',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    flexShrink: 1,
  },
  pct: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    marginLeft: Spacing.xs,
    minWidth: scale(34),
    textAlign: 'right',
  },
  hint: {
    fontSize: FontSize.xs,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
});