import { createContext,
  useCallback,
  useContext,
  useRef,
  useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BorderRadius, FontSize, FontWeight, IoniconsName, scale, Spacing } from '@/constants/theme';
import { useTheme } from '@/components/ui/theme-provider';

type ToastType = 'success' | 'error' | 'info';

const ERROR_DURATION = 8000;
const DEFAULT_DURATION = 3000;

export function getToastDuration(type: ToastType, override?: number): number {
  if (override !== undefined) return override;
  return type === 'error' ? ERROR_DURATION : DEFAULT_DURATION;
}

interface ToastState {
  message: string;
  type: ToastType;
  visible: boolean;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { colorScheme, colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [toast, setToast] = useState<ToastState | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showToast = useCallback(
    (message: string, type: ToastType = 'success', duration?: number) => {
      if (timerRef.current) clearTimeout(timerRef.current);

      setToast({ message, type, visible: true });

      Animated.spring(opacity, {
        toValue: 1,
        useNativeDriver: true,
        damping: 20,
        stiffness: 200,
      }).start();

      timerRef.current = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          setToast(null);
        });
      }, getToastDuration(type, duration));
    },
    [opacity],
  );

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.timing(opacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setToast(null);
    });
  }, [opacity]);

  const toastColors = {
    success: { bg: colors.successLight, icon: 'checkmark-circle', iconColor: colors.success, text: colors.success },
    error: { bg: colors.errorLight, icon: 'alert-circle', iconColor: colors.error, text: colors.error },
    info: { bg: colors.primaryLight, icon: 'information-circle', iconColor: colors.primary, text: colors.primary },
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <Animated.View
          accessible
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={[
            styles.toast,
            {
              backgroundColor: toastColors[toast.type].bg,
              borderColor: toastColors[toast.type].iconColor,
              top: insets.top + Spacing.sm,
              opacity,
              transform: [
                {
                  translateY: opacity.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Pressable
            style={styles.toastBody}
            onPress={dismiss}
            accessible={false}
          >
            <Ionicons
              name={toastColors[toast.type].icon as IoniconsName}
              size={scale(20)}
              color={toastColors[toast.type].iconColor}
            />
            <Text
              style={[
                styles.toastText,
                { color: toastColors[toast.type].text },
              ]}
              numberOfLines={2}
            >
              {toast.message}
            </Text>
          </Pressable>
          <TouchableOpacity
            onPress={dismiss}
            hitSlop={8}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Cerrar notificación"
          >
            <Ionicons name="close" size={scale(18)} color={toastColors[toast.type].text} />
          </TouchableOpacity>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    zIndex: 9999,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  toastBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  toastText: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
});
