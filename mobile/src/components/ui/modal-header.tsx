import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { BorderRadius, FontSize, FontWeight, IoniconsName, Spacing, scale } from '@/constants/theme';
import { useTheme } from '@/components/ui/theme-provider';

interface ModalHeaderProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onClose: () => void;
  color?: string;
}

export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function ModalHeader({
  icon,
  title,
  subtitle,
  onClose,
  color,
}: ModalHeaderProps) {
  const { colors } = useTheme();
  const accent = color ?? colors.primary;

  return (
    <View style={[styles.header, { backgroundColor: hexToRgba(accent, 0.12) }]}>
      <View style={[styles.headerIcon, { backgroundColor: hexToRgba(accent, 0.18) }]}>
        <Ionicons name={icon as IoniconsName} size={scale(22)} color={accent} />
      </View>
      <View style={styles.headerText}>
        <Text style={[styles.title, { color: accent }]} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
        {!!subtitle && (
          <Text style={[styles.subtitle, { color: colors.textTertiary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      <Pressable
        onPress={onClose}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Cerrar"
        style={styles.closeBtn}
      >
        <Ionicons name="close" size={scale(20)} color={colors.textTertiary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  headerIcon: {
    width: scale(44),
    height: scale(44),
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  subtitle: {
    fontSize: FontSize.xs,
    marginTop: scale(1),
  },
  closeBtn: {
    padding: scale(2),
  },
});