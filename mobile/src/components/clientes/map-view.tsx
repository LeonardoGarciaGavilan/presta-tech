import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, {
  Marker,
  Polyline,
  UrlTile,
  type LatLng,
  type MapPressEvent,
  type Region,
} from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

import { BorderRadius, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { useTheme } from '@/components/ui/theme-provider';

const DEFAULT_REGION: Region = {
  latitude: 18.74,
  longitude: -70.16,
  latitudeDelta: 8,
  longitudeDelta: 8,
};

const ZOOM_REGION: Region = {
  latitude: 18.74,
  longitude: -70.16,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

const MARKER_COLORS = {
  default: '#2563EB',
  visited: '#16A34A',
  overdue: '#DC2626',
  goldBorder: '#FBBF24',
} as const;

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
  const mapRef = useRef<MapView>(null);
  const hasSingleCoord = latitude != null && longitude != null;
  const hasMultiple = markers != null && markers.length > 0;
  const hasAnyCoords = hasSingleCoord || hasMultiple;
  const [gpsLoading, setGpsLoading] = useState(false);

  const allCoords: LatLng[] = hasMultiple
    ? markers.filter((m) => m.latitude != null && m.longitude != null).map((m) => ({ latitude: m.latitude, longitude: m.longitude }))
    : hasSingleCoord
      ? [{ latitude, longitude } as LatLng]
      : [];

  const coordsKey = hasMultiple
    ? (markers ?? []).map((m) => `${m.latitude},${m.longitude}`).join('|')
    : `${latitude},${longitude}`;

  const computedInitialRegion: Region =
    hasSingleCoord && !hasMultiple
      ? {
          latitude: latitude!,
          longitude: longitude!,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }
      : DEFAULT_REGION;

  useEffect(() => {
    if (allCoords.length === 0 || !mapRef.current) return;
    const timeout = setTimeout(() => {
      if (fitToMarkers && allCoords.length > 1) {
        mapRef.current?.fitToCoordinates(allCoords, {
          edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
          animated: true,
        });
      } else if (allCoords.length === 1) {
        const coord = allCoords[0];
        mapRef.current?.animateToRegion(
          {
            latitude: coord.latitude,
            longitude: coord.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          },
          500,
        );
      }
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitToMarkers, coordsKey]);

  const handleMapPress = useCallback(
    (e: MapPressEvent) => {
      if (readOnly) return;
      const { coordinate } = e.nativeEvent;
      onCoordsChange?.(coordinate.latitude, coordinate.longitude);
    },
    [readOnly, onCoordsChange],
  );

  const handleMarkerDragEnd = useCallback(
    (e: { nativeEvent: { coordinate: LatLng } }) => {
      if (readOnly) return;
      const { coordinate } = e.nativeEvent;
      onCoordsChange?.(coordinate.latitude, coordinate.longitude);
    },
    [readOnly, onCoordsChange],
  );

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

      mapRef.current?.animateToRegion(
        {
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        500,
      );
    } catch {
      // Silently fail
    } finally {
      setGpsLoading(false);
    }
  }, [onCoordsChange]);

  const handleClear = useCallback(() => {
    onCoordsChange?.(null, null);
  }, [onCoordsChange]);

  const getMarkerColor = (m: MapViewMarker): string => {
    if (m.isVisited) return MARKER_COLORS.visited;
    if (m.isOverdue) return MARKER_COLORS.overdue;
    return m.color ?? MARKER_COLORS.default;
  };

  const renderSingleMarker = () => {
    if (!hasSingleCoord) return null;
    return (
      <Marker
        coordinate={{ latitude: latitude!, longitude: longitude! }}
        draggable={!readOnly}
        onDragEnd={handleMarkerDragEnd}
        pinColor={readOnly ? undefined : MARKER_COLORS.default}
        title={readOnly ? undefined : 'Arrastra para ajustar'}
      />
    );
  };

  const renderMultipleMarkers = () => {
    if (!hasMultiple) return null;
    const validMarkers = markers.filter((m) => m.latitude != null && m.longitude != null);
    return (
      <>
        {showPolyline && validMarkers.length > 1 && (
          <Polyline
            coordinates={validMarkers.map((m) => ({
              latitude: m.latitude,
              longitude: m.longitude,
            }))}
            strokeColor={colors.primary}
            strokeWidth={3}
            lineDashPattern={[8, 10]}
          />
        )}
        {validMarkers.map((m, idx) => (
          <Marker
            key={m.id}
            coordinate={{ latitude: m.latitude, longitude: m.longitude }}
            pinColor={getMarkerColor(m)}
            title={m.title}
            description={m.description}
            onPress={() => onMarkerPress?.(m)}
          >
            {m.order != null && (
              <View style={[styles.orderBadge, { backgroundColor: getMarkerColor(m) }]}>
                <Text style={styles.orderText}>{m.order}</Text>
              </View>
            )}
          </Marker>
        ))}
      </>
    );
  };

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.mapContainer,
          { height, borderColor: colors.border },
        ]}
      >
        {readOnly && !hasAnyCoords ? (
          <View style={[styles.emptyState, { backgroundColor: colors.surface }]}>
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
              📍 Sin coordenadas
            </Text>
          </View>
        ) : (
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={computedInitialRegion}
            onPress={handleMapPress}
            showsCompass={false}
            showsScale={false}
            toolbarEnabled={false}
            moveOnMarkerPress={false}
          >
            <UrlTile
              urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              maximumZ={19}
              tileSize={256}
            />
            {hasMultiple ? renderMultipleMarkers() : renderSingleMarker()}
          </MapView>
        )}
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
                {Number(latitude).toFixed(6)}, {Number(longitude).toFixed(6)}
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
  map: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    textAlign: 'center',
    paddingHorizontal: Spacing.md,
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
  orderBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  orderText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: FontWeight.bold,
  },
});
