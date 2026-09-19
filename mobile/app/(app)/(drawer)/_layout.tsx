import { useState } from 'react';
import { Drawer } from 'expo-router/drawer';
import { Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { DrawerContentScrollView, type DrawerContentComponentProps } from 'expo-router/drawer';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { Colors, FontSize, FontWeight, Spacing, BorderRadius, scale } from '@/constants/theme';
import { useAuthStore } from '@/store/auth.store';
import { logout, clearPushToken } from '@/api/auth.api';
import { clearSession } from '@/utils/session';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import { useTheme, getSolidFill } from '@/components/ui/theme-provider';

function DrawerItem({
  label,
  icon,
  onPress,
  colors,
  colorScheme,
  tint,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  colors: typeof Colors.light;
  colorScheme: 'light' | 'dark';
  tint?: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: scale(14),
        marginHorizontal: Spacing.sm,
        borderRadius: BorderRadius.md,
      }}
    >
      <Ionicons
        name={icon}
        size={scale(22)}
        color={tint ?? colors.textSecondary}
        style={{ marginRight: Spacing.md }}
      />
      <Text
        style={{
          color: tint ?? colors.text,
          fontSize: FontSize.md,
          fontWeight: FontWeight.medium,
          flex: 1,
        }}
      >
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={scale(18)} color={colors.textTertiary} />
    </TouchableOpacity>
  );
}

function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { colorScheme, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const router = useRouter();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await clearPushToken();
    } catch {
      // ignore — token may already be null
    }
    try {
      await logout();
    } catch {
      // ignore server errors
    }
    queryClient.clear();
    await clearSession();
  };

  const rolLabel =
    user?.rol === 'ADMIN'
      ? 'Administrador'
      : user?.rol === 'SUPERADMIN'
        ? 'Super Admin'
        : 'Empleado';

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
            width: scale(52),
            height: scale(52),
            borderRadius: scale(26),
            backgroundColor: getSolidFill(colors, colorScheme, 'primary'),
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
          <Text style={{ color: colors.textTertiary, fontSize: FontSize.sm, marginTop: scale(2) }}>
            {user?.email}
          </Text>
          <View
            style={{
              marginTop: Spacing.xs,
              backgroundColor: colors.primaryLight,
              paddingHorizontal: Spacing.sm,
              paddingVertical: scale(2),
              borderRadius: BorderRadius.sm,
              alignSelf: 'flex-start',
            }}
          >
            <Text style={{ color: colors.primary, fontSize: FontSize.xs, fontWeight: FontWeight.semibold }}>
              {rolLabel}
            </Text>
          </View>
        </View>
      </View>

      <DrawerContentScrollView {...props} style={{ flex: 1 }} bounces={false}>
        <DrawerItem
          label="Inicio"
          icon="home-outline"
          onPress={() => router.navigate('/dashboard')}
          colors={colors}
          colorScheme={colorScheme}
        />
        <DrawerItem
          label="Mi perfil"
          icon="person-outline"
          onPress={() => router.navigate('/perfil')}
          colors={colors}
          colorScheme={colorScheme}
        />
        <DrawerItem
          label="Mi empresa"
          icon="business-outline"
          onPress={() => router.navigate('/perfil?section=empresa')}
          colors={colors}
          colorScheme={colorScheme}
        />
        <DrawerItem
          label="Seguridad"
          icon="lock-closed-outline"
          onPress={() => router.navigate('/perfil?section=seguridad')}
          colors={colors}
          colorScheme={colorScheme}
        />

        <View
          style={{
            height: scale(1),
            backgroundColor: colors.border,
            marginHorizontal: Spacing.lg,
            marginVertical: Spacing.sm,
          }}
        />

        <DrawerItem
          label="Ayuda"
          icon="help-buoy-outline"
          onPress={() => router.navigate('/ayuda' as never)}
          colors={colors}
          colorScheme={colorScheme}
        />
        <DrawerItem
          label="Acerca de PrestaTech"
          icon="information-circle-outline"
          onPress={() => router.navigate('/acerca-de' as never)}
          colors={colors}
          colorScheme={colorScheme}
        />
      </DrawerContentScrollView>

      {/* Logout */}
      <View style={{ paddingBottom: insets.bottom + Spacing.sm }}>
        <View
          style={{
            height: scale(1),
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
            paddingVertical: scale(14),
            marginHorizontal: Spacing.sm,
            borderRadius: BorderRadius.md,
          }}
        >
          <Ionicons name="log-out-outline" size={scale(22)} color={colors.error} style={{ marginRight: Spacing.md }} />
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
        useHold
        loading={isLoggingOut}
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </View>
  );
}

export default function DrawerLayout() {
  const { colors } = useTheme();
  const router = useRouter();

  const headerOptions = (title: string) => ({
    title,
    headerShown: true,
    headerStyle: { backgroundColor: colors.background },
    headerTintColor: colors.text,
    headerTitleStyle: { fontWeight: FontWeight.semibold, fontSize: FontSize.lg } as const,
    drawerItemStyle: { display: 'none' as const },
    headerBackTitle: '',
    headerLeft: () => (
      <TouchableOpacity
        onPress={() => router.replace('/mas')}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={{ marginLeft: Spacing.sm }}
        accessibilityRole="button"
        accessibilityLabel="Volver a Más"
      >
        <Ionicons name="chevron-back" size={scale(28)} color={colors.text} />
      </TouchableOpacity>
    ),
  });

  return (
    <Drawer
      drawerContent={(dwProps) => <CustomDrawerContent {...dwProps} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'front',
        drawerStyle: {
          backgroundColor: colors.background,
          width: scale(280),
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
      <Drawer.Screen name="impresora" options={headerOptions('Impresora')} />
      <Drawer.Screen name="ayuda" options={headerOptions('Ayuda y soporte')} />
      <Drawer.Screen name="acerca-de" options={headerOptions('Acerca de PrestaTech')} />
      <Drawer.Screen name="admin/alertas" options={headerOptions('Alertas')} />
      <Drawer.Screen name="admin/analisis-rutas" options={headerOptions('Análisis Rutas')} />
      <Drawer.Screen name="admin/auditoria" options={headerOptions('Auditoría')} />
      <Drawer.Screen name="admin/empleados" options={headerOptions('Empleados')} />
      <Drawer.Screen name="admin/estado-financiero" options={headerOptions('Estado Financiero')} />
      <Drawer.Screen name="admin/gastos" options={headerOptions('Gastos')} />
      <Drawer.Screen name="admin/usuarios" options={headerOptions('Usuarios')} />
      <Drawer.Screen
        name="admin/permisos/[id]"
        options={{
          title: 'Permisos',
          headerShown: false,
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen name="admin/reportes" options={headerOptions('Reportes')} />
    </Drawer>
  );
}