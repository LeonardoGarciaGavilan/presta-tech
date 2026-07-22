import { Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/components/ui/theme-provider';
import { FontSize, FontWeight, scale, Spacing } from '@/constants/theme';

interface PageHeaderProps {
  title: string;
  right?: React.ReactNode;
}

export function PageHeader({ title, right }: PageHeaderProps) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        height: scale(48),
        paddingHorizontal: Spacing.sm,
        gap: Spacing.xs,
      }}
    >
      <TouchableOpacity
        onPress={() => router.back()}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessible
        accessibilityRole="button"
        accessibilityLabel="Volver"
        accessibilityHint="Regresa a la pantalla anterior"
        style={{
          width: scale(36),
          height: scale(36),
          borderRadius: scale(18),
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="arrow-back" size={scale(22)} color={colors.primary} />
      </TouchableOpacity>
      <Text
        numberOfLines={1}
        accessibilityRole="header"
        style={{
          flex: 1,
          fontSize: FontSize.lg,
          fontWeight: FontWeight.semibold,
          color: colors.text,
        }}
      >
        {title}
      </Text>
      {right && <View>{right}</View>}
    </View>
  );
}
