import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from 'expo-router';

import { FontSize, FontWeight, Spacing, scale} from '@/constants/theme';
import { useAuthStore } from '@/store/auth.store';
import { useTheme } from '@/components/ui/theme-provider';
import { ThemeSelectorModal } from '@/components/ui/theme-selector-modal';

export function CompanyHeader() {
  const [showThemeModal, setShowThemeModal] = useState(false);
  const insets = useSafeAreaInsets();
  const { colors, themeMode } = useTheme();
  const companyName = useAuthStore((s) => s.user?.empresa);
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.rol === 'ADMIN' || user?.rol === 'SUPERADMIN';

  const drawerNav = useNavigation('/(app)/(drawer)') as unknown as {
    toggleDrawer: () => void;
  };

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
        {isAdmin && (
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
      </View>

      <ThemeSelectorModal visible={showThemeModal} onClose={() => setShowThemeModal(false)} />
    </View>
  );
}
