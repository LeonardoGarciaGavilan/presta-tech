import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '@/components/ui/theme-provider';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useRuta, useVistaDia, useGenerarDia } from '@/hooks/use-rutas';
import { ScreenContainer } from '@/components/ui/screen-container';
import { AppButton } from '@/components/ui/app-button';
import DatePickerField from '@/components/ui/date-picker-field';
import EmptyState from '@/components/ui/empty-state';
import LoadingScreen from '@/components/ui/loading-screen';
import { useToast } from '@/components/ui/toast';
import { FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function GenerarDiaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colorScheme, colors } = useTheme();
  const { showToast } = useToast();

  const today = formatDate(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'todos' | 'pendientes' | 'visitados'>('todos');
  const [showDatePicker, setShowDatePicker] = useState(false);

  function displayDate(iso: string): string {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('es-DO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  const { data: ruta } = useRuta(id ?? '');
  const { data: vistaDia, isLoading } = useVistaDia(id ?? '', selectedDate);
  const { mutateAsync: generar, isPending: generando } = useGenerarDia(id ?? '');

  const clientes = useMemo(() => {
    if (!vistaDia?.clientes) return [];
    let items = [...vistaDia.clientes].sort((a, b) => a.orden - b.orden);
    if (filter === 'pendientes') items = items.filter((c) => !c.visitadoHoy);
    if (filter === 'visitados') items = items.filter((c) => c.visitadoHoy);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (c) =>
          c.cliente.nombre.toLowerCase().includes(q) ||
          (c.cliente.apellido || '').toLowerCase().includes(q) ||
          (c.cliente.telefono || '').includes(q),
      );
    }
    return items;
  }, [vistaDia, filter, search]);

  const toggleAll = useCallback(() => {
    if (selectedIds.size === clientes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(clientes.map((c) => c.rutaClienteId)));
    }
  }, [selectedIds, clientes]);

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleGenerate = useCallback(async () => {
    if (selectedIds.size === 0) {
      showToast('Selecciona al menos un cliente', 'error');
      return;
    }
    try {
      await generar({
        rutaClienteIds: Array.from(selectedIds),
        fecha: selectedDate,
      });
      showToast(`Ruta del día generada (${selectedIds.size} clientes)`, 'success');
      router.back();
    } catch (err: any) {
      showToast(err?.message || 'Error al generar ruta del día', 'error');
    }
  }, [selectedIds, selectedDate, generar, showToast]);

  useEffect(() => {
    if (vistaDia?.clientes) {
      const pendientes = vistaDia.clientes.filter((c) => !c.visitadoHoy);
      setSelectedIds(new Set(pendientes.map((c) => c.rutaClienteId)));
    }
  }, [vistaDia]);

  if (isLoading) return <LoadingScreen message="Cargando..." />;
  if (!ruta) return null;

  return (
    <ScreenContainer>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Generar Ruta del Día',
          headerTintColor: colors.primary,
          headerStyle: { backgroundColor: colors.background },
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.kav}
      >
        <View style={styles.content}>
          {/* Date compact row */}
          <View style={styles.dateRow}>
            <View style={styles.dateShortcuts}>
              <Pressable
                style={[styles.dateShortcut, { backgroundColor: selectedDate === today ? colors.primaryLight : colors.surface, borderColor: selectedDate === today ? colors.primary : colors.border }]}
                onPress={() => setSelectedDate(today)}
              >
                <Text style={[styles.dateShortcutText, { color: selectedDate === today ? colors.primary : colors.textSecondary }]}>Hoy</Text>
              </Pressable>
              <Pressable
                style={[styles.dateShortcut, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 1);
                  setSelectedDate(formatDate(d));
                }}
              >
                <Text style={[styles.dateShortcutText, { color: colors.textSecondary }]}>Mañana</Text>
              </Pressable>
              <Pressable
                style={[styles.dateShortcut, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + (d.getDay() === 0 ? 1 : 8 - d.getDay()));
                  setSelectedDate(formatDate(d));
                }}
              >
                <Text style={[styles.dateShortcutText, { color: colors.textSecondary }]}>Próx.</Text>
              </Pressable>
            </View>
            <Text style={[styles.dateText, { color: colors.text }]}>
              📅 {displayDate(selectedDate)}
            </Text>
            <Pressable onPress={() => setShowDatePicker(true)} hitSlop={8}>
              <Text style={[styles.dateChangeBtn, { color: colors.primary }]}>Cambiar</Text>
            </Pressable>
          </View>

          {showDatePicker && (
            <View style={styles.datePickerInline}>
              <DatePickerField
                label="Fecha de la ruta"
                value={selectedDate}
                onChange={(d) => { setSelectedDate(d); setShowDatePicker(false); }}
              />
            </View>
          )}

          {/* Search + Select All */}
          <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="search-outline" size={16} color={colors.textTertiary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Buscar cliente..."
              placeholderTextColor={colors.textTertiary}
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
              </Pressable>
            )}
            {clientes.length > 0 && (
              <Pressable onPress={toggleAll} hitSlop={8}>
                <Ionicons
                  name={selectedIds.size === clientes.length ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={selectedIds.size === clientes.length ? colors.primary : colors.textTertiary}
                />
              </Pressable>
            )}
          </View>

          {/* Filter pills */}
          <View style={styles.filterRow}>
            {(['todos', 'pendientes', 'visitados'] as const).map((f) => (
              <Pressable
                key={f}
                style={[styles.filterChip, {
                  backgroundColor: filter === f ? colors.primaryLight : colors.surface,
                  borderColor: filter === f ? colors.primary : colors.border,
                }]}
                onPress={() => setFilter(f)}
              >
                <Text style={[styles.filterChipText, { color: filter === f ? colors.primary : colors.textSecondary }]}>
                  {f === 'todos' ? 'Todos' : f === 'pendientes' ? 'Pendientes' : 'Visitados'}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Client List */}
          <FlatList
            data={clientes}
            keyExtractor={(item) => item.rutaClienteId}
            style={{ flex: 1 }}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => <View style={{ height: 2 }} />}
            ListEmptyComponent={
              <EmptyState
                icon="people-outline"
                title="Sin clientes"
                subtitle="No hay clientes asignados a esta ruta"
              />
            }
            renderItem={({ item }) => {
              const isSelected = selectedIds.has(item.rutaClienteId);
              return (
                <Pressable
                  style={[
                    styles.clienteItem,
                    {
                      backgroundColor: isSelected ? colors.primaryLight : colors.surface,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => toggleOne(item.rutaClienteId)}
                >
                  <View style={styles.clienteCheck}>
                    <Ionicons
                      name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={22}
                      color={isSelected ? colors.primary : colors.textTertiary}
                    />
                  </View>
                  <View style={styles.clienteOrder}>
                    <Text style={[styles.orderNum, { color: colors.textTertiary }]}>{item.orden}</Text>
                  </View>
                  <View style={styles.clienteInfo}>
                    <Text style={[styles.clienteName, { color: colors.text }]}>
                      {item.cliente.nombre} {item.cliente.apellido || ''}
                    </Text>
                    {item.cliente.telefono && (
                      <Text style={[styles.clientePhone, { color: colors.textTertiary }]}>
                        {item.cliente.telefono}
                      </Text>
                    )}
                  </View>
                  {item.totalACobrar > 0 && (
                    <Text style={[styles.clienteMonto, { color: item.tieneAtrasados ? colors.error : colors.success }]}>
                      ${item.totalACobrar}
                    </Text>
                  )}
                </Pressable>
              );
            }}
          />
        </View>
      </KeyboardAvoidingView>

      {/* Bottom Bar */}
      <View style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <AppButton
          title={`Generar ruta (${selectedIds.size})`}
          loading={generando}
          disabled={selectedIds.size === 0}
          onPress={handleGenerate}
          icon="calendar-outline"
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  kav: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: Spacing.sm,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  dateShortcuts: {
    flexDirection: 'row',
    gap: 2,
  },
  dateShortcut: {
    paddingHorizontal: Spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  dateShortcutText: {
    fontSize: 11,
    fontWeight: FontWeight.medium,
  },
  dateText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    flex: 1,
    textAlign: 'center',
  },
  dateChangeBtn: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  datePickerInline: {
    marginBottom: Spacing.xs,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.sm,
    paddingVertical: Spacing.xs + 2,
  },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  filterChip: {
    paddingHorizontal: Spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: FontWeight.medium,
  },
  list: {
    paddingBottom: 100,
  },
  clienteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.sm,
  },
  clienteCheck: {
    width: 24,
    alignItems: 'center',
  },
  clienteOrder: {
    width: 20,
    alignItems: 'center',
  },
  orderNum: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  clienteInfo: {
    flex: 1,
  },
  clienteName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  clientePhone: {
    fontSize: FontSize.xs,
    marginTop: 0,
  },
  clienteMonto: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  bottomBar: {
    padding: Spacing.sm,
    borderTopWidth: 1,
  },
});
