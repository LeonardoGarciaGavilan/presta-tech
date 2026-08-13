import { Stack } from 'expo-router';
import { useTheme } from '@/components/ui/theme-provider';
import { PermisoGate } from '@/components/permisos/permiso-gate';

export default function PagosLayout() {
  const { colorScheme, colors } = useTheme();

  return (
    <PermisoGate modulo="PAGOS" permiso="pagos:ver">
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="prestamo/[id]" />
      </Stack>
    </PermisoGate>
  );
}
