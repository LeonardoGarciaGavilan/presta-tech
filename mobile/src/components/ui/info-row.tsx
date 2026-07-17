import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { FontSize, FontWeight, IoniconsName } from '@/constants/theme';

interface InfoRowProps {
  icon: IoniconsName;
  label: string;
  value: string;
  colors: any;
}

export default function InfoRow({ icon, label, value, colors }: InfoRowProps) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${value}`}>
      <Ionicons name={icon} size={13} color={colors.textTertiary} accessibilityRole="image" accessibilityLabel={label} />
      <Text accessibilityRole="text" style={[styles.label, { color: colors.textTertiary }]}>{label}:</Text>
      <Text accessibilityRole="text" style={[styles.value, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontSize: FontSize.xs,
    width: 60,
  },
  value: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
});
