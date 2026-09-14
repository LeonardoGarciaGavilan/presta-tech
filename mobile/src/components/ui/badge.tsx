import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { BorderRadius, FontSize, FontWeight, IoniconsName, scale } from '@/constants/theme';

interface BadgeProps {
  label: string;
  color: string;
  bg?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

export default function Badge({ label, color, bg, icon }: BadgeProps) {
  const backgroundColor = bg ?? (color + '18');
  return (
    <View style={[styles.badge, { backgroundColor }]}>
      {icon && (
        <Ionicons
          name={icon as IoniconsName}
          size={scale(10)}
          color={color}
          style={styles.icon}
        />
      )}
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(2),
    paddingHorizontal: scale(6),
    paddingVertical: scale(1),
    borderRadius: BorderRadius.sm,
  },
  icon: {
    marginRight: 0,
  },
  text: { fontSize: scale(10), fontWeight: FontWeight.bold },
});
