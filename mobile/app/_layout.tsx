import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Sentry from '@sentry/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useAuthBootstrap } from '@/hooks/use-auth-bootstrap';
import { useAuthStore } from '@/store/auth.store';
import { Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { ToastProvider } from '@/components/ui/toast';
import { ThemeProvider } from '@/components/ui/theme-provider';
import { ErrorBoundary } from '@/components/ui/error-boundary';

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    debug: __DEV__,
    environment: __DEV__ ? 'development' : 'production',
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
  });
}

function RootLayout() {
  useAuthBootstrap();

  const isHydrated = useAuthStore((state) => state.isHydrated);
  const colorScheme = useColorScheme();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 2,
            staleTime: 1000 * 60 * 5,
            gcTime: 1000 * 60 * 30,
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: 1,
          },
        },
      }),
  );

  const currentColors = Colors[colorScheme ?? 'light'];

  useEffect(() => {
    const asyncStoragePersister = createAsyncStoragePersister({
      storage: AsyncStorage,
    });

    persistQueryClient({
      queryClient,
      persister: asyncStoragePersister,
      maxAge: 1000 * 60 * 60 * 24,
    });
  }, [queryClient]);

  if (!isHydrated) {
    return <SplashScreen backgroundColor={currentColors.background} primaryColor={currentColors.primary} />;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <ToastProvider>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(app)" />
              </Stack>
            </ToastProvider>
          </QueryClientProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function SplashScreen({
  backgroundColor,
  primaryColor,
}: {
  backgroundColor: string;
  primaryColor: string;
}) {
  const scale = useSharedValue(0.6);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 10, stiffness: 80 });
    opacity.value = withTiming(1, { duration: 500 });
  }, [scale, opacity]);

  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1200 }),
        withTiming(1, { duration: 1200 }),
      ),
      -1,
      true,
    );
  }, [pulse]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <SafeAreaProvider>
      <View style={[styles.splash, { backgroundColor }]}>
        <Animated.View style={[styles.splashContent, animStyle]}>
          <Animated.View
            style={[
              styles.splashIcon,
              { backgroundColor: `${primaryColor}18` },
              pulseStyle,
            ]}
          >
            <Ionicons name="shield-checkmark" size={56} color={primaryColor} />
          </Animated.View>
          <Text style={[styles.splashTitle, { color: primaryColor }]}>
            SAS Préstamos
          </Text>
          <Text style={[styles.splashSubtitle, { color: primaryColor + '99' }]}>
            Cargando…
          </Text>
        </Animated.View>
      </View>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashContent: {
    alignItems: 'center',
  },
  splashIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  splashTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
  },
  splashSubtitle: {
    fontSize: FontSize.sm,
    marginTop: Spacing.xs,
  },
});

const WrappedRootLayout = Sentry.wrap(RootLayout);
export default WrappedRootLayout;
