import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import { useTheme } from '@/components/ui/theme-provider';

interface ClienteAvatarProps {
  nombre: string;
  activo: boolean;
  size?: number;
}

const AVATAR_COLORS = {
  active: ['#1A56DB', '#1E40AF'],
  inactive: ['#94A3B8', '#64748B'],
};

export default function ClienteAvatar({
  nombre,
  activo,
  size = 44,
}: ClienteAvatarProps) {
  const { colorScheme, colors } = useTheme();
  const initial = (nombre || '?')[0].toUpperCase();
  const palette = activo ? AVATAR_COLORS.active : AVATAR_COLORS.inactive;
  const fontSize = size * 0.42;

  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 3,
          backgroundColor: palette[0],
        },
      ]}
    >
      <Text
        style={[
          styles.initial,
          { fontSize, color: '#FFFFFF' },
        ]}
      >
        {initial}
      </Text>
      {activo && (
        <View
          style={[
            styles.onlineDot,
            {
              width: size * 0.25,
              height: size * 0.25,
              borderRadius: size * 0.125,
              backgroundColor: colors.success,
              borderWidth: 2,
              borderColor: colors.background,
              right: -2,
              bottom: -1,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  initial: {
    fontWeight: FontWeight.bold,
  },
  onlineDot: {
    position: 'absolute',
  },
});
