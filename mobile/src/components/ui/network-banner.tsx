import { useEffect, useState, useCallback, useRef } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { FontSize, FontWeight, Spacing, scale } from '@/constants/theme';
import { useTheme } from '@/components/ui/theme-provider';
import { useNetworkContext } from '@/components/providers/network-provider';
import { onSyncComplete } from '@/services/sync-manager';

type BannerState = 'idle' | 'offline' | 'syncing' | 'synced' | 'restored';

export function NetworkBanner() {
  const { colors } = useTheme();
  const { network, pendingCount, isSyncing, triggerSync } = useNetworkContext();
  const [bannerState, setBannerState] = useState<BannerState>('idle');
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setBannerState('syncing');
      return;
    }

    if (!network.isOnline) {
      setBannerState('offline');
      return;
    }

    if (bannerState === 'offline') {
      setBannerState('restored');
      dismissTimerRef.current = setTimeout(() => {
        setBannerState('idle');
        dismissTimerRef.current = null;
      }, 3000);
      return () => {
        if (dismissTimerRef.current) {
          clearTimeout(dismissTimerRef.current);
          dismissTimerRef.current = null;
        }
      };
    }

    if (bannerState === 'syncing' && !isSyncing) {
      setBannerState('idle');
    }
  }, [network.isOnline, isSyncing, bannerState]);

  useEffect(() => {
    const unsub = onSyncComplete((result) => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
      if (result.synced > 0 || result.errors.length === 0) {
        setBannerState('synced');
      } else {
        setBannerState('idle');
      }
      dismissTimerRef.current = setTimeout(() => {
        setBannerState('idle');
        dismissTimerRef.current = null;
      }, 3000);
    });
    return unsub;
  }, []);

  const handleRetry = useCallback(() => {
    triggerSync();
  }, [triggerSync]);

  if (bannerState === 'idle') return null;

  const getBannerConfig = () => {
    switch (bannerState) {
      case 'offline':
        return {
          backgroundColor: '#EF4444',
          icon: 'cloud-offline-outline' as const,
          text: 'Sin conexión a internet',
          showRetry: true,
          showSpinner: false,
        };
      case 'syncing':
        return {
          backgroundColor: '#F59E0B',
          icon: 'sync-outline' as const,
          text: `Sincronizando ${pendingCount} operación${pendingCount !== 1 ? 'es' : ''}...`,
          showRetry: false,
          showSpinner: true,
        };
      case 'synced':
        return {
          backgroundColor: '#10B981',
          icon: 'checkmark-circle-outline' as const,
          text: 'Sincronización completada',
          showRetry: false,
          showSpinner: false,
        };
      case 'restored':
        return {
          backgroundColor: '#10B981',
          icon: 'wifi-outline' as const,
          text: 'Conexión restaurada',
          showRetry: false,
          showSpinner: false,
        };
      default:
        return {
          backgroundColor: '#10B981',
          icon: 'wifi-outline' as const,
          text: '',
          showRetry: false,
          showSpinner: false,
        };
    }
  };

  const config = getBannerConfig();

  return (
    <View
      style={[styles.banner, { backgroundColor: config.backgroundColor }]}
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel={config.text}
    >
      {config.showSpinner ? (
        <ActivityIndicator
          size="small"
          color="#FFFFFF"
          style={styles.spinner}
          accessibilityLabel="Sincronizando"
        />
      ) : (
        <Ionicons name={config.icon} size={scale(16)} color="#FFFFFF" />
      )}
      <Text style={styles.text}>{config.text}</Text>
      {config.showRetry && (
        <TouchableOpacity
          onPress={handleRetry}
          style={styles.retryButton}
          accessibilityRole="button"
          accessibilityLabel="Reintentar conexión"
        >
          <Text style={styles.retryText}>Reintentar</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
  text: {
    color: '#FFFFFF',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  spinner: {
    width: scale(16),
    height: scale(16),
  },
  retryButton: {
    marginLeft: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
});
