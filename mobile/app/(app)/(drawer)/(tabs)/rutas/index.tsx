import { useCallback, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/components/ui/theme-provider';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useRutas, useEliminarRuta, useCrearRuta, useUsuarios, useAsignarUsuarioRuta } from '@/hooks/use-rutas';
import { useAuthStore } from '@/store/auth.store';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import EmptyState from '@/components/ui/empty-state';
import { ScreenContainer } from '@/components/ui/screen-container';
import { SkeletonCard } from '@/components/ui/skeleton';
import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import { FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
const ROL_ADMIN = 'ADMIN';

export default function RutasListScreen() {
  const { colorScheme, colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.rol === 'SUPERADMIN' || user?.rol === ROL_ADMIN;

  const { data: rutas, isLoading, error, refetch, isFetching } = useRutas();
  const { mutateAsync: eliminar } = useEliminarRuta();
  const { mutateAsync: crear } = useCrearRuta();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [asignarRutaId, setAsignarRutaId] = useState<string | null>(null);
  const [asignarUsuarioId, setAsignarUsuarioId] = useState('');

  const { data: usuarios } = useUsuarios();
  const { mutateAsync: asignarUsuario } = useAsignarUsuarioRuta();

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await crear({ nombre: newName.trim(), descripcion: newDesc.trim() || undefined });
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Error al crear ruta');
    } finally {
      setCreating(false);
    }
  }, [newName, newDesc, crear]);

  const handleDelete = useCallback(async () => {
    if (!deleteId) return;
    try {
      await eliminar(deleteId);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Error al eliminar ruta');
    } finally {
      setDeleteId(null);
    }
  }, [deleteId, eliminar]);

  const handleAsignarUsuario = useCallback(async () => {
    if (!asignarRutaId || !asignarUsuarioId) return;
    try {
      await asignarUsuario({ rutaId: asignarRutaId, usuarioId: asignarUsuarioId });
      setAsignarRutaId(null);
      setAsignarUsuarioId('');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Error al asignar cobrador');
    }
  }, [asignarRutaId, asignarUsuarioId, asignarUsuario]);

  const renderRuta = useCallback(
    ({ item }: { item: any }) => (
      <Pressable
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => router.push(`/rutas/${item.id}`)}
        onLongPress={() => isAdmin && setDeleteId(item.id)}
        accessibilityRole="button"
        accessibilityLabel={`Ruta ${item.nombre}, ${item.clientes?.length ?? 0} clientes`}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.cardIcon, { backgroundColor: colors.routeBg }]}>
            <Ionicons name="map-outline" size={20} color={colors.route} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>
              {item.nombre}
            </Text>
            {item.descripcion && (
              <Text style={[styles.cardDesc, { color: colors.textSecondary }]} numberOfLines={1}>
                {item.descripcion}
              </Text>
            )}
          </View>
          {!item.activa && (
            <View style={[styles.inactiveBadge, { backgroundColor: colors.errorLight }]}>
              <Text style={[styles.inactiveText, { color: colors.error }]}>Inactiva</Text>
            </View>
          )}
        </View>
        <View style={styles.cardFooter}>
          <View style={styles.footerLeft}>
            {item.usuario && (
              <Pressable
                style={styles.cobradorRow}
                onPress={() => {
                  if (isAdmin) {
                    setAsignarRutaId(item.id);
                    setAsignarUsuarioId(item.usuario?.id || '');
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel={`Cobrador: ${item.usuario.nombre}`}
              >
                <Ionicons name="person-outline" size={12} color={isAdmin ? colors.primary : colors.textTertiary} />
                <Text style={[styles.cobradorText, { color: isAdmin ? colors.primary : colors.textTertiary }]}>
                  {item.usuario.nombre}
                </Text>
                {isAdmin && <Ionicons name="chevron-forward" size={12} color={colors.primary} />}
              </Pressable>
            )}
            {isAdmin && !item.usuario && (
              <Pressable
                style={styles.cobradorRow}
                onPress={() => {
                  setAsignarRutaId(item.id);
                  setAsignarUsuarioId('');
                }}
                accessibilityRole="button"
                accessibilityLabel="Asignar cobrador"
              >
                <Ionicons name="person-add-outline" size={12} color={colors.primary} />
                <Text style={[styles.cobradorText, { color: colors.primary }]}>
                  Asignar cobrador
                </Text>
              </Pressable>
            )}
          </View>
          <View style={styles.clientCount}>
            <Ionicons name="people-outline" size={12} color={colors.textTertiary} />
            <Text style={[styles.clientCountText, { color: colors.textTertiary }]}>
              {item.clientes?.length ?? 0} clientes
            </Text>
          </View>
        </View>
      </Pressable>
    ),
    [colors, isAdmin],
  );

  if (isLoading) {
    return (
      <ScreenContainer>
        <View style={styles.list}>
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} lines={3} style={{ marginBottom: 12 }} />
          ))}
        </View>
      </ScreenContainer>
    );
  }

  if (error) {
    return (
      <ScreenContainer>
        <EmptyState
          icon="alert-circle-outline"
          title="Error al cargar rutas"
          subtitle={error?.message || 'Error de conexión'}
          actionLabel="Reintentar"
          onAction={() => refetch()}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <FlatList
        data={rutas ?? []}
        keyExtractor={(item) => item.id}
        renderItem={renderRuta}
        contentContainerStyle={styles.list}
        accessibilityRole="list"
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={refetch}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="map-outline"
            title="Sin rutas"
            subtitle="No hay rutas de cobro creadas todavía"
            actionLabel={isAdmin ? 'Crear ruta' : undefined}
            onAction={isAdmin ? () => setShowCreate(true) : undefined}
          />
        }
      />

      {showCreate && (
        <Pressable style={styles.overlay} onPress={() => setShowCreate(false)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardAvoid}
          >
            <Pressable style={[styles.modal, { backgroundColor: colors.surfaceElevated }]} onPress={() => {}}>
              <ScrollView keyboardShouldPersistTaps="handled">
                <Text style={[styles.modalTitle, { color: colors.text }]}>Nueva Ruta</Text>
                <AppInput
                  label="Nombre *"
                  placeholder="Nombre de la ruta"
                  value={newName}
                  onChangeText={setNewName}
                />
                <AppInput
                  label="Descripción"
                  placeholder="Descripción opcional"
                  value={newDesc}
                  onChangeText={setNewDesc}
                  multiline
                  numberOfLines={3}
                />
                <View style={styles.modalActions}>
                  <AppButton
                    title="Cancelar"
                    variant="ghost"
                    onPress={() => setShowCreate(false)}
                  />
                  <AppButton
                    title="Crear"
                    loading={creating}
                    disabled={!newName.trim()}
                    onPress={handleCreate}
                  />
                </View>
              </ScrollView>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      )}

      <ConfirmDialog
        visible={!!deleteId}
        title="Eliminar ruta"
        message="¿Estás seguro de desactivar esta ruta?"
        confirmLabel="Eliminar"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />

      {/* Cobrador Assignment Modal */}
      {asignarRutaId && (
        <Pressable style={styles.overlay} onPress={() => setAsignarRutaId(null)}>
          <Pressable style={[styles.modal, { backgroundColor: colors.surfaceElevated }]} onPress={() => {}}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Asignar Cobrador</Text>
            {usuarios?.map((u) => (
              <Pressable
                key={u.id}
                style={[styles.usuarioRow, { borderBottomColor: colors.border }]}
                onPress={() => setAsignarUsuarioId(u.id)}
              >
                <Ionicons
                  name={asignarUsuarioId === u.id ? 'radio-button-on' : 'radio-button-off'}
                  size={18}
                  color={asignarUsuarioId === u.id ? colors.primary : colors.textTertiary}
                />
                <Text style={[styles.usuarioName, { color: colors.text }]}>{u.nombre}</Text>
                <Text style={[styles.usuarioRol, { color: colors.textTertiary }]}>{u.rol}</Text>
              </Pressable>
            ))}
            <View style={styles.modalActions}>
              <AppButton title="Cancelar" variant="ghost" onPress={() => setAsignarRutaId(null)} />
              <AppButton
                title="Asignar"
                disabled={!asignarUsuarioId}
                onPress={handleAsignarUsuario}
              />
            </View>
          </Pressable>
        </Pressable>
      )}

      {isAdmin && (
        <Pressable
          style={[styles.fab, { backgroundColor: colors.primary }]}
          onPress={() => setShowCreate(true)}
          accessibilityRole="button"
          accessibilityLabel="Crear ruta"
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </Pressable>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: Spacing.md,
    paddingBottom: 100,
  },
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  cardDesc: {
    fontSize: FontSize.sm,
    marginTop: 1,
  },
  inactiveBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  inactiveText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'transparent',
  },
  footerLeft: {
    flex: 1,
  },
  cobradorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cobradorText: {
    fontSize: FontSize.xs,
  },
  clientCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  clientCountText: {
    fontSize: FontSize.xs,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    zIndex: 100,
  },
  keyboardAvoid: {
    justifyContent: 'center',
  },
  modal: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  usuarioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  usuarioName: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  usuarioRol: {
    fontSize: FontSize.xs,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
