import { useCallback, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { FontSize, FontWeight, Spacing, BorderRadius, Shadows, scale } from '@/constants/theme';
import { useAuthStore } from '@/store/auth.store';
import { useUsuarios,
  useCrearUsuario,
  useActualizarUsuario,
  useResetPassword } from '@/hooks/use-usuarios';
import { crearUsuarioSchema, editarUsuarioSchema, type CrearUsuarioFormData } from '@/schemas/usuario.schema';
import type { Usuario } from '@/api/usuarios.api';
import { AppInput } from '@/components/ui/app-input';
import { AppButton } from '@/components/ui/app-button';
import SearchBar from '@/components/ui/search-bar';
import PickerField from '@/components/ui/picker-field';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { useTheme } from '@/components/ui/theme-provider';

const ROL_OPTIONS = ['ADMIN', 'EMPLEADO'];
const ESTADO_OPTIONS = ['Todos', 'Activos', 'Inactivos'];

function Avatar({ nombre, size = 40 }: { nombre: string; size?: number }) {
  const { colorScheme, colors } = useTheme();

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text style={{ color: colors.primary, fontSize: size * 0.4, fontWeight: FontWeight.bold }}>
        {(nombre || 'U')[0].toUpperCase()}
      </Text>
    </View>
  );
}

function RolBadge({ rol }: { rol: string }) {
  const { colorScheme, colors } = useTheme();
  const isAdmin = rol === 'ADMIN';

  return (
    <View
      style={{
        backgroundColor: isAdmin ? colors.primaryLight : colors.surfaceElevated,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 2,
        borderRadius: BorderRadius.sm,
        borderWidth: 1,
        borderColor: isAdmin ? colors.primary : colors.border,
      }}
    >
      <Text
        style={{
          fontSize: FontSize.xs,
          fontWeight: FontWeight.semibold,
          color: isAdmin ? colors.primary : colors.textSecondary,
        }}
      >
        {isAdmin ? 'Admin' : 'Empleado'}
      </Text>
    </View>
  );
}

function PasswordBadge({ temporal }: { temporal: boolean }) {
  const { colorScheme, colors } = useTheme();

  return (
    <View
      style={{
        backgroundColor: temporal ? colors.warningLight : colors.surfaceElevated,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 2,
        borderRadius: BorderRadius.sm,
        borderWidth: 1,
        borderColor: temporal ? colors.warning : colors.border,
      }}
    >
      <Text
        style={{
          fontSize: FontSize.xs,
          fontWeight: FontWeight.semibold,
          color: temporal ? colors.warning : colors.textTertiary,
        }}
      >
        {temporal ? 'Temporal' : 'Configurada'}
      </Text>
    </View>
  );
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function UsuariosScreen() {
  const { colorScheme, colors } = useTheme();
  const currentUser = useAuthStore((s) => s.user);
  const { showToast } = useToast();

  const { data: usuarios, isLoading } = useUsuarios();
  const crearMutation = useCrearUsuario();
  const actualizarMutation = useActualizarUsuario();
  const resetMutation = useResetPassword();

  const [search, setSearch] = useState('');
  const [filtroRol, setFiltroRol] = useState<string>('Todos');
  const [filtroEstado, setFiltroEstado] = useState<string>('Todos');

  const [showCrear, setShowCrear] = useState(false);
  const [crearForm, setCrearForm] = useState<CrearUsuarioFormData>({ nombre: '', email: '', rol: 'EMPLEADO' });
  const [crearErrors, setCrearErrors] = useState<Record<string, string>>({});
  const [crearResult, setCrearResult] = useState<{ passwordTemporal: string } | null>(null);

  const [editUser, setEditUser] = useState<Usuario | null>(null);
  const [editForm, setEditForm] = useState({ nombre: '', rol: '' as string, activo: true });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  const [resetTarget, setResetTarget] = useState<Usuario | null>(null);
  const [resetResult, setResetResult] = useState<{ passwordTemporal: string } | null>(null);

  const [toggleTarget, setToggleTarget] = useState<Usuario | null>(null);

  const usuariosFiltrados = useMemo(() => {
    if (!usuarios) return [];
    return usuarios.filter((u) => {
      const matchSearch =
        !search ||
        u.nombre.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase());
      const matchRol = filtroRol === 'Todos' || u.rol === filtroRol;
      const matchEstado =
        filtroEstado === 'Todos' ||
        (filtroEstado === 'Activos' && u.activo) ||
        (filtroEstado === 'Inactivos' && !u.activo);
      return matchSearch && matchRol && matchEstado;
    });
  }, [usuarios, search, filtroRol, filtroEstado]);

  const stats = useMemo(() => {
    if (!usuarios) return { total: 0, activos: 0, admins: 0 };
    return {
      total: usuarios.length,
      activos: usuarios.filter((u) => u.activo).length,
      admins: usuarios.filter((u) => u.rol === 'ADMIN').length,
    };
  }, [usuarios]);

  const handleCrear = useCallback(async () => {
    const parsed = crearUsuarioSchema.safeParse(crearForm);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        errs[issue.path[0] as string] = issue.message;
      }
      setCrearErrors(errs);
      return;
    }
    setCrearErrors({});
    try {
      const result = await crearMutation.mutateAsync(parsed.data);
      setCrearResult({ passwordTemporal: result.passwordTemporal });
      showToast('Usuario creado exitosamente', 'success');
    } catch {
      showToast('Error al crear el usuario', 'error');
    }
  }, [crearForm, crearMutation, showToast]);

  const openEditar = useCallback((u: Usuario) => {
    setEditUser(u);
    setEditForm({ nombre: u.nombre, rol: u.rol, activo: u.activo });
    setEditErrors({});
  }, []);

  const handleEditar = useCallback(async () => {
    if (!editUser) return;
    const parsed = editarUsuarioSchema.safeParse(editForm);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        errs[issue.path[0] as string] = issue.message;
      }
      setEditErrors(errs);
      return;
    }
    setEditErrors({});
    try {
      await actualizarMutation.mutateAsync({ id: editUser.id, data: parsed.data });
      setEditUser(null);
      showToast('Usuario actualizado correctamente', 'success');
    } catch {
      showToast('Error al actualizar el usuario', 'error');
    }
  }, [editUser, editForm, actualizarMutation, showToast]);

  const handleToggleActivo = useCallback(async () => {
    if (!toggleTarget) return;
    if (toggleTarget.id === currentUser?.id) {
      showToast('No puedes desactivar tu propia cuenta', 'error');
      setToggleTarget(null);
      return;
    }
    try {
      await actualizarMutation.mutateAsync({
        id: toggleTarget.id,
        data: { activo: !toggleTarget.activo },
      });
      showToast(`Usuario ${!toggleTarget.activo ? 'activado' : 'desactivado'} correctamente`, 'success');
    } catch {
      showToast('Error al actualizar el usuario', 'error');
    }
    setToggleTarget(null);
  }, [toggleTarget, currentUser, actualizarMutation, showToast]);

  const handleResetPassword = useCallback(async () => {
    if (!resetTarget) return;
    try {
      const result = await resetMutation.mutateAsync(resetTarget.id);
      setResetResult({ passwordTemporal: result.passwordTemporal });
      showToast('Contraseña reseteada', 'success');
    } catch {
      showToast('Error al resetear la contraseña', 'error');
    }
  }, [resetTarget, resetMutation, showToast]);

  const closeCrear = useCallback(() => {
    setShowCrear(false);
    setCrearForm({ nombre: '', email: '', rol: 'EMPLEADO' });
    setCrearErrors({});
    setCrearResult(null);
  }, []);

  const renderUsuario = useCallback(
    ({ item }: { item: Usuario }) => (
      <View
        style={[
          styles.userCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.userCardTop}>
          <Avatar nombre={item.nombre} />
          <View style={styles.userInfo}>
            <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
              {item.nombre}
            </Text>
            <Text style={[styles.userEmail, { color: colors.textTertiary }]} numberOfLines={1}>
              {item.email}
            </Text>
          </View>
          <View style={styles.userBadges}>
            <RolBadge rol={item.rol} />
            <PasswordBadge temporal={item.debeCambiarPassword} />
          </View>
        </View>

        <View style={styles.userCardBottom}>
          <Text style={[styles.userDate, { color: colors.textTertiary }]}>
            Creado: {formatDate(item.createdAt)}
          </Text>
          <View style={styles.userActions}>
            <Pressable
              onPress={() => openEditar(item)}
              hitSlop={8}
              style={[styles.actionBtn, { backgroundColor: colors.primaryLight }]}
            >
              <Ionicons name="create-outline" size={scale(18)} color={colors.primary} />
            </Pressable>
            <Pressable
              onPress={() => setResetTarget(item)}
              hitSlop={8}
              style={[styles.actionBtn, { backgroundColor: colors.warningLight }]}
            >
              <Ionicons name="key-outline" size={scale(18)} color={colors.warning} />
            </Pressable>
            <Pressable
              onPress={() => {
                if (item.id === currentUser?.id) {
                  showToast('No puedes desactivar tu propia cuenta', 'error');
                  return;
                }
                setToggleTarget(item);
              }}
              hitSlop={8}
              style={[
                styles.actionBtn,
                { backgroundColor: item.activo ? colors.errorLight : colors.successLight },
              ]}
            >
              <Ionicons
                name={item.activo ? 'close-outline' : 'checkmark-outline'}
                size={scale(18)}
                color={item.activo ? colors.error : colors.success}
              />
            </Pressable>
          </View>
        </View>
      </View>
    ),
    [colors, currentUser, openEditar, showToast],
  );

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.scrollContent}>
          <Skeleton height={80} style={{ marginBottom: Spacing.md }} />
          <Skeleton height={48} style={{ marginBottom: Spacing.md }} />
          <Skeleton height={100} style={{ marginBottom: Spacing.sm }} />
          <Skeleton height={100} style={{ marginBottom: Spacing.sm }} />
          <Skeleton height={100} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
      >
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.primaryLight }]}>
            <Text style={[styles.statNumber, { color: colors.primary }]}>{stats.total}</Text>
            <Text style={[styles.statLabel, { color: colors.primary }]}>Total</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.successLight }]}>
            <Text style={[styles.statNumber, { color: colors.success }]}>{stats.activos}</Text>
            <Text style={[styles.statLabel, { color: colors.success }]}>Activos</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.warningLight }]}>
            <Text style={[styles.statNumber, { color: colors.warning }]}>{stats.admins}</Text>
            <Text style={[styles.statLabel, { color: colors.warning }]}>Admins</Text>
          </View>
        </View>

        <View style={[styles.filtersSection, { backgroundColor: colors.background }]}>
          <SearchBar value={search} onSearch={setSearch} placeholder="Buscar por nombre o email..." />

          <View style={styles.filterRow}>
            <View style={styles.filterItem}>
              <PickerField
                label="Rol"
                value={filtroRol}
                options={ROL_OPTIONS}
                onSelect={setFiltroRol}
                searchable={false}
              />
            </View>
            <View style={styles.filterItem}>
              <PickerField
                label="Estado"
                value={filtroEstado}
                options={ESTADO_OPTIONS}
                onSelect={setFiltroEstado}
                searchable={false}
              />
            </View>
          </View>

          <AppButton
            title="Nuevo usuario"
            onPress={() => setShowCrear(true)}
            icon="add"
            style={[Shadows.md, { marginTop: Spacing.sm }]}
          />
        </View>

        {usuariosFiltrados.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={scale(48)} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
              {search || filtroRol !== 'Todos' || filtroEstado !== 'Todos'
                ? 'No hay usuarios que coincidan con los filtros'
                : 'No hay usuarios registrados'}
            </Text>
          </View>
        ) : (
          usuariosFiltrados.map((item) => (
            <View key={item.id}>{renderUsuario({ item })}</View>
          ))
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>

      {/* Modal Crear */}
      <Modal visible={showCrear} transparent animationType="slide" onRequestClose={closeCrear}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={[styles.modalOverlay, { backgroundColor: colors.overlay }]} onPress={closeCrear}>
            <Pressable style={[styles.modalContent, { backgroundColor: colors.surfaceElevated }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Nuevo usuario</Text>
                <TouchableOpacity onPress={closeCrear} hitSlop={8}>
                  <Ionicons name="close" size={scale(24)} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>

              {crearResult ? (
                <View>
                  <View style={[styles.successBox, { backgroundColor: colors.successLight, borderColor: colors.success }]}>
                    <Ionicons name="checkmark-circle" size={scale(20)} color={colors.success} />
                    <Text style={[styles.successText, { color: colors.success }]}>
                      Usuario creado exitosamente
                    </Text>
                  </View>
                  <Text style={[styles.passwordLabel, { color: colors.textSecondary }]}>
                    Contraseña temporal
                  </Text>
                  <View style={[styles.passwordBox, { backgroundColor: colors.warningLight, borderColor: colors.warning }]}>
                    <Text style={[styles.passwordText, { color: colors.warning }]}>
                      {crearResult.passwordTemporal}
                    </Text>
                  </View>
                  <Text style={[styles.passwordHint, { color: colors.textTertiary }]}>
                    El usuario deberá cambiarla en su primer acceso
                  </Text>
                  <AppButton title="Cerrar" onPress={closeCrear} variant="primary" />
                </View>
              ) : (
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  <AppInput
                    label="Nombre"
                    placeholder="Nombre completo"
                    value={crearForm.nombre}
                    onChangeText={(v) => setCrearForm((p) => ({ ...p, nombre: v }))}
                    error={crearErrors.nombre}
                  />
                  <AppInput
                    label="Correo electrónico"
                    placeholder="usuario@email.com"
                    value={crearForm.email}
                    onChangeText={(v) => setCrearForm((p) => ({ ...p, email: v }))}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    error={crearErrors.email}
                  />
                  <PickerField
                    label="Rol"
                    value={crearForm.rol}
                    options={ROL_OPTIONS}
                    onSelect={(v) => setCrearForm((p) => ({ ...p, rol: v as 'ADMIN' | 'EMPLEADO' }))}
                    searchable={false}
                  />
                  <View style={[styles.infoBox, { backgroundColor: colors.infoLight, borderColor: colors.info }]}>
                    <Ionicons name="information-circle" size={scale(16)} color={colors.info} />
                    <Text style={[styles.infoText, { color: colors.info }]}>
                      Se asignará una contraseña automáticamente
                    </Text>
                  </View>
                  <AppButton
                    title="Crear usuario"
                    onPress={handleCrear}
                    loading={crearMutation.isPending}
                    icon="person-add-outline"
                  />
                </ScrollView>
              )}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Editar */}
      <Modal visible={!!editUser} transparent animationType="slide" onRequestClose={() => setEditUser(null)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={[styles.modalOverlay, { backgroundColor: colors.overlay }]} onPress={() => setEditUser(null)}>
            <Pressable style={[styles.modalContent, { backgroundColor: colors.surfaceElevated }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Editar usuario</Text>
                <TouchableOpacity onPress={() => setEditUser(null)} hitSlop={8}>
                  <Ionicons name="close" size={scale(24)} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <AppInput
                  label="Nombre"
                  placeholder="Nombre completo"
                  value={editForm.nombre}
                  onChangeText={(v) => setEditForm((p) => ({ ...p, nombre: v }))}
                  error={editErrors.nombre}
                />
                <PickerField
                  label="Rol"
                  value={editForm.rol}
                  options={ROL_OPTIONS}
                  onSelect={(v) => setEditForm((p) => ({ ...p, rol: v }))}
                  searchable={false}
                />
                <View style={styles.toggleRow}>
                  <Text style={[styles.toggleLabel, { color: colors.textSecondary }]}>Estado</Text>
                  <TouchableOpacity
                    onPress={() => {
                      if (editUser?.id === currentUser?.id) {
                        showToast('No puedes desactivar tu propia cuenta', 'error');
                        return;
                      }
                      setEditForm((p) => ({ ...p, activo: !p.activo }));
                    }}
                    style={[
                      styles.toggleSwitch,
                      { backgroundColor: editForm.activo ? colors.successLight : colors.errorLight },
                    ]}
                  >
                    <Ionicons
                      name={editForm.activo ? 'checkmark-circle' : 'close-circle'}
                      size={scale(18)}
                      color={editForm.activo ? colors.success : colors.error}
                    />
                    <Text
                      style={{
                        color: editForm.activo ? colors.success : colors.error,
                        fontWeight: FontWeight.semibold,
                        fontSize: FontSize.sm,
                      }}
                    >
                      {editForm.activo ? 'Activo' : 'Inactivo'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <AppButton
                  title="Guardar cambios"
                  onPress={handleEditar}
                  loading={actualizarMutation.isPending}
                  icon="checkmark-outline"
                />
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Confirmación Toggle Activo */}
      <ConfirmDialog
        visible={!!toggleTarget}
        title={toggleTarget?.activo ? 'Desactivar usuario' : 'Activar usuario'}
        message={
          toggleTarget?.activo
            ? `¿Estás seguro de desactivar a ${toggleTarget?.nombre}?`
            : `¿Estás seguro de activar a ${toggleTarget?.nombre}?`
        }
        confirmLabel={toggleTarget?.activo ? 'Desactivar' : 'Activar'}
        destructive={toggleTarget?.activo ?? false}
        onConfirm={handleToggleActivo}
        onCancel={() => setToggleTarget(null)}
        loading={actualizarMutation.isPending}
      />

      {/* Confirmación Reset Password */}
      <Modal visible={!!resetTarget || !!resetResult} transparent animationType="fade" onRequestClose={() => { setResetTarget(null); setResetResult(null); }}>
        <Pressable
          style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}
          onPress={() => { setResetTarget(null); setResetResult(null); }}
        >
          <Pressable style={[styles.modalContent, { backgroundColor: colors.surfaceElevated }]}>
            {resetResult ? (
              <View>
                <View style={[styles.successBox, { backgroundColor: colors.successLight, borderColor: colors.success }]}>
                  <Ionicons name="checkmark-circle" size={scale(20)} color={colors.success} />
                  <Text style={[styles.successText, { color: colors.success }]}>
                    Contraseña reseteada
                  </Text>
                </View>
                <Text style={[styles.passwordLabel, { color: colors.textSecondary }]}>
                  Nueva contraseña temporal
                </Text>
                <View style={[styles.passwordBox, { backgroundColor: colors.warningLight, borderColor: colors.warning }]}>
                  <Text style={[styles.passwordText, { color: colors.warning }]}>
                    {resetResult.passwordTemporal}
                  </Text>
                </View>
                <AppButton title="Cerrar" onPress={() => { setResetTarget(null); setResetResult(null); }} />
              </View>
            ) : (
              <View>
                <Text style={[styles.modalTitle, { color: colors.text, textAlign: 'center', marginBottom: Spacing.sm }]}>
                  Resetear contraseña
                </Text>
                <Text style={[styles.confirmText, { color: colors.textSecondary }]}>
                  ¿Estás seguro de resetear la contraseña de {resetTarget?.nombre}?
                </Text>
                <Text style={[styles.confirmHint, { color: colors.warning }]}>
                  El usuario deberá cambiar la contraseña en su próximo inicio de sesión.
                </Text>
                <View style={styles.modalActions}>
                  <AppButton
                    title="Cancelar"
                    onPress={() => setResetTarget(null)}
                    variant="ghost"
                    style={{ flex: 1 }}
                  />
                  <AppButton
                    title="Resetear"
                    onPress={handleResetPassword}
                    loading={resetMutation.isPending}
                    variant="secondary"
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statCard: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
  },
  statLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    marginTop: scale(2),
  },
  filtersSection: {
    paddingBottom: Spacing.md,
  },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  filterItem: {
    flex: 1,
  },
  userCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  userCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  userEmail: {
    fontSize: FontSize.sm,
    marginTop: scale(1),
  },
  userBadges: {
    flexDirection: 'row',
    gap: Spacing.xs,
    alignItems: 'center',
  },
  userCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'transparent',
  },
  userDate: {
    fontSize: FontSize.xs,
  },
  userActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  actionBtn: {
    width: scale(34),
    height: scale(34),
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  emptyText: {
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  infoText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    flex: 1,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  successText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    flex: 1,
  },
  passwordLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    marginBottom: Spacing.xs,
  },
  passwordBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  passwordText: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    letterSpacing: scale(2),
  },
  passwordHint: {
    fontSize: FontSize.xs,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  toggleLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  toggleSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  confirmText: {
    fontSize: FontSize.md,
    textAlign: 'center',
    marginBottom: Spacing.sm,
    lineHeight: scale(22),
  },
  confirmHint: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    fontWeight: FontWeight.medium,
    marginBottom: Spacing.lg,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
});
