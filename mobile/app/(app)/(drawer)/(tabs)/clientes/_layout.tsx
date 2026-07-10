import { Stack } from 'expo-router';
import { useTheme } from '@/components/ui/theme-provider';

export default function ClientesLayout() {
  const { colorScheme, colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="crear" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="estado-cuenta" />
    </Stack>
  );
}
