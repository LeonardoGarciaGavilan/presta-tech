import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { CompanyHeader } from '@/components/ui/company-header';
import { useTheme } from '@/components/ui/theme-provider';
import { scale } from '@/constants/theme';
import { usePermisos } from '@/permisos/use-permisos';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { moduloHabilitado, tienePermiso } = usePermisos();

  // Visibilidad de tabs. Los Screens se registran SIEMPRE (Expo Router los
  // auto-registra desde el filesystem); href: null es lo que oculta el tab
  // de la barra manteniendo la ruta navegable.
  const puedeCaja = moduloHabilitado('CAJA') && tienePermiso('caja:ver');
  const puedePrestamos = moduloHabilitado('PRESTAMOS') && tienePermiso('prestamos:ver');
  const puedeClientes = moduloHabilitado('CLIENTES') && tienePermiso('clientes:ver');

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        header: () => <CompanyHeader />,
        tabBarActiveTintColor: colors.tabIconSelected,
        tabBarInactiveTintColor: colors.tabIconDefault,
        tabBarStyle: {
          borderTopColor: colors.border,
          backgroundColor: colors.background,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          height: scale(60) + insets.bottom,
          paddingBottom: insets.bottom + 8,
          paddingTop: scale(4),
        },
        tabBarLabelStyle: {
          fontSize: scale(11),
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Inicio',
          tabBarLabel: 'Inicio',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="caja"
        listeners={({ navigation }) => ({
          blur: () => {
            const state = navigation.getState?.();
            const cajaRoute = state?.routes?.find((r: any) => r.name === 'caja');
            if (cajaRoute?.state?.key) {
              navigation.reset?.({
                index: 0,
                routes: [{ name: 'index' }],
                target: cajaRoute.state.key,
              });
            }
          },
        })}
        options={{
          title: 'Caja',
          tabBarLabel: 'Caja',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="wallet-outline" size={size} color={color} />
          ),
          ...(puedeCaja ? {} : { href: null }),
        }}
      />
      <Tabs.Screen
        name="prestamos"
        options={{
          title: 'Préstamos',
          tabBarLabel: 'Préstamos',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="card-outline" size={size} color={color} />
          ),
          ...(puedePrestamos ? {} : { href: null }),
        }}
      />
      <Tabs.Screen
        name="clientes"
        options={{
          title: 'Clientes',
          tabBarLabel: 'Clientes',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
          ...(puedeClientes ? {} : { href: null }),
        }}
      />
      {/* Más — centro de módulos. Rutas, Configuración y Perfil ya no
          compiten por espacio en el tab bar; se acceden desde aquí. */}
      <Tabs.Screen
        name="mas"
        options={{
          title: 'Más',
          tabBarLabel: 'Más',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="ellipsis-horizontal" size={size} color={color} />
          ),
        }}
      />
      {/* Rutas ya no es tab principal — se accede desde Más (Acceso rápido).
          href: null lo oculta del tab bar manteniendo la ruta navegable. */}
      <Tabs.Screen
        name="rutas"
        options={{
          title: 'Rutas',
          href: null,
        }}
      />
      {/* Perfil — se accede vía avatar en el header o desde el menú ☰. */}
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          href: null,
        }}
      />
      {/* Configuración — se accede desde Más (Acceso rápido). */}
      <Tabs.Screen
        name="configuracion"
        options={{
          title: 'Configuración',
          href: null,
        }}
      />
    </Tabs>
  );
}
