import { Pressable, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, BorderRadius, scale } from '@/constants/theme';
import { SegmentedControl } from '@/components/ui/segmented-control';

type FilterType = 'todos' | 'pendientes' | 'visitados';

interface RutaToolbarProps {
  filter: FilterType;
  mapa: boolean;
  sortByCercania: boolean;
  colors: any;
  onFilterChange: (filter: FilterType) => void;
  onToggleMapa: () => void;
  onSortChange: () => void;
}

const FILTER_OPTIONS: { label: string; value: FilterType }[] = [
  { label: 'Todos', value: 'todos' },
  { label: 'Pendientes', value: 'pendientes' },
  { label: 'Visitados', value: 'visitados' },
];

export function RutaToolbar({
  filter,
  mapa,
  sortByCercania,
  colors,
  onFilterChange,
  onToggleMapa,
  onSortChange,
}: RutaToolbarProps) {
  return (
    <View style={styles.toolbar}>
      <SegmentedControl
        options={FILTER_OPTIONS}
        value={filter}
        onChange={onFilterChange}
        accessibilityLabel="Filtrar clientes de la ruta"
        style={styles.filterRow}
      />
      <View style={styles.toolRight}>
        <Pressable
          style={[styles.viewToggle, {
            backgroundColor: sortByCercania ? colors.primaryLight : colors.surface,
            borderColor: sortByCercania ? colors.primary : colors.border,
          }]}
          onPress={onSortChange}
          accessibilityRole="button"
          accessibilityLabel="Ordenar por cercanía"
          accessibilityState={{ selected: sortByCercania }}
        >
          <Ionicons
            name="navigate-outline"
            size={scale(16)}
            color={sortByCercania ? colors.primary : colors.textTertiary}
          />
        </Pressable>
        <Pressable
          style={[styles.viewToggle, {
            backgroundColor: mapa ? colors.primary : colors.surface,
            borderColor: mapa ? colors.primary : colors.border,
          }]}
          onPress={onToggleMapa}
          accessibilityRole="button"
          accessibilityLabel={mapa ? 'Ver lista de ruta' : 'Ver mapa de ruta'}
          accessibilityState={{ selected: mapa }}
        >
          <Ionicons
            name="map-outline"
            size={scale(16)}
            color={mapa ? '#FFF' : colors.primary}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  filterRow: {
    flex: 1,
    flexShrink: 1,
  },
  viewToggle: {
    width: scale(36),
    height: scale(36),
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toolRight: {
    flexDirection: 'row',
    gap: Spacing.xs,
    flexShrink: 0,
  },
});
