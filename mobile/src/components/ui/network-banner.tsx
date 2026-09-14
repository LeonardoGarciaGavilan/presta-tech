import { useEffect, useState, useCallback, useRef } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
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

// En el arranque en frío la app parte asumiendo OFFLINE (por diseño, para no
// perder dinero: sin evidencia real de red, una mutación se encola). Si el
// banner tratara ese default como una desconexión, cada vez que se abre la app
// saltaría un falso "Sin conexión → Conexión restaurada" con vibración. Con
// `null` (en vez de 'idle') marcamos que aún no hay un estado de red real: el
// primer evento de NetInfo se toma como línea base sin disparar transiciones.
type PrevState = BannerState | 'online' | null;

function getBannerColors(
  state: BannerState,
  colors: ReturnType<typeof useTheme>['colors'],
) {
  const isDark = colors.background !== '#FFFFFF';
  switch (state) {
    case 'offline':
      return isDark
        ? { bg: colors.errorLight, text: colors.error, icon: colors.error }
        : { bg: colors.error, text: '#FFFFFF', icon: '#FFFFFF' };
    case 'syncing':
      return isDark
        ? { bg: colors.warningLight, text: colors.warning, icon: colors.warning }
        : { bg: colors.warning, text: '#FFFFFF', icon: '#FFFFFF' };
    case 'synced':
    case 'restored':
    default:
      return isDark
        ? { bg: colors.successLight, text: colors.success, icon: colors.success }
        : { bg: colors.success, text: '#FFFFFF', icon: '#FFFFFF' };
  }
}

export function NetworkBanner() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { network, pendingCount, isSyncing, triggerSync, setBannerVisible } = useNetworkContext();
  const [bannerState, setBannerState] = useState<BannerState>('idle');
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevStateRef = useRef<PrevState>(null);
  const bannerOffset = useSharedValue(-100);
  const bannerOpacity = useSharedValue(0);

  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Primer estado de red real: lo tomamos como línea base SIN disparar la
    // falsa transición "offline default → online" del arranque en frío. En el
    // arranque la app parte asumiendo offline por diseño (para no perder
    // dinero), así que pasar a online aquí NO es una reconexión real: no hay
    // vibración ni banner "Conexión restaurada". Si la primera lectura real trae
    // online, no se muestra nada; si trae offline, la barra sí se muestra (el
    // usuario abrió la app sin conexión).
    if (prevStateRef.current === null) {
      prevStateRef.current = network.isOnline ? 'online' : 'offline';
      if (isSyncing) {
        setBannerState('syncing');
      } else if (!network.isOnline) {
        setBannerState('offline');
      }
      return;
    }

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
      prevStateRef.current = 'online';
      setBannerState('restored');
      dismissTimerRef.current = setTimeout(() => {
        setBannerState('idle');
        prevStateRef.current = 'online';
        dismissTimerRef.current = null;
      }, 3000);
    }

    if (bannerState === 'syncing' && !isSyncing) {
      prevStateRef.current = 'online';
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

  // Animación de entrada controlada por shared values al montar: el nodo se
  // desmonta cuando no hay banner (return null abajo), así la entrada siempre se
  // ejecuta sin depender de la persistencia del nodo ni ocupar espacio en idle.
  useEffect(() => {
    bannerOffset.value = withTiming(0, { duration: 120 });
    bannerOpacity.value = withTiming(1, { duration: 180 });
  }, [bannerOffset, bannerOpacity]);

  const bannerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bannerOffset.value }],
    opacity: bannerOpacity.value,
  }));

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
  const bannerColors = getBannerColors(bannerState, colors);

  return (
    <Animated.View
      style={[styles.banner, bannerStyle, { backgroundColor: getBannerColors(bannerState, colors).bg, paddingTop: insets.top }, Shadows.md]}
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
            style={[styles.retryButton, { backgroundColor: bannerColors.text + '26' }]}
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
