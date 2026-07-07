import { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { BorderRadius } from '@/constants/theme';
import { useTheme } from '@/components/ui/theme-provider';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({
  width = '100%',
  height = 20,
  borderRadius = BorderRadius.sm,
  style,
}: SkeletonProps) {
  const { colorScheme, colors } = useTheme();
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: colors.skeleton,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

export function SkeletonCard({
  lines = 3,
  style,
}: {
  lines?: number;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.cardHeader}>
        <Skeleton width={40} height={40} borderRadius={BorderRadius.full} />
        <View style={styles.cardHeaderText}>
          <Skeleton width="60%" height={16} />
          <Skeleton width="40%" height={12} style={{ marginTop: 4 }} />
        </View>
      </View>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={`${Math.max(50, 100 - i * 15)}%`}
          height={12}
          style={{ marginTop: 8 }}
        />
      ))}
    </View>
  );
}

export function SkeletonKPIGrid() {
  return (
    <View style={styles.kpiGrid}>
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={styles.kpiItem}>
          <Skeleton width={36} height={36} borderRadius={BorderRadius.md} />
          <Skeleton width="70%" height={24} style={{ marginTop: 8 }} />
          <Skeleton width="50%" height={12} style={{ marginTop: 4 }} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {},
  card: {
    padding: 16,
    borderRadius: BorderRadius.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardHeaderText: {
    flex: 1,
    marginLeft: 12,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  kpiItem: {
    width: '47%',
    padding: 16,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
});
