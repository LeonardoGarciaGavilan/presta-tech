import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { FontSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/components/ui/theme-provider';

interface LoadingScreenProps {
  message?: string;
}

export default function LoadingScreen({ message = 'Cargando...' }: LoadingScreenProps) {
  const { colorScheme, colors } = useTheme();

  return (
    <View style={styles.container} accessible accessibilityRole="progressbar" accessibilityLabel={message}>
      <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Cargando" />
      <Text accessibilityRole="text" style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  message: {
    marginTop: Spacing.md,
    fontSize: FontSize.md,
    textAlign: 'center',
  },
});
