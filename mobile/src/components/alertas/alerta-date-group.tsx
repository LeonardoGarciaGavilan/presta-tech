import { StyleSheet, Text, View } from 'react-native';
import { FontSize, FontWeight, Spacing, scale} from '@/constants/theme';
import { useTheme } from '@/components/ui/theme-provider';

interface AlertaDateGroupProps {
  title: string;
  count: number;
}

export function AlertaDateGroup({ title, count }: AlertaDateGroupProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.textTertiary }]}>{title}</Text>
      <Text style={[styles.count, { color: colors.textTertiary }]}>{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  title: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: scale(0.5),
  },
  count: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
});
