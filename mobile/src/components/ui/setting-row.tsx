import { StyleSheet, Switch, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { FontSize, FontWeight, scale, Spacing } from '@/constants/theme';
import type { Colors } from '@/constants/theme';

interface SettingRowProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  colors: typeof Colors.light;
  isLast?: boolean;
}

export function SettingRow({
  label,
  description,
  value,
  onValueChange,
  disabled = false,
  colors,
  isLast = false,
}: SettingRowProps) {
  const handleChange = (next: boolean) => {
    if (!disabled) {
      Haptics.selectionAsync().catch(() => {});
      onValueChange(next);
    }
  };

  return (
    <View
      style={[styles.row, !isLast && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}
    >
      <View style={styles.textContainer}>
        <Text style={[styles.label, { color: disabled ? colors.textTertiary : colors.text }]}>
          {label}
        </Text>
        {description && (
          <Text style={[styles.description, { color: colors.textTertiary }]}>{description}</Text>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={handleChange}
        disabled={disabled}
        trackColor={{ false: colors.disabled, true: colors.primary }}
        thumbColor="#FFFFFF"
        ios_backgroundColor={colors.borderLight}
        accessibilityRole="switch"
        accessibilityLabel={label}
        accessibilityState={{ disabled, checked: value }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    minHeight: scale(52),
  },
  textContainer: {
    flex: 1,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  description: {
    fontSize: FontSize.xs,
    marginTop: scale(2),
  },
});
