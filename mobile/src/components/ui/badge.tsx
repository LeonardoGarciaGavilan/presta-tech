import { StyleSheet, Text, View } from 'react-native';

import { BorderRadius, FontSize, FontWeight, scale } from '@/constants/theme';

interface BadgeProps {
  label: string;
  color: string;
  bg?: string;
}

export default function Badge({ label, color, bg }: BadgeProps) {
  const backgroundColor = bg ?? (color + '18');
  return (
    <View style={[styles.badge, { backgroundColor }]}>
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: scale(6),
    paddingVertical: scale(1),
    borderRadius: BorderRadius.sm,
  },
  text: { fontSize: scale(10), fontWeight: FontWeight.bold },
});
