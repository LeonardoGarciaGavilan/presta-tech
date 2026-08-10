import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { ComponentProps } from 'react';

import { FontSize, FontWeight, scale, Spacing } from '@/constants/theme';
import { useTheme } from '@/components/ui/theme-provider';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

interface SinAccesoProps {
  title?: string;
  subtitle?: string;
  icon?: IoniconName;
}

export default function SinAcceso({
  title = 'Sin acceso',
  subtitle = 'No tienes permisos para ver esta sección. Contacta al administrador de tu empresa.',
  icon = 'lock-closed-outline',
}: SinAccesoProps) {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Ionicons
        name={icon}
        size={scale(64)}
        color={colors.textTertiary}
        accessibilityRole="image"
        accessibilityLabel={title}
      />
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        {title}
      </Text>
      <Text accessibilityRole="text" style={[styles.subtitle, { color: colors.textTertiary }]}>
        {subtitle}
      </Text>
      <TouchableOpacity
        onPress={() => router.back()}
        activeOpacity={0.7}
        style={[styles.back, { backgroundColor: colors.primaryLight }]}
      >
        <Ionicons name="arrow-back-outline" size={scale(18)} color={colors.primary} />
        <Text style={[styles.backText, { color: colors.primary }]}>Volver</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
  subtitle: {
    fontSize: FontSize.md,
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: scale(22),
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 999,
  },
  backText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
});
