import { Linking, Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { StyleProp, TextStyle } from 'react-native';

import { Spacing, scale } from '@/constants/theme';

interface ClickToCallProps {
  phone: string | null | undefined;
  textStyle?: StyleProp<TextStyle>;
  iconSize?: number;
  iconColor?: string;
  showIcon?: boolean;
  numberOfLines?: number;
  compact?: boolean;
}

function normalizarTelefono(num: string | null | undefined): string | null {
  if (!num) return null;
  const d = String(num).replace(/[^\d+]/g, '');
  const digits = d.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  return d;
}

export default function ClickToCall({
  phone,
  textStyle,
  iconSize = scale(12),
  iconColor,
  showIcon = true,
  numberOfLines = 1,
  compact = false,
}: ClickToCallProps) {
  const normalized = normalizarTelefono(phone);
  const display = phone || '—';

  if (!normalized) {
    return (
      <Text style={textStyle} numberOfLines={numberOfLines}>
        {display}
      </Text>
    );
  }

  return (
    <Pressable
      onPress={() => Linking.openURL(`tel:${normalized}`)}
      accessibilityRole="link"
      accessibilityLabel={`Llamar a ${display}`}
      hitSlop={8}
      style={({ pressed }) => [
        styles.row,
        compact && styles.rowCompact,
        pressed && styles.pressed,
      ]}
    >
      {showIcon && (
        <Ionicons
          name="call-outline"
          size={iconSize}
          color={iconColor ?? textStyleColor(textStyle)}
        />
      )}
      <Text style={textStyle} numberOfLines={numberOfLines}>
        {display}
      </Text>
    </Pressable>
  );
}

function textStyleColor(style: StyleProp<TextStyle>) {
  if (Array.isArray(style)) {
    for (const s of style) {
      if (s && typeof s === 'object' && 'color' in s) return (s as TextStyle).color;
    }
  } else if (style && typeof style === 'object' && 'color' in style) {
    return (style as TextStyle).color;
  }
  return undefined;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    minHeight: 44,
    justifyContent: 'flex-start',
    flexShrink: 1,
  },
  pressed: {
    opacity: 0.6,
  },
  rowCompact: {
    minHeight: 28,
  },
});