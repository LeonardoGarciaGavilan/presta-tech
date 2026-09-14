import { useEffect } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { ReactNode } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/components/ui/theme-provider';

interface AnimatedModalProps {
  visible: boolean;
  onRequestClose: () => void;
  children: ReactNode;
  cardStyle?: StyleProp<ViewStyle>;
  avoidKeyboard?: boolean;
  accessibilityLabel?: string;
}

export default function AnimatedModal({
  visible,
  onRequestClose,
  children,
  cardStyle,
  avoidKeyboard = false,
  accessibilityLabel,
}: AnimatedModalProps) {
  const { colors } = useTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      progress.value = 0;
      progress.value = withTiming(1, {
        duration: 200,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [visible, progress]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: (1 - progress.value) * 28 },
      { scale: 0.96 + progress.value * 0.04 },
    ],
  }));

  if (!visible) return null;

  const overlay = (
    <View
      style={styles.overlay}
      accessible={!!accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'alert' : undefined}
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: colors.overlay },
          backdropStyle,
        ]}
      />
      <Animated.View
        style={[
          styles.card,
          { backgroundColor: colors.surfaceElevated },
          cardStyle,
          contentStyle,
        ]}
      >
        {children}
      </Animated.View>
    </View>
  );

  return (
    <Modal visible transparent animationType="none" onRequestClose={onRequestClose}>
      {avoidKeyboard ? (
        <KeyboardAvoidingView
          style={styles.kav}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {overlay}
        </KeyboardAvoidingView>
      ) : (
        overlay
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  kav: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
});