import { Pressable, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontSize, FontWeight, Spacing, BorderRadius, scale} from '@/constants/theme';

type FilterType = 'todos' | 'pendientes' | 'visitados';

interface RutaToolbarProps {
  filter: FilterType;
  viewMode: 'list' | 'map';
  sortByCercania: boolean;
  colors: any;
  onFilterChange: (filter: FilterType) => void;
  onViewModeChange: () => void;
  onSortChange: () => void;
}

const FILTER_LABELS: Record<FilterType, string> = {
  todos: 'Todos',
  pendientes: 'Pendientes',
  visitados: 'Visitados',
};

export function RutaToolbar({
  filter,
  viewMode,
  sortByCercania,
  colors,
  onFilterChange,
  onViewModeChange,
  onSortChange,
}: RutaToolbarProps) {
  return (
    <View style={styles.toolbar}>
      <View style={styles.filterRow}>
        {(['todos', 'pendientes', 'visitados'] as const).map((f) => (
          <Pressable
            key={f}
            style={[
              styles.filterChip,
              {
                backgroundColor: filter === f ? colors.primaryLight : colors.surface,
                borderColor: filter === f ? colors.primary : colors.border,
              },
            ]}
            onPress={() => onFilterChange(f)}
          >
            <Text
              style={[
                styles.filterChipText,
                { color: filter === f ? colors.primary : colors.textSecondary },
              ]}
            >
              {FILTER_LABELS[f]}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.toolRight}>
        <Pressable
          style={[styles.viewToggle, {
            backgroundColor: sortByCercania ? colors.primaryLight : colors.surface,
            borderColor: sortByCercania ? colors.primary : colors.border,
          }]}
          onPress={onSortChange}
        >
          <Ionicons
            name="navigate-outline"
            size={scale(16)}
            color={sortByCercania ? colors.primary : colors.textTertiary}
          />
        </Pressable>
        <Pressable
          style={[styles.viewToggle, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={onViewModeChange}
        >
          <Ionicons
            name={viewMode === 'list' ? 'map-outline' : 'list-outline'}
            size={scale(16)}
            color={colors.primary}
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
    flexDirection: 'row',
    gap: Spacing.xs,
    flex: 1,
  },
  filterChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
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
  },
});
