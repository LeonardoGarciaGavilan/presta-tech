import { Stack } from 'expo-router';
import { useTheme } from '@/components/ui/theme-provider';
import { PermisoGate } from '@/components/permisos/permiso-gate';

export default function CajaLayout() {
  const { colorScheme, colors } = useTheme();

  return (
    <PermisoGate modulo="CAJA" permiso="caja:ver">
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
    </PermisoGate>
  );
}
