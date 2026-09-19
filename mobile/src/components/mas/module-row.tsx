import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { BorderRadius, FontSize, FontWeight, Spacing, scale } from '@/constants/theme';
import type { ModuloItem } from '@/components/mas/modulos.data';
import { useTheme } from '@/components/ui/theme-provider';

export function ModuleRow({ module, badge }: { module: ModuloItem; badge?: number }) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={[
        styles.row,
        { backgroundColor: colors.card, borderColor: colors.borderLight },
      ]}
      activeOpacity={0.6}
      onPress={() => router.push(module.route as never)}
      accessibilityRole="button"
      accessibilityLabel={module.label}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors[module.bgKey] }]}>
        <Ionicons name={module.icon} size={scale(20)} color={colors[module.colorKey]} />
      </View>
      <View style={styles.textBlock}>
        <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
          {module.label}
        </Text>
        <Text style={[styles.sublabel, { color: colors.textTertiary }]} numberOfLines={1}>
          {module.sublabel ?? ''}
        </Text>
      </View>
      {badge != null && badge > 0 ? (
        <View style={[styles.badge, { backgroundColor: colors.error }]}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={scale(18)} color={colors.textTertiary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  iconWrap: {
    width: scale(36),
    height: scale(36),
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  sublabel: {
    fontSize: scale(10),
    marginTop: scale(1),
  },
  badge: {
    borderRadius: scale(8),
    minWidth: scale(20),
    height: scale(18),
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(5),
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: scale(10),
    fontWeight: FontWeight.bold,
  },
});