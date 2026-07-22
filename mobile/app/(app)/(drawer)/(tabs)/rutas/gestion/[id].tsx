import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '@/components/ui/theme-provider';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useRuta,
  useActualizarRuta,
  useQuitarClienteRuta,
  useReordenarRuta } from '@/hooks/use-rutas';
import { listar } from '@/api/clientes.api';
import { agregarClienteRuta } from '@/api/rutas.api';
import { ScreenContainer } from '@/components/ui/screen-container';
import { PageHeader } from '@/components/ui/page-header';
import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import EmptyState from '@/components/ui/empty-state';
import LoadingScreen from '@/components/ui/loading-screen';
import { useToast } from '@/components/ui/toast';
import { FontSize, FontWeight, Spacing, BorderRadius, scale} from '@/constants/theme';
export default function GestionRutaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colorScheme, colors } = useTheme();
  const { showToast } = useToast();

  const { data: ruta, isLoading, refetch } = useRuta(id ?? '');
  const { mutateAsync: actualizar, isPending: actualizando } = useActualizarRuta();
  const { mutateAsync: quitarCliente } = useQuitarClienteRuta(id ?? '');
  const { mutateAsync: reordenar } = useReordenarRuta(id ?? '');

  const [nombre, setNombre] = useState('');
  const [clientes, setClientes] = useState<{ id: string; orden: number; cliente: { id: string; nombre: string; apellido?: string | null } }[]>([]);
  const [dirty, setDirty] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [addResults, setAddResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);

  const addSearchRef = useRef<TextInput>(null);

  useEffect(() => {
    if (ruta) {
      setNombre(ruta.nombre);
      if ((ruta as any).clientes) {
        setClientes([...(ruta as any).clientes].sort((a: any, b: any) => a.orden - b.orden));
      }
    }
  }, [ruta]);

  const handleSave = useCallback(async () => {
    if (!nombre.trim()) return;
    try {
      await actualizar({ id: id!, data: { nombre: nombre.trim() } });
      showToast('Nombre actualizado', 'success');
      setDirty(false);
    } catch (err: any) {
      showToast(err?.message || 'Error al actualizar', 'error');
    }
  }, [nombre, id, actualizar, showToast]);

  const handleReorder = useCallback(async (rcId: string, direction: 'up' | 'down') => {
    const idx = clientes.findIndex((c) => c.id === rcId);
    if (idx === -1) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= clientes.length) return;

    const reordered = [...clientes];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    const withOrden = reordered.map((c, i) => ({ ...c, orden: i + 1 }));
    setClientes(withOrden);

    try {
      await reordenar({ orden: withOrden.map((c) => ({ id: c.id, orden: c.orden })) });
      showToast('Orden actualizado', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Error al reordenar', 'error');
    }
  }, [clientes, reordenar, showToast]);

  const handleRemove = useCallback(async () => {
    if (!removeId) return;
    try {
      await quitarCliente(removeId);
      setClientes((prev) => prev.filter((c) => c.id !== removeId));
      showToast('Cliente quitado', 'success');
      setRemoveId(null);
    } catch (err: any) {
      showToast(err?.message || 'Error al quitar cliente', 'error');
    }
  }, [removeId, quitarCliente, showToast]);

  const handleAddSearch = useCallback(async (text: string) => {
    setAddSearch(text);
    if (text.length < 2) {
      setAddResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await listar({ search: text, limit: 10 });
      setAddResults(res.data.filter(
        (c: any) => !clientes.some((rc) => rc.cliente.id === c.id),
      ));
    } catch {
      setAddResults([]);
    } finally {
      setSearching(false);
    }
  }, [clientes]);

  const handleAddCliente = useCallback(async (clienteId: string) => {
    try {
      await agregarClienteRuta(id!, { clienteId });
      showToast('Cliente agregado', 'success');
      setShowAdd(false);
      setAddSearch('');
      setAddResults([]);
      refetch();
    } catch (err: any) {
      showToast(err?.message || 'Error al agregar cliente', 'error');
    }
  }, [id, showToast, refetch]);

  const renderHeader = useCallback(() => (
    <>
      {/* Compact Info Section */}
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Información</Text>
          {dirty && (
            <Pressable
              style={[styles.saveBtn, { backgroundColor: colors.primary }]}
              onPress={handleSave}
              disabled={actualizando}
            >
              {actualizando ? (
                <Text style={styles.saveBtnText}>...</Text>
              ) : (
                <Text style={styles.saveBtnText}>Guardar</Text>
              )}
            </Pressable>
          )}
        </View>
        <View style={styles.nameRow}>
          <TextInput
            style={[styles.nameInput, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
            value={nombre}
            onChangeText={(t) => { setNombre(t); setDirty(true); }}
            placeholder="Nombre de la ruta"
            placeholderTextColor={colors.textTertiary}
          />
        </View>
      </View>

      {/* Client Section Header */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Clientes ({clientes.length})
          </Text>
          <Pressable
            style={[styles.addBtn, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
            onPress={() => setShowAdd(true)}
          >
            <Ionicons name="add" size={scale(16)} color={colors.primary} />
            <Text style={[styles.addBtnText, { color: colors.primary }]}>Agregar</Text>
          </Pressable>
        </View>
      </View>
    </>
  ), [colors, nombre, dirty, actualizando, handleSave, clientes.length]);

  const renderItem = useCallback(({ item, index }: { item: any; index: number }) => (
    <View
      style={[styles.clienteRow, { borderBottomColor: colors.border }]}
    >
      <View style={styles.clienteOrder}>
        <Text style={[styles.orderNum, { color: colors.textTertiary }]}>{item.orden}</Text>
      </View>
      <View style={styles.clienteInfo}>
        <Text style={[styles.clienteName, { color: colors.text }]}>
          {item.cliente.nombre} {item.cliente.apellido || ''}
        </Text>
      </View>
      <View style={styles.clienteActions}>
        <Pressable
          onPress={() => handleReorder(item.id, 'up')}
          disabled={index === 0}
          hitSlop={8}
        >
          <Ionicons
            name="chevron-up"
            size={scale(18)}
            color={index === 0 ? colors.disabled : colors.primary}
          />
        </Pressable>
        <Pressable
          onPress={() => handleReorder(item.id, 'down')}
          disabled={index === clientes.length - 1}
          hitSlop={8}
        >
          <Ionicons
            name="chevron-down"
            size={scale(18)}
            color={index === clientes.length - 1 ? colors.disabled : colors.primary}
          />
        </Pressable>
        <Pressable onPress={() => setRemoveId(item.id)} hitSlop={8}>
          <Ionicons name="trash-outline" size={scale(18)} color={colors.error} />
        </Pressable>
      </View>
    </View>
  ), [colors, clientes.length, handleReorder]);

  if (isLoading) return <LoadingScreen message="Cargando..." />;
  if (!ruta) return null;

  return (
    <ScreenContainer>
      <PageHeader title="Gestión de Ruta" />

      <FlatList
        data={clientes}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptySection}>
            <EmptyState
              icon="people-outline"
              title="Sin clientes"
              subtitle="Agrega clientes a esta ruta"
            />
          </View>
        }
      />

      {/* Add Client Modal */}
      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <KeyboardAvoidingView
          style={styles.addKav}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={styles.addBackdrop} onPress={() => setShowAdd(false)} />
          <Pressable style={[styles.addModal, { backgroundColor: colors.surfaceElevated }]} onPress={() => {}}>
            <ScrollView keyboardShouldPersistTaps="handled" style={styles.addModalScroll}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Agregar Cliente</Text>
              <View style={[styles.searchInput, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="search" size={scale(18)} color={colors.textTertiary} />
                <TextInput
                  ref={addSearchRef}
                  style={[styles.searchField, { color: colors.text }]}
                  placeholder="Buscar cliente..."
                  placeholderTextColor={colors.textTertiary}
                  value={addSearch}
                  onChangeText={handleAddSearch}
                  autoCapitalize="none"
                  autoFocus
                />
              </View>
              {addResults.map((item) => (
                <Pressable
                  key={item.id}
                  style={[styles.resultRow, { borderBottomColor: colors.border }]}
                  onPress={() => handleAddCliente(item.id)}
                >
                  <Ionicons name="person-outline" size={scale(18)} color={colors.textSecondary} />
                  <Text style={[styles.resultName, { color: colors.text }]}>
                    {item.nombre} {item.apellido || ''}
                  </Text>
                  <Ionicons name="add-circle-outline" size={scale(18)} color={colors.primary} />
                </Pressable>
              ))}
              {searching && (
                <Text style={[styles.searchStatus, { color: colors.textTertiary }]}>Buscando...</Text>
              )}
              {!searching && addSearch.length >= 2 && addResults.length === 0 && (
                <Text style={[styles.searchStatus, { color: colors.textTertiary }]}>Sin resultados</Text>
              )}
              <AppButton title="Cerrar" variant="ghost" onPress={() => setShowAdd(false)} />
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <ConfirmDialog
        visible={!!removeId}
        title="Quitar cliente"
        message="¿Quitar este cliente de la ruta?"
        confirmLabel="Quitar"
        destructive
        onConfirm={handleRemove}
        onCancel={() => setRemoveId(null)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  listContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  section: {
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  nameInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.sm,
  },
  saveBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.sm,
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  addBtnText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  emptySection: {
    marginTop: Spacing.md,
  },
  clienteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  clienteOrder: {
    width: scale(24),
    alignItems: 'center',
  },
  orderNum: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  clienteInfo: {
    flex: 1,
  },
  clienteName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  clienteActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  addKav: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  addBackdrop: {
    flex: 1,
  },
  addModal: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    maxHeight: '80%',
    gap: Spacing.md,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  addModalScroll: {
    maxHeight: '100%',
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  searchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
  },
  searchField: {
    flex: 1,
    fontSize: FontSize.md,
    paddingVertical: Spacing.sm,
  },
  resultsList: {
    maxHeight: scale(300),
  },
  searchStatus: {
    textAlign: 'center',
    paddingVertical: Spacing.md,
    fontSize: FontSize.sm,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  resultName: {
    flex: 1,
    fontSize: FontSize.sm,
  },
});
