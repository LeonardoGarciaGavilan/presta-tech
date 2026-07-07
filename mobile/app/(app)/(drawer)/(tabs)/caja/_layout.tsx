import { Stack } from 'expo-router';
import { useTheme } from '@/components/ui/theme-provider';

export default function CajaLayout() {
  const { colorScheme, colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Caja' }} />
      <Stack.Screen name="pago" />
      <Stack.Screen name="historial" />
      <Stack.Screen name="activas" />
    </Stack>
  );
}
