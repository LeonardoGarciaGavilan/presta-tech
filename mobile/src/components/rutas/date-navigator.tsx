import { Pressable, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontSize, FontWeight, Spacing, BorderRadius, scale} from '@/constants/theme';

interface DateNavigatorProps {
  selectedDate: string;
  displayDate: string;
  colors: any;
  onNavigate: (delta: number) => void;
  onToday: () => void;
}

export function DateNavigator({
  selectedDate,
  displayDate: displayDateStr,
  colors,
  onNavigate,
  onToday,
}: DateNavigatorProps) {
  return (
    <View style={[styles.dateRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Pressable onPress={() => onNavigate(-1)} hitSlop={8}>
        <Ionicons name="chevron-back" size={scale(20)} color={colors.primary} />
      </Pressable>
      <Pressable onPress={onToday}>
        <Text style={[styles.dateText, { color: colors.text }]}>
          {displayDateStr}
        </Text>
      </Pressable>
      <Pressable onPress={() => onNavigate(1)} hitSlop={8}>
        <Ionicons name="chevron-forward" size={scale(20)} color={colors.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  dateText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
});
