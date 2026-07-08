import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

import { BorderRadius, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { useTheme } from '@/components/ui/theme-provider';

// NOTE: MapView requires Google Maps API key on Android for production builds.
// To enable the map: add android.config.googleMaps.apiKey in app.json,
// then uncomment the MapView section below and remove this placeholder.

// import MapView, { Marker, Polyline, UrlTile, type LatLng, type MapPressEvent, type Region } from 'react-native-maps';

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
  markers,
  readOnly = true,
  height = 200,
  showPolyline = false,
  fitToMarkers = false,
  onCoordsChange,
  onMarkerPress,
}: MapViewProps) {
  const { colorScheme, colors } = useTheme();
  const hasSingleCoord = latitude != null && longitude != null;
  const hasMultiple = markers != null && markers.length > 0;
  const hasAnyCoords = hasSingleCoord || hasMultiple;
  const [gpsLoading, setGpsLoading] = useState(false);
  const coordsLabel = hasSingleCoord
    ? `${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}`
    : hasMultiple
      ? `${markers.length} ubicaciones`
      : null;

  const handleGetCurrentLocation = useCallback(async () => {
    try {
      setGpsLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude: lat, longitude: lng } = location.coords;
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

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.mapContainer,
          { height, borderColor: colors.border },
        ]}
      >
        <View style={[styles.placeholder, { backgroundColor: colors.surface }]}>
          <Ionicons name="map-outline" size={32} color={colors.textTertiary} />
          <Text style={[styles.placeholderTitle, { color: colors.textSecondary }]}>
            Mapa no disponible
          </Text>
          <Text style={[styles.placeholderSub, { color: colors.textTertiary }]}>
            {hasAnyCoords
              ? coordsLabel
              : 'Sin coordenadas registradas'}
          </Text>
          <Text style={[styles.placeholderHint, { color: colors.textTertiary }]}>
            Configura Google Maps API para habilitar el mapa
          </Text>
        </View>
      </View>

      {hasSingleCoord && !readOnly && (
        <View style={[styles.coordsBar, { backgroundColor: colors.successLight, borderColor: colors.success }]}>
          <View style={styles.coordsBarLeft}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <View>
              <Text style={[styles.coordsBarTitle, { color: colors.success }]}>
                Ubicación guardada
              </Text>
              <Text style={[styles.coordsBarValue, { color: colors.textSecondary }]}>
                {coordsLabel}
              </Text>
            </View>
          </View>
          <Pressable onPress={handleClear} hitSlop={8}>
            <Ionicons name="close-circle" size={20} color={colors.error} />
          </Pressable>
        </View>
      )}

      {!readOnly && (
        <Pressable
          style={[styles.gpsBtn, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
          onPress={handleGetCurrentLocation}
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: Spacing.sm,
  },
  mapContainer: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
  placeholderTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  placeholderSub: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    textAlign: 'center',
  },
  placeholderHint: {
    fontSize: FontSize.xs,
    textAlign: 'center',
    marginTop: Spacing.xs,
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
});
