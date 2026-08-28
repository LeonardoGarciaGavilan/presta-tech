import { StyleSheet, Text, View } from 'react-native';

import { BorderRadius, FontSize, FontWeight, scale, Spacing } from '@/constants/theme';

interface KpiCardProps {
  label: string;
  value: string;
  color: string;
  bg: string;
}

export default function KpiCard({ label, value, color, bg }: KpiCardProps) {
  return (
    <View style={[styles.card, { backgroundColor: bg }]}>
      <Text style={[styles.value, { color }]}>{value}</Text>
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    marginRight: Spacing.sm,
    minWidth: scale(100),
    alignItems: 'center',
  },
  value: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  label: { fontSize: FontSize.xs, fontWeight: FontWeight.medium, marginTop: scale(1) },
});
