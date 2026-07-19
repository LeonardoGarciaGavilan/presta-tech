import { useState } from 'react';
import { Drawer } from 'expo-router/drawer';
import { Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { DrawerContentScrollView, type DrawerContentComponentProps } from '@react-navigation/drawer';
import { useQueryClient } from '@tanstack/react-query';

import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { useAuthStore } from '@/store/auth.store';
import { logout } from '@/api/auth.api';
import { clearSession } from '@/utils/session';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import { useTheme } from '@/components/ui/theme-provider';
import { useContarAlertas } from '@/hooks/use-alertas';

function DrawerItem({
  label,
  icon,
  onPress,
  colors,
  badge,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  colors: typeof Colors.light;
  badge?: number;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: 14,
        marginHorizontal: Spacing.sm,
        borderRadius: BorderRadius.md,
      }}
    >
      <View style={{ position: 'relative' }}>
        <Ionicons name={icon} size={22} color={colors.textSecondary} style={{ marginRight: Spacing.md }} />
        {badge != null && badge > 0 && (
          <View
            style={{
              position: 'absolute',
              top: -4,
              right: -2,
              backgroundColor: colors.error,
              borderRadius: 8,
              minWidth: 16,
              height: 16,
              justifyContent: 'center',
              alignItems: 'center',
              paddingHorizontal: 4,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: FontWeight.bold }}>
              {badge > 99 ? '99+' : badge}
            </Text>
          </View>
        )}
      </View>
      <Text style={{ color: colors.text, fontSize: FontSize.md, fontWeight: FontWeight.medium, flex: 1 }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { colorScheme, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.rol === 'ADMIN' || user?.rol === 'SUPERADMIN';
  const queryClient = useQueryClient();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { data: noLeidas } = useContarAlertas();

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } catch {
      // ignore server errors
    }
    queryClient.clear();
    await clearSession();
  };

  const adminItems = [
    { name: 'admin/alertas', label: 'Alertas', icon: 'notifications-outline' as const, badge: noLeidas },
    { name: 'admin/analisis-rutas', label: 'Análisis Rutas', icon: 'analytics-outline' as const },
    { name: 'admin/auditoria', label: 'Auditoría', icon: 'document-text-outline' as const },
    { name: 'admin/empleados', label: 'Empleados', icon: 'people-outline' as const },
    { name: 'admin/estado-financiero', label: 'Estado Financiero', icon: 'wallet-outline' as const },
    { name: 'admin/gastos', label: 'Gastos', icon: 'cart-outline' as const },
    { name: 'admin/usuarios', label: 'Usuarios', icon: 'people-outline' as const },
    { name: 'admin/reportes', label: 'Reportes', icon: 'bar-chart-outline' as const },
    { name: 'admin/configuracion', label: 'Configuración', icon: 'settings-outline' as const },
  ];

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.background }}>
      <View
        style={{
          padding: Spacing.lg,
          paddingBottom: Spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: colors.primary,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: FontSize.xl, fontWeight: FontWeight.bold }}>
            {(user?.nombre || user?.email || 'U')[0].toUpperCase()}
          </Text>
        </View>
        <View style={{ marginTop: Spacing.sm }}>
          <Text style={{ color: colors.text, fontSize: FontSize.md, fontWeight: FontWeight.semibold }}>
            {user?.nombre || 'Usuario'}
          </Text>
          <Text style={{ color: colors.textTertiary, fontSize: FontSize.sm, marginTop: 2 }}>
            {user?.email}
          </Text>
          <View
            style={{
              marginTop: Spacing.xs,
              backgroundColor: colors.primaryLight,
              paddingHorizontal: Spacing.sm,
              paddingVertical: 2,
              borderRadius: BorderRadius.sm,
              alignSelf: 'flex-start',
            }}
          >
            <Text style={{ color: colors.primary, fontSize: FontSize.xs, fontWeight: FontWeight.semibold }}>
              {user?.rol === 'ADMIN'
                ? 'Administrador'
                : user?.rol === 'SUPERADMIN'
                  ? 'Super Admin'
                  : 'Empleado'}
            </Text>
          </View>
        </View>
      </View>

      <DrawerContentScrollView {...props} style={{ flex: 1 }} bounces={false}>
        <DrawerItem
          label="Inicio"
          icon="home-outline"
          onPress={() => props.navigation.navigate('(tabs)')}
          colors={colors}
        />

        {isAdmin && (
          <>
            <View
              style={{
                paddingHorizontal: Spacing.lg,
                paddingTop: Spacing.md,
                paddingBottom: Spacing.xs,
              }}
            >
              <Text
                style={{
                  color: colors.textTertiary,
                  fontSize: FontSize.xs,
                  fontWeight: FontWeight.semibold,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}
              >
                Administración
              </Text>
            </View>
            {adminItems.map((item) => (
              <DrawerItem
                key={item.name}
                label={item.label}
                icon={item.icon}
                onPress={() => props.navigation.navigate(item.name)}
                colors={colors}
                badge={item.badge}
              />
            ))}
          </>
        )}
      </DrawerContentScrollView>

      {/* Logout */}
      <View style={{ paddingBottom: insets.bottom + Spacing.sm }}>
        <View
          style={{
            height: 1,
            backgroundColor: colors.border,
            marginHorizontal: Spacing.lg,
            marginBottom: Spacing.sm,
          }}
        />
        <TouchableOpacity
          onPress={() => setShowLogoutConfirm(true)}
          activeOpacity={0.7}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: Spacing.md,
            paddingVertical: 14,
            marginHorizontal: Spacing.sm,
            borderRadius: BorderRadius.md,
          }}
        >
          <Ionicons name="log-out-outline" size={22} color={colors.error} style={{ marginRight: Spacing.md }} />
          <Text style={{ color: colors.error, fontSize: FontSize.md, fontWeight: FontWeight.medium }}>
            Cerrar sesión
          </Text>
        </TouchableOpacity>
      </View>

      <ConfirmDialog
        visible={showLogoutConfirm}
        title="Cerrar sesión"
        message="¿Estás seguro de que deseas cerrar sesión?"
        confirmLabel="Cerrar sesión"
        cancelLabel="Cancelar"
        destructive
        loading={isLoggingOut}
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </View>
  );
}

export default function DrawerLayout() {
  const { colorScheme, colors } = useTheme();

  return (
    <Drawer
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'front',
        drawerStyle: {
          backgroundColor: colors.background,
          width: 280,
        },
        swipeEdgeWidth: 40,
      }}
    >
      <Drawer.Screen
        name="(tabs)"
        options={{
          headerShown: false,
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="admin/alertas"
        options={{
          title: 'Alertas',
          headerShown: true,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: FontWeight.semibold, fontSize: FontSize.lg },
        }}
      />
      <Drawer.Screen
        name="admin/analisis-rutas"
        options={{
          title: 'Análisis Rutas',
          headerShown: true,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: FontWeight.semibold, fontSize: FontSize.lg },
        }}
      />
      <Drawer.Screen
        name="admin/auditoria"
        options={{
          title: 'Auditoría',
          headerShown: true,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: FontWeight.semibold, fontSize: FontSize.lg },
        }}
      />
      <Drawer.Screen
        name="admin/empleados"
        options={{
          title: 'Empleados',
          headerShown: true,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: FontWeight.semibold, fontSize: FontSize.lg },
        }}
      />
      <Drawer.Screen
        name="admin/estado-financiero"
        options={{
          title: 'Estado Financiero',
          headerShown: true,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: FontWeight.semibold, fontSize: FontSize.lg },
        }}
      />
      <Drawer.Screen
        name="admin/gastos"
        options={{
          title: 'Gastos',
          headerShown: true,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: FontWeight.semibold, fontSize: FontSize.lg },
        }}
      />
      <Drawer.Screen
        name="admin/usuarios"
        options={{
          title: 'Usuarios',
          headerShown: true,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: FontWeight.semibold, fontSize: FontSize.lg },
        }}
      />
      <Drawer.Screen
        name="admin/reportes"
        options={{
          title: 'Reportes',
          headerShown: true,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: FontWeight.semibold, fontSize: FontSize.lg },
        }}
      />
      <Drawer.Screen
        name="admin/configuracion"
        options={{
          title: 'Configuración',
          headerShown: true,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: FontWeight.semibold, fontSize: FontSize.lg },
        }}
      />
    </Drawer>
  );
}
