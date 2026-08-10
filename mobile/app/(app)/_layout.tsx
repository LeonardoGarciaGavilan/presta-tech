import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';

import { AuthGuard } from '@/components/auth/auth-guard';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { NetworkBanner } from '@/components/ui/network-banner';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { useTheme } from '@/components/ui/theme-provider';
import { useAuthStore } from '@/store/auth.store';
import SinAcceso from '@/components/permisos/sin-acceso';

export default function AppLayout() {
  usePushNotifications();
  const { colors } = useTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  if (user?.rol === 'SUPERADMIN') {
    return (
      <SinAcceso
        title="Acceso solo web"
        subtitle="La app móvil es solo para administradores y empleados. Inicia sesión en la web para gestionar como superadmin."
      />
    );
  }

  return (
    <AuthGuard>
      <ErrorBoundary>
        <View style={styles.container}>
          <NetworkBanner />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(drawer)" />
            <Stack.Screen name="pagos" />
            <Stack.Screen
              name="sincronizacion"
              options={{
                headerShown: true,
                headerStyle: { backgroundColor: colors.background },
                headerTintColor: colors.text,
                headerTitleStyle: { fontWeight: '600' },
                title: 'Sincronización',
                headerBackTitle: '',
                headerLeft: ({ tintColor, canGoBack }) =>
                  canGoBack ? (
                    <TouchableOpacity
                      onPress={() => router.back()}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      style={{ marginLeft: 8 }}
                    >
                      <Ionicons name="chevron-back" size={28} color={tintColor} />
                    </TouchableOpacity>
                  ) : null,
              }}
            />
          </Stack>
        </View>
      </ErrorBoundary>
    </AuthGuard>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
