import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';

import { BorderRadius, FontSize, FontWeight, Spacing, scale} from '@/constants/theme';
import { useTheme } from '@/components/ui/theme-provider';

interface LocationViewProps {
  latitud: number | null;
  longitud: number | null;
  coordsAproximadas?: boolean;
}

export default function LocationView({
  latitud,
  longitud,
  coordsAproximadas,
}: LocationViewProps) {
  const { colorScheme, colors } = useTheme();
  const [copied, setCopied] = useState(false);

  if (!latitud || !longitud) return null;

  const handleOpenMaps = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${latitud},${longitud}`;
    Linking.openURL(url);
  };

  const handleCopyCoords = async () => {
    const coords = `${latitud?.toFixed(5)}, ${longitud?.toFixed(5)}`;
    try {
      await Clipboard.setStringAsync(coords);
    } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.coordsRow}>
        <Ionicons name="location-sharp" size={scale(16)} color={colors.primary} />
        <Text style={[styles.coords, { color: colors.text }]}>
          {latitud.toFixed(5)}, {longitud.toFixed(5)}
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={handleOpenMaps}
          style={[
            styles.actionBtn,
            {
              backgroundColor: colors.primaryLight,
              borderColor: colors.primary,
            },
          ]}
        >
          <Ionicons name="navigate" size={scale(16)} color={colors.primary} />
          <Text style={[styles.actionText, { color: colors.primary }]}>
            Google Maps
          </Text>
        </Pressable>

        <Pressable
          onPress={handleCopyCoords}
          style={[
            styles.actionBtn,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Ionicons
            name={copied ? 'checkmark' : 'copy-outline'}
            size={scale(16)}
            color={copied ? colors.success : colors.textSecondary}
          />
          <Text
            style={[
              styles.actionText,
              { color: copied ? colors.success : colors.textSecondary },
            ]}
          >
            {copied ? 'Copiado' : 'Copiar'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
  },
  coordsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  coords: {
    fontSize: FontSize.sm,
    fontFamily: 'monospace',
    fontWeight: FontWeight.medium,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(6),
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  actionText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
});
