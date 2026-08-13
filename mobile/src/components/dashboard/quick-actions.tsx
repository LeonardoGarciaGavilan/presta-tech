import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useNavigation } from 'expo-router';

import { FontSize, FontWeight, Spacing, BorderRadius, Colors, scale } from '@/constants/theme';
import { useTheme } from '@/components/ui/theme-provider';
import { usePermisos } from '@/permisos/use-permisos';

interface ActionItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route: string;
  colorKey: keyof typeof Colors.light;
  bgKey: keyof typeof Colors.light;
  permiso?: string;
}

const ACTIONS: ActionItem[] = [
  { icon: 'cash', label: 'Registrar pago', route: '/caja/pago', colorKey: 'success', bgKey: 'successLight', permiso: 'pagos:registrar' },
  { icon: 'person-add', label: 'Nuevo cliente', route: '/clientes/crear', colorKey: 'primary', bgKey: 'primaryLight', permiso: 'clientes:crear' },
  { icon: 'add-circle', label: 'Nuevo préstamo', route: '/prestamos/nuevo', colorKey: 'warning', bgKey: 'warningLight', permiso: 'prestamos:crear' },
  { icon: 'map', label: 'Ruta de cobro', route: '/rutas', colorKey: 'route', bgKey: 'routeBg', permiso: 'rutas:ver' },
];

const TAB_ROUTES: Record<string, { tab: string; screen: string }> = {
  '/caja/pago': { tab: 'caja', screen: 'pago' },
  '/clientes/crear': { tab: 'clientes', screen: 'crear' },
  '/prestamos/nuevo': { tab: 'prestamos', screen: 'nuevo' },
};

export function QuickActions() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { tienePermiso } = usePermisos();

  const visibleActions = ACTIONS.filter((a) => (a.permiso ? tienePermiso(a.permiso) : true));

  const handleNavigate = (route: string) => {
    if (route === '/clientes/crear') {
      router.navigate(route as any);
      return;
    }
    const tabRoute = TAB_ROUTES[route];
    if (tabRoute) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (navigation as any).navigate(tabRoute.tab, { screen: tabRoute.screen });
    } else {
      router.push(route as any);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>Acciones rápidas</Text>
      <View style={styles.grid}>
        {visibleActions.map((action) => (
          <TouchableOpacity
            key={action.route}
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderLight }]}
            activeOpacity={0.6}
            onPress={() => handleNavigate(action.route)}
            accessibilityRole="button"
            accessibilityLabel={action.label}
          >
            <View style={[styles.iconWrap, { backgroundColor: colors[action.bgKey] }]}>
              <Ionicons name={action.icon} size={scale(24)} color={colors[action.colorKey]} />
            </View>
            <Text style={[styles.label, { color: colors.text }]}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(12),
  },
  card: {
    width: '47%',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    alignItems: 'center',
  },
  iconWrap: {
    width: scale(48),
    height: scale(48),
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
  },
});
