import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { useTheme } from '@/components/ui/theme-provider';

interface ActionItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route: string;
  color: string;
  bg: string;
}

const ACTIONS: ActionItem[] = [
  { icon: 'cash', label: 'Registrar pago', route: '/caja/pago', color: '#16A34A', bg: '#F0FDF4' },
  { icon: 'person-add', label: 'Nuevo cliente', route: '/clientes/crear', color: '#2563EB', bg: '#EFF6FF' },
  { icon: 'add-circle', label: 'Nuevo préstamo', route: '/prestamos/nuevo', color: '#D97706', bg: '#FFFBEB' },
  { icon: 'map', label: 'Ruta de cobro', route: '/rutas', color: '#0891B2', bg: '#ECFEFF' },
];

export function QuickActions() {
  const { colorScheme, colors } = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>Acciones rápidas</Text>
      <View style={styles.grid}>
        {ACTIONS.map((action) => (
          <TouchableOpacity
            key={action.route}
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderLight }]}
            activeOpacity={0.6}
            onPress={() => router.push(action.route as any)}
          >
            <View style={[styles.iconWrap, { backgroundColor: action.bg }]}>
              <Ionicons name={action.icon} size={24} color={action.color} />
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
    gap: 12,
  },
  card: {
    width: '47%',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    alignItems: 'center',
  },
  iconWrap: {
    width: 48,
    height: 48,
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
