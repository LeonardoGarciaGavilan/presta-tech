import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OSMView, TILE_CONFIGS } from 'expo-osm-sdk';
import type { OSMViewRef, MarkerConfig, PolylineConfig, Coordinate } from 'expo-osm-sdk';
import * as Location from 'expo-location';

import { BorderRadius, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { useTheme } from '@/components/ui/theme-provider';

export interface MapViewMarker {
  id: string;
  latitude: number;
  longitude: number;
  title?: string;
  description?: string;
  order?: number;
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
  userLocation?: Coordinate;
  onCoordsChange?: (lat: number | null, lng: number | null) => void;
  onMarkerPress?: (marker: MapViewMarker) => void;
}

const DOMINICAN_REPUBLIC: Coordinate = { latitude: 18.7357, longitude: -70.1600 };

function getMarkerIcon(marker: MapViewMarker): { name: string; color: string } {
  if (marker.isVisited) return { name: 'pin', color: '#16A34A' };
  if (marker.isOverdue) return { name: 'pin', color: '#EA580C' };
  return { name: 'pin', color: '#DC2626' };
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
  userLocation,
  onCoordsChange,
  onMarkerPress,
}: MapViewProps) {
  const { colorScheme, colors } = useTheme();
  const mapRef = useRef<OSMViewRef>(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  const hasSingleCoord = latitude != null && longitude != null;
  const hasMultiple = markers != null && markers.length > 0;
  const hasAnyCoords = hasSingleCoord || hasMultiple;

  const coordsLabel = hasSingleCoord
    ? `${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}`
    : hasMultiple
      ? `${markers.length} ubicaciones`
      : null;

  const center = useMemo((): Coordinate => {
    if (hasSingleCoord) return { latitude: latitude!, longitude: longitude! };
    if (hasMultiple && markers!.length > 0) {
      const avgLat = markers!.reduce((s, m) => s + m.latitude, 0) / markers!.length;
      const avgLng = markers!.reduce((s, m) => s + m.longitude, 0) / markers!.length;
      return { latitude: avgLat, longitude: avgLng };
    }
    if (userLocation) return userLocation;
    return DOMINICAN_REPUBLIC;
  }, [hasSingleCoord, longitude, latitude, hasMultiple, markers, userLocation]);

  const initialZoom = useMemo(() => {
    if (hasSingleCoord) return 16;
    if (hasMultiple && markers!.length > 1) return 13;
    return 12;
  }, [hasSingleCoord, hasMultiple, markers]);

  const tileStyleUrl = useMemo(
    () => (colorScheme === 'dark' ? TILE_CONFIGS.openfreemapDark.styleUrl : TILE_CONFIGS.openfreemapLiberty.styleUrl),
    [colorScheme],
  );

  const mapMarkers: MarkerConfig[] = useMemo(() => {
    const result: MarkerConfig[] = [];

    if (hasSingleCoord && readOnly) {
      result.push({
        id: 'client-location',
        coordinate: { latitude: latitude!, longitude: longitude! },
        title: 'Ubicación del cliente',
        icon: { name: 'pin', color: colors.primary },
      });
    } else if (hasSingleCoord && !readOnly) {
      result.push({
        id: 'selected-location',
        coordinate: { latitude: latitude!, longitude: longitude! },
        title: 'Ubicación seleccionada',
        icon: { name: 'pin', color: colors.primary },
        draggable: true,
      });
    } else if (hasMultiple) {
      result.push(
        ...markers!.map((m) => ({
          id: m.id,
          coordinate: { latitude: m.latitude, longitude: m.longitude },
          title: m.title || (m.order != null ? `#${m.order}` : undefined),
          description: m.description,
          icon: getMarkerIcon(m),
        })),
      );
    }

    if (userLocation) {
      result.push({
        id: 'user-location',
        coordinate: userLocation,
        title: 'Tu ubicación',
        icon: { name: 'star', color: '#7C3AED' },
        zIndex: 999,
      });
    }

    return result;
  }, [hasSingleCoord, readOnly, longitude, latitude, hasMultiple, markers, colors.primary, userLocation]);

  const polylineData: PolylineConfig[] = useMemo(() => {
    if (!showPolyline || !hasMultiple || !markers) return [];
    return [
      {
        id: 'route-line',
        coordinates: markers.map((m) => ({ latitude: m.latitude, longitude: m.longitude })),
        strokeColor: colors.primary,
        strokeWidth: 3,
      },
    ];
  }, [showPolyline, hasMultiple, markers, colors.primary]);

  useEffect(() => {
    if (!fitToMarkers || !markers || markers.length < 2) return;
    const coords = markers.map((m) => ({ latitude: m.latitude, longitude: m.longitude }));
    mapRef.current?.fitRouteInView(coords);
  }, [fitToMarkers, markers]);

  const handleGetCurrentLocation = useCallback(async () => {
    try {
      setGpsLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      onCoordsChange?.(location.coords.latitude, location.coords.longitude);
    } catch {
      // Silently fail
    } finally {
      setGpsLoading(false);
    }
  }, [onCoordsChange]);

  const handleClear = useCallback(() => {
    onCoordsChange?.(null, null);
  }, [onCoordsChange]);

  const handleMapPress = useCallback(
    (coord: Coordinate) => {
      if (readOnly) return;
      onCoordsChange?.(coord.latitude, coord.longitude);
    },
    [readOnly, onCoordsChange],
  );

  const handleMarkerPress = useCallback(
    (markerId: string) => {
      if (!markers || !onMarkerPress) return;
      const found = markers.find((m) => m.id === markerId);
      if (found) onMarkerPress(found);
    },
    [markers, onMarkerPress],
  );

  return (
    <View style={styles.wrapper}>
      <View style={[styles.mapContainer, height > 0 ? { height } : styles.mapContainerFlex, { borderColor: colors.border }]}>
        <OSMView
          ref={mapRef}
          style={styles.map}
          initialCenter={center}
          initialZoom={initialZoom}
          styleUrl={tileStyleUrl}
          markers={mapMarkers}
          polylines={polylineData}
          showUserLocation={false}
          onPress={handleMapPress}
          onMarkerPress={handleMarkerPress}
          scrollEnabled
          zoomEnabled
          rotateEnabled={false}
          pitchEnabled={false}
          showsCompass={false}
          showsZoomControls={false}
        />
      </View>

      {coordsAproximadas != null && hasAnyCoords && (
        <View
          style={[
            styles.badge,
            {
              backgroundColor: coordsAproximadas ? colors.warningLight : colors.successLight,
              borderColor: coordsAproximadas ? colors.warning : colors.success,
            },
          ]}
        >
          <View
            style={[
              styles.badgeDot,
              { backgroundColor: coordsAproximadas ? colors.warning : colors.success },
            ]}
          />
          <Text
            style={[
              styles.badgeText,
              { color: coordsAproximadas ? colors.warning : colors.success },
            ]}
          >
            {coordsAproximadas ? 'Aproximada' : 'Exacta'}
          </Text>
        </View>
      )}

      {hasSingleCoord && !readOnly && (
        <View
          style={[
            styles.coordsBar,
            { backgroundColor: colors.successLight, borderColor: colors.success },
          ]}
        >
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
        <View style={styles.actions}>
          <Pressable
            style={[
              styles.gpsBtn,
              { backgroundColor: colors.primaryLight, borderColor: colors.primary },
            ]}
            onPress={handleGetCurrentLocation}
            disabled={gpsLoading}
          >
            {gpsLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="locate-outline" size={16} color={colors.primary} />
            )}
            <Text style={[styles.gpsBtnText, { color: colors.primary }]}>
              {gpsLoading ? 'Obteniendo ubicación...' : 'Usar mi ubicación'}
            </Text>
          </Pressable>
          <Text style={[styles.tapHint, { color: colors.textTertiary }]}>
            Toca el mapa para colocar un marcador
          </Text>
        </View>
      )}

      {hasAnyCoords && (
        <Text style={[styles.attribution, { color: colors.textTertiary }]}>
          Mapa: OpenStreetMap · OpenFreeMap
        </Text>
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
  mapContainerFlex: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  badge: {
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
  badgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
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
  actions: {
    gap: Spacing.xs,
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
  tapHint: {
    fontSize: FontSize.xs,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  attribution: {
    fontSize: 10,
    textAlign: 'right',
    fontStyle: 'italic',
  },
});
