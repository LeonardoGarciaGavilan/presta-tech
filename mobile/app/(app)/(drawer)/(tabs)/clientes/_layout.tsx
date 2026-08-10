import { Stack } from 'expo-router';
import { useTheme } from '@/components/ui/theme-provider';
import { PermisoGate } from '@/components/permisos/permiso-gate';

export default function ClientesLayout() {
  const { colorScheme, colors } = useTheme();

  return (
    <PermisoGate modulo="CLIENTES" permiso="clientes:ver">
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
    </PermisoGate>
  );
}
