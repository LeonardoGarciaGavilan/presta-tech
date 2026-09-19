import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, usePathname, useRouter } from 'expo-router';

import { FontSize, FontWeight, Spacing, scale} from '@/constants/theme';
import { useAuthStore } from '@/store/auth.store';
import { useTheme, getSolidFill } from '@/components/ui/theme-provider';
import { ThemeSelectorModal } from '@/components/ui/theme-selector-modal';
import { Routes } from '@/constants/routes';

export function CompanyHeader() {
  const [showThemeModal, setShowThemeModal] = useState(false);
  const insets = useSafeAreaInsets();
  const { colorScheme, colors, themeMode } = useTheme();
  const companyName = useAuthStore((s) => s.user?.empresa);
  const userNombre = useAuthStore((s) => s.user?.nombre);
  const userEmail = useAuthStore((s) => s.user?.email);

  const drawerNav = useNavigation('/(app)/(drawer)') as unknown as {
    toggleDrawer: () => void;
  };
  const router = useRouter();
  const pathname = usePathname();

  const esSubmodulo =
    pathname === '/configuracion' || pathname === Routes.TABS.RUTAS || pathname.startsWith('/rutas/');

  const themeIcon =
    themeMode === 'light' ? 'sunny-outline' : themeMode === 'dark' ? 'moon-outline' : 'phone-portrait-outline';

  return (
    <View
      style={{
        paddingTop: insets.top,
        backgroundColor: colors.background,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <View
        style={{
          height: scale(52),
          paddingHorizontal: Spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        {esSubmodulo ? (
          <TouchableOpacity
            onPress={() => router.replace('/mas')}
            activeOpacity={0.6}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Volver a Más"
            accessibilityHint="Regresa a la pantalla de módulos"
            style={{ marginRight: Spacing.sm }}
          >
            <Ionicons name="chevron-back" size={scale(26)} color={colors.text} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => drawerNav.toggleDrawer()}
            activeOpacity={0.6}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Menú"
            accessibilityHint="Abre el menú de navegación"
            style={{ marginRight: Spacing.sm }}
          >
            <Ionicons name="menu-outline" size={scale(26)} color={colors.text} />
          </TouchableOpacity>
        )}
        <Text
          style={{
            fontSize: FontSize.lg,
            fontWeight: FontWeight.semibold,
            color: colors.text,
            flex: 1,
          }}
          numberOfLines={1}
          accessibilityRole="header"
        >
          {companyName || 'Mi Empresa'}
        </Text>

        <TouchableOpacity
          onPress={() => setShowThemeModal(true)}
          activeOpacity={0.6}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Cambiar tema"
          accessibilityHint="Abre el selector de tema"
          style={{ marginLeft: Spacing.sm }}
        >
          <Ionicons name={themeIcon} size={scale(24)} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push(Routes.TABS.PERFIL)}
          activeOpacity={0.6}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Mi perfil"
          accessibilityHint="Abre tu pantalla de perfil"
          style={{
            marginLeft: Spacing.sm,
            width: scale(34),
            height: scale(34),
            borderRadius: scale(17),
            backgroundColor: getSolidFill(colors, colorScheme, 'primary'),
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              color: '#FFFFFF',
              fontSize: FontSize.md,
              fontWeight: FontWeight.bold,
            }}
          >
            {(userNombre || userEmail || 'U')[0].toUpperCase()}
          </Text>
        </TouchableOpacity>
      </View>

      <ThemeSelectorModal visible={showThemeModal} onClose={() => setShowThemeModal(false)} />
    </View>
  );
}
