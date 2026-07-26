import { useEffect, useState, useCallback, useRef } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  SlideInDown,
  SlideOutUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FontSize, FontWeight, Spacing, BorderRadius, Shadows, scale } from '@/constants/theme';
import { useTheme } from '@/components/ui/theme-provider';
import { useNetworkContext } from '@/components/providers/network-provider';
import { onSyncComplete } from '@/services/sync-manager';

type BannerState = 'idle' | 'offline' | 'syncing' | 'synced' | 'restored';

function getBannerColors(
  state: BannerState,
  colorScheme: 'light' | 'dark',
) {
  const isDark = colorScheme === 'dark';
  switch (state) {
    case 'offline':
      return isDark
        ? { bg: '#7F1D1D', text: '#FCA5A5', icon: '#FCA5A5' }
        : { bg: '#EF4444', text: '#FFFFFF', icon: '#FFFFFF' };
    case 'syncing':
      return isDark
        ? { bg: '#78350F', text: '#FCD34D', icon: '#FCD34D' }
        : { bg: '#F59E0B', text: '#FFFFFF', icon: '#FFFFFF' };
    case 'synced':
      return isDark
        ? { bg: '#064E3B', text: '#6EE7B7', icon: '#6EE7B7' }
        : { bg: '#10B981', text: '#FFFFFF', icon: '#FFFFFF' };
    case 'restored':
      return isDark
        ? { bg: '#064E3B', text: '#6EE7B7', icon: '#6EE7B7' }
        : { bg: '#10B981', text: '#FFFFFF', icon: '#FFFFFF' };
    default:
      return isDark
        ? { bg: '#064E3B', text: '#6EE7B7', icon: '#6EE7B7' }
        : { bg: '#10B981', text: '#FFFFFF', icon: '#FFFFFF' };
  }
}

export function NetworkBanner() {
  const { colorScheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { network, pendingCount, isSyncing, triggerSync, setBannerVisible } = useNetworkContext();
  const [bannerState, setBannerState] = useState<BannerState>('idle');
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevStateRef = useRef<BannerState>('idle');

  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isSyncing) {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
      if (prevStateRef.current !== 'syncing') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      prevStateRef.current = 'syncing';
      setBannerState('syncing');
      return;
    }

    if (!network.isOnline) {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
      if (prevStateRef.current !== 'offline') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      prevStateRef.current = 'offline';
      setBannerState('offline');
      return;
    }

    if (bannerState === 'offline') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      prevStateRef.current = 'restored';
      setBannerState('restored');
      dismissTimerRef.current = setTimeout(() => {
        setBannerState('idle');
        prevStateRef.current = 'idle';
        dismissTimerRef.current = null;
      }, 3000);
    }

    if (bannerState === 'syncing' && !isSyncing) {
      prevStateRef.current = 'idle';
      setBannerState('idle');
    }
  }, [network.isOnline, isSyncing, bannerState]);

  useEffect(() => {
    const unsub = onSyncComplete((result) => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
      if (result.synced > 0 || result.errors.length === 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        prevStateRef.current = 'synced';
        setBannerState('synced');
      } else {
        prevStateRef.current = 'idle';
        setBannerState('idle');
      }
      dismissTimerRef.current = setTimeout(() => {
        setBannerState('idle');
        prevStateRef.current = 'idle';
        dismissTimerRef.current = null;
      }, 3000);
    });
    return unsub;
  }, []);

  useEffect(() => {
    setBannerVisible(bannerState !== 'idle');
  }, [bannerState, setBannerVisible]);

  const handleRetry = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    triggerSync();
  }, [triggerSync]);

  if (bannerState === 'idle') return null;

  const getBannerConfig = () => {
    switch (bannerState) {
      case 'offline':
        return {
          icon: 'cloud-offline-outline' as const,
          text: 'Sin conexión a internet',
          showRetry: true,
          showSpinner: false,
        };
      case 'syncing':
        return {
          icon: 'sync-outline' as const,
          text: `Sincronizando ${pendingCount} operación${pendingCount !== 1 ? 'es' : ''}...`,
          showRetry: false,
          showSpinner: true,
        };
      case 'synced':
        return {
          icon: 'checkmark-circle-outline' as const,
          text: 'Sincronización completada',
          showRetry: false,
          showSpinner: false,
        };
      case 'restored':
        return {
          icon: 'wifi-outline' as const,
          text: 'Conexión restaurada',
          showRetry: false,
          showSpinner: false,
        };
      default:
        return {
          icon: 'wifi-outline' as const,
          text: '',
          showRetry: false,
          showSpinner: false,
        };
    }
  };

  const config = getBannerConfig();
  const bannerColors = getBannerColors(bannerState, colorScheme);

  return (
    <Animated.View
      entering={SlideInDown.duration(300).springify()}
      exiting={SlideOutUp.duration(200)}
      style={[styles.banner, { backgroundColor: bannerColors.bg, paddingTop: insets.top }, Shadows.md]}
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel={config.text}
    >
      <View style={styles.bannerContent}>
        {config.showSpinner ? (
          <ActivityIndicator
            size="small"
            color={bannerColors.icon}
            style={styles.spinner}
            accessibilityLabel="Sincronizando"
          />
        ) : (
          <Ionicons name={config.icon} size={scale(16)} color={bannerColors.icon} />
        )}
        <Text style={[styles.text, { color: bannerColors.text }]}>{config.text}</Text>
        {config.showRetry && (
          <TouchableOpacity
            onPress={handleRetry}
            style={[styles.retryButton, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
            accessibilityRole="button"
            accessibilityLabel="Reintentar conexión"
          >
            <Ionicons name="refresh-outline" size={scale(14)} color={bannerColors.text} />
            <Text style={[styles.retryText, { color: bannerColors.text }]}>Reintentar</Text>
          </TouchableOpacity>
        )}
      </View>
      {bannerState === 'syncing' && <ProgressBar color={bannerColors.text} />}
    </Animated.View>
  );
}

function ProgressBar({ color }: { color: string }) {
  const translateX = useSharedValue(-120);

  useEffect(() => {
    translateX.value = withRepeat(
      withTiming(300, { duration: 1200 }),
      -1,
      false,
    );
  }, [translateX]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={styles.progressTrack}>
      <Animated.View
        style={[styles.progressBar, { backgroundColor: color }, animatedStyle]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    overflow: 'hidden',
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.md,
  },
  text: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    flexShrink: 1,
  },
  spinner: {
    width: scale(16),
    height: scale(16),
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  retryText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  progressTrack: {
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    width: 100,
    borderRadius: 1,
  },
});
