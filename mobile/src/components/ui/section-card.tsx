import { StyleSheet, Text, View } from 'react-native';

import { BorderRadius, FontSize, FontWeight, scale, Spacing } from '@/constants/theme';
import type { Colors } from '@/constants/theme';

interface SectionCardProps {
  icon: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  colors: typeof Colors.light;
}

export function SectionCard({
  icon,
  title,
  description,
  children,
  colors,
}: SectionCardProps) {
  return (
    <View
      style={[
        styles.sectionCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View
        style={[
          styles.sectionHeader,
          { borderBottomColor: colors.borderLight },
        ]}
      >
        <View
          style={[
            styles.sectionIcon,
            { backgroundColor: colors.primaryLight },
          ]}
        >
          <Text style={styles.sectionEmoji}>{icon}</Text>
        </View>
        <View style={styles.sectionHeaderText}>
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>
            {title}
          </Text>
          {description && (
            <Text
              accessibilityRole="text"
              style={[styles.sectionDesc, { color: colors.textTertiary }]}
            >
              {description}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderBottomWidth: 1,
  },
  sectionIcon: {
    width: scale(36),
    height: scale(36),
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionEmoji: {
    fontSize: scale(18),
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  sectionDesc: {
    fontSize: FontSize.xs,
    marginTop: scale(1),
  },
  sectionContent: {
    padding: Spacing.md,
  },
});
