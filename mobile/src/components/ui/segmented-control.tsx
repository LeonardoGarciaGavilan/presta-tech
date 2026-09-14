import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BorderRadius, FontSize, FontWeight, Spacing, scale } from '@/constants/theme';
import { useTheme, getSolidFill } from '@/components/ui/theme-provider';

interface SegmentedControlOption<T extends string> {
  label: string;
  value: T;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
  style?: View['props']['style'];
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  style,
}: SegmentedControlProps<T>) {
  const { colorScheme, colors } = useTheme();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
        style,
      ]}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
    >
      {options.map((option, i) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            style={[
              styles.segment,
              selected && {
                backgroundColor: getSolidFill(colors, colorScheme, 'primary'),
              },
              { borderRightColor: colors.border },
              i === options.length - 1 && { borderRightWidth: 0 },
            ]}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
          >
            <Text
              style={[
                styles.segmentText,
                { color: selected ? '#FFFFFF' : colors.textSecondary },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    minHeight: scale(40),
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  segmentText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
  },
});

export default SegmentedControl;