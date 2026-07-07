import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { BorderRadius, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { useTheme } from '@/components/ui/theme-provider';

export interface MapViewMarker {
  id: string;
  latitude: number;
  longitude: number;
  title?: string;
  description?: string;
  order?: number;
  color?: string;
  coordsAproximadas?: boolean;
  isVisited?: boolean;
  isOverdue?: boolean;
}

interface MapViewProps {
  latitude?: number | null;
  longitude?: number | null;
  coordsAproximadas?: boolean;
  markers?: MapViewMarker[];
  readOnly?: boolean;
  height?: number;
  showPolyline?: boolean;
  fitToMarkers?: boolean;
  onCoordsChange?: (lat: number | null, lng: number | null) => void;
  onMarkerPress?: (marker: MapViewMarker) => void;
}

export default function AppMapView({
  latitude,
  longitude,
  coordsAproximadas,
  readOnly = true,
  height = 200,
  onCoordsChange,
}: MapViewProps) {
  const { colorScheme, colors } = useTheme();
  const hasCoords = latitude != null && longitude != null;
  const [gpsLoading, setGpsLoading] = useState(false);

  const handleGps = useCallback(async () => {
    if (!navigator.geolocation) return;
    setGpsLoading(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
        }),
      );
      const { latitude: lat, longitude: lng } = pos.coords;
      onCoordsChange?.(lat, lng);
    } catch {
      // Silently fail
    } finally {
      setGpsLoading(false);
    }
  }, [onCoordsChange]);

  const handleClear = useCallback(() => {
    onCoordsChange?.(null, null);
  }, [onCoordsChange]);

  const handleOpenMaps = useCallback(() => {
    if (!hasCoords) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
    Linking.openURL(url);
  }, [latitude, longitude, hasCoords]);

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.placeholder,
          { height, borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        <View style={styles.placeholderContent}>
          <Text style={styles.placeholderIcon}>🗺️</Text>
          <Text style={[styles.placeholderTitle, { color: colors.textSecondary }]}>
            Mapa no disponible
          </Text>
          <Text style={[styles.placeholderSubtitle, { color: colors.textTertiary }]}>
            El mapa interactivo solo está disponible en dispositivos móviles
          </Text>

          {hasCoords && (
            <View style={[styles.coordsChip, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
              <Ionicons name="location-sharp" size={14} color={colors.primary} />
              <Text style={[styles.coordsText, { color: colors.primary }]}>
                {Number(latitude).toFixed(5)}, {Number(longitude).toFixed(5)}
              </Text>
            </View>
          )}

          {hasCoords && (
            <Pressable
              onPress={handleOpenMaps}
              style={[styles.openMapsBtn, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
            >
              <Ionicons name="navigate" size={16} color={colors.primary} />
              <Text style={[styles.openMapsText, { color: colors.primary }]}>
                Abrir en Google Maps
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {coordsAproximadas != null && hasCoords && (
        <View style={[styles.badgeRow, { backgroundColor: coordsAproximadas ? colors.warningLight : colors.successLight, borderColor: coordsAproximadas ? colors.warning : colors.success }]}>
          <View style={[styles.badgeDot, { backgroundColor: coordsAproximadas ? colors.warning : colors.success }]} />
          <Text style={[styles.badgeLabel, { color: coordsAproximadas ? colors.warning : colors.success }]}>
            {coordsAproximadas ? 'Aproximada' : 'Exacta'}
          </Text>
        </View>
      )}

      {!readOnly && (
        <Pressable
          style={[styles.gpsBtn, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
          onPress={handleGps}
          disabled={gpsLoading}
        >
          {gpsLoading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="locate-outline" size={16} color={colors.primary} />
          )}
          <Text style={[styles.gpsBtnText, { color: colors.primary }]}>
            {gpsLoading ? 'Obteniendo ubicación...' : '📍 Usar mi ubicación'}
          </Text>
        </Pressable>
      )}

      {hasCoords && !readOnly && (
        <View style={[styles.coordsBar, { backgroundColor: colors.successLight, borderColor: colors.success }]}>
          <View style={styles.coordsBarLeft}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <View>
              <Text style={[styles.coordsBarTitle, { color: colors.success }]}>Ubicación guardada</Text>
              <Text style={[styles.coordsBarValue, { color: colors.textSecondary }]}>
                {Number(latitude).toFixed(6)}, {Number(longitude).toFixed(6)}
              </Text>
            </View>
          </View>
          <Pressable onPress={handleClear} hitSlop={8}>
            <Ionicons name="close-circle" size={20} color={colors.error} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: Spacing.sm,
  },
  placeholder: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  placeholderContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  placeholderIcon: {
    fontSize: 32,
  },
  placeholderTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  placeholderSubtitle: {
    fontSize: FontSize.xs,
    textAlign: 'center',
    lineHeight: 18,
  },
  coordsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  coordsText: {
    fontSize: FontSize.xs,
    fontFamily: 'monospace',
    fontWeight: FontWeight.medium,
  },
  openMapsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  openMapsText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingVertical: Spacing.sm,
  },
  gpsBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  coordsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  coordsBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  coordsBarTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  coordsBarValue: {
    fontSize: 10,
    fontFamily: 'monospace',
    marginTop: 1,
  },
});
