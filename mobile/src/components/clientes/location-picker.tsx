import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

import { AppButton } from '@/components/ui/app-button';
import { BorderRadius, FontSize, FontWeight, Spacing, scale} from '@/constants/theme';
import { useTheme } from '@/components/ui/theme-provider';

interface LocationPickerProps {
  latitud: number | null;
  longitud: number | null;
  onLocationChange: (lat: number, lng: number) => void;
  error?: string | null;
}

export default function LocationPicker({
  latitud,
  longitud,
  onLocationChange,
  error,
}: LocationPickerProps) {
  const { colorScheme, colors } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  const handleGetLocation = async () => {
    try {
      setIsLoading(true);
      setLocError(null);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocError('Permiso denegado. Activa la ubicación en ajustes.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      onLocationChange(
        location.coords.latitude,
        location.coords.longitude,
      );
    } catch (err: any) {
      setLocError(err.message || 'Error al obtener ubicación');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        Ubicación en mapa
      </Text>

      <AppButton
        title={isLoading ? 'Obteniendo ubicación...' : 'Usar mi ubicación'}
        onPress={handleGetLocation}
        loading={isLoading}
        variant="outline"
        icon="location-outline"
      />

      {(locError || error) && (
        <View
          style={[
            styles.errorBox,
            { backgroundColor: colors.errorLight, borderColor: colors.error },
          ]}
        >
          <Ionicons name="alert-circle" size={scale(14)} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]}>
            {locError || error}
          </Text>
        </View>
      )}

      {latitud && longitud && (
        <View
          style={[
            styles.successBox,
            {
              backgroundColor: colors.successLight,
              borderColor: colors.success,
            },
          ]}
        >
          <Ionicons name="checkmark-circle" size={scale(16)} color={colors.success} />
          <View style={styles.successContent}>
            <Text style={[styles.successTitle, { color: colors.success }]}>
              ✓ Ubicación guardada
            </Text>
            <Text style={[styles.successCoords, { color: colors.textSecondary }]}>
              {latitud.toFixed(5)}, {longitud.toFixed(5)}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  errorText: {
    fontSize: FontSize.xs,
    flex: 1,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  successContent: {
    flex: 1,
  },
  successTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  successCoords: {
    fontSize: FontSize.xs,
    fontFamily: 'monospace',
    marginTop: scale(2),
  },
});
