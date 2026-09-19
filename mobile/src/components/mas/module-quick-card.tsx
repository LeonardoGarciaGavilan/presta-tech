import { StyleSheet, Text, TouchableOpacity, View, type DimensionValue } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { BorderRadius, FontSize, FontWeight, Spacing, scale } from '@/constants/theme';
import type { ModuloItem } from '@/components/mas/modulos.data';
import { useTheme } from '@/components/ui/theme-provider';

interface QuickCardProps {
  module: ModuloItem;
  badge?: number;
  badgeText?: string;
  badgeSuccess?: boolean;
  width: DimensionValue;
}

export function QuickCard({ module, badge, badgeText, badgeSuccess, width }: QuickCardProps) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={[styles.card, { width, backgroundColor: colors.card, borderColor: colors.borderLight }]}
      activeOpacity={0.6}
      onPress={() => router.push(module.route as never)}
      accessibilityRole="button"
      accessibilityLabel={module.label}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors[module.bgKey] }]}>
        <Ionicons name={module.icon} size={scale(24)} color={colors[module.colorKey]} />
      </View>
      <View style={styles.textBlock}>
        <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
          {module.label}
        </Text>
        {badge != null && badge > 0 ? (
          <View style={[styles.badge, { backgroundColor: colors.error }]}>
            <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        ) : badgeText ? (
          <Text
            style={[
              styles.badgeText,
              {
                color: badgeSuccess ? colors.success : colors.textTertiary,
                marginTop: scale(2),
              },
            ]}
            numberOfLines={1}
          >
            {badgeText}
          </Text>
        ) : (
          <Text style={[styles.sublabel, { color: colors.textTertiary }]} numberOfLines={1}>
            {module.sublabel ?? ''}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconWrap: {
    width: scale(44),
    height: scale(44),
    borderRadius: BorderRadius.md,
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
    marginTop: scale(2),
  },
  badge: {
    alignSelf: 'flex-start',
    marginTop: scale(2),
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