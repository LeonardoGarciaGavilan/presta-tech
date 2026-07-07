import { Stack } from 'expo-router';
import { useTheme } from '@/components/ui/theme-provider';

export default function RutasLayout() {
  const { colorScheme, colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen
        name="index"
        options={{ title: 'Rutas' }}
      />
      <Stack.Screen
        name="[id]"
        options={{ headerBackButtonDisplayMode: 'minimal' }}
      />
      <Stack.Screen name="gestion/[id]" />
      <Stack.Screen name="generar-dia/[id]" />
    </Stack>
  );
}
