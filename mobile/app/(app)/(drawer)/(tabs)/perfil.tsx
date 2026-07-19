import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useQueryClient } from '@tanstack/react-query';

import { Colors,
  FontSize,
  FontWeight,
  Spacing,
  BorderRadius,
  Shadows } from '@/constants/theme';
import { useAuthStore } from '@/store/auth.store';
import { logout } from '@/api/auth.api';
import { clearSession } from '@/utils/session';
import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import { usePerfil,
  useActualizarNombre,
  useCambiarPassword,
  useActualizarEmpresa } from '@/hooks/use-perfil';
import { SkeletonCard } from '@/components/ui/skeleton';
import { useTheme } from '@/components/ui/theme-provider';
import { SectionCard } from '@/components/ui/section-card';

export default function PerfilScreen() {
  const { colorScheme, colors } = useTheme();
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const isAdmin = user?.rol === 'ADMIN' || user?.rol === 'SUPERADMIN';

  const { data: perfil, isLoading } = usePerfil();
  const actualizarNombreMutation = useActualizarNombre();
  const cambiarPasswordMutation = useCambiarPassword();
  const actualizarEmpresaMutation = useActualizarEmpresa();

  const [nombreForm, setNombreForm] = useState('');
  const [pwActual, setPwActual] = useState('');
  const [pwNuevo, setPwNuevo] = useState('');
  const [pwConfirmar, setPwConfirmar] = useState('');
  const [pwError, setPwError] = useState('');
  const [showPw, setShowPw] = useState({ actual: false, nuevo: false, confirmar: false });
  const [empresaForm, setEmpresaForm] = useState('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (perfil?.usuario?.nombre) {
      setNombreForm(perfil.usuario.nombre);
    }
  }, [perfil?.usuario?.nombre]);

  useEffect(() => {
    if (perfil?.empresa?.nombre) {
      setEmpresaForm(perfil.empresa.nombre);
    }
  }, [perfil?.empresa?.nombre]);

  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const handleGuardarNombre = async () => {
    try {
      await actualizarNombreMutation.mutateAsync({ nombre: nombreForm });
      showToast('Nombre actualizado correctamente');
    } catch {
      showToast('Error al actualizar nombre', 'error');
    }
  };

  const handleCambiarPassword = async () => {
    setPwError('');
    if (!pwActual) {
      setPwError('Debes escribir tu contraseña actual');
      return;
    }
    if (pwNuevo.length < 6) {
      setPwError('La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (pwNuevo !== pwConfirmar) {
      setPwError('Las contraseñas no coinciden');
      return;
    }
    try {
      await cambiarPasswordMutation.mutateAsync({
        passwordActual: pwActual,
        passwordNuevo: pwNuevo,
      });
      showToast('Contraseña cambiada correctamente');
      setPwActual('');
      setPwNuevo('');
      setPwConfirmar('');
    } catch {
      showToast('Error al cambiar la contraseña', 'error');
    }
  };

  const handleGuardarEmpresa = async () => {
    try {
      await actualizarEmpresaMutation.mutateAsync({ nombre: empresaForm });
      showToast('Nombre de empresa actualizado');
    } catch {
      showToast('Error al actualizar empresa', 'error');
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } catch {
      // ignore
    }
    queryClient.clear();
    await clearSession();
  };

  // Toast flotante
  const ToastComp = toast ? (
    <View
      style={[
        styles.toast,
        {
          backgroundColor:
            toast.type === 'success' ? colors.successLight : colors.errorLight,
          borderColor:
            toast.type === 'success' ? colors.success : colors.error,
        },
      ]}
    >
      <Ionicons
        name={toast.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
        size={18}
        color={toast.type === 'success' ? colors.success : colors.error}
      />
      <Text
        style={[
          styles.toastText,
          {
            color:
              toast.type === 'success' ? colors.success : colors.error,
          },
        ]}
      >
        {toast.message}
      </Text>
    </View>
  ) : null;

  return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        {ToastComp}

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        {/* Hero */}
        <View style={[styles.hero, Shadows.md]}>
          <View
            style={[
              styles.heroGradient,
              {
                backgroundColor: colors.primary,
              },
            ]}
          >
            <View style={styles.heroContent}>
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: 'rgba(255,255,255,0.2)' },
                ]}
              >
                <Text style={styles.avatarText}>
                  {(perfil?.usuario?.nombre || user?.email || 'U')[0].toUpperCase()}
                </Text>
              </View>
              <View style={styles.heroInfo}>
                <Text style={styles.heroName}>
                  {perfil?.usuario?.nombre || user?.nombre || 'Sin nombre'}
                </Text>
                <Text style={styles.heroEmail}>
                  {user?.email}
                </Text>
                <View style={styles.heroBadges}>
                  <View style={styles.rolBadge}>
                    <Text style={styles.rolBadgeText}>
                      {user?.rol === 'ADMIN'
                        ? 'Administrador'
                        : user?.rol === 'SUPERADMIN'
                          ? 'Super Admin'
                          : 'Empleado'}
                    </Text>
                  </View>
                  {perfil?.empresa?.nombre && (
                    <Text style={styles.empresaText} numberOfLines={1}>
                      {perfil.empresa.nombre}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Info personal */}
        <SectionCard
          icon="👤"
          title="Información personal"
          description="Tu nombre visible en el sistema"
          colors={colors}
        >
          <AppInput
            label="Nombre"
            placeholder="Tu nombre"
            value={nombreForm}
            onChangeText={setNombreForm}
            autoCapitalize="words"
          />
          <AppInput
            label="Correo electrónico"
            value={user?.email || ''}
            editable={false}
          />
          <AppButton
            title="Actualizar nombre"
            onPress={handleGuardarNombre}
            loading={actualizarNombreMutation.isPending}
            icon="checkmark-outline"
          />
        </SectionCard>

        {/* Seguridad */}
        <SectionCard
          icon="🔐"
          title="Seguridad"
          description="Cambia tu contraseña de acceso"
          colors={colors}
        >
          <AppInput
            label="Contraseña actual"
            placeholder="••••••••"
            secureTextEntry={!showPw.actual}
            value={pwActual}
            onChangeText={setPwActual}
          />
          <AppInput
            label="Nueva contraseña"
            placeholder="Mín. 6 caracteres"
            secureTextEntry={!showPw.nuevo}
            value={pwNuevo}
            onChangeText={setPwNuevo}
          />
          <AppInput
            label="Confirmar contraseña"
            placeholder="Repite la contraseña"
            secureTextEntry={!showPw.confirmar}
            value={pwConfirmar}
            onChangeText={setPwConfirmar}
          />
          {pwError ? (
            <View
              style={[
                styles.pwErrorBox,
                {
                  backgroundColor: colors.errorLight,
                  borderColor: colors.error,
                },
              ]}
            >
              <Ionicons name="alert-circle" size={14} color={colors.error} />
              <Text style={[styles.pwErrorText, { color: colors.error }]}>
                {pwError}
              </Text>
            </View>
          ) : null}
          <AppButton
            title="Cambiar contraseña"
            onPress={handleCambiarPassword}
            loading={cambiarPasswordMutation.isPending}
            variant="secondary"
            icon="lock-closed-outline"
          />
        </SectionCard>

        {/* Empresa (solo admin) */}
        {isAdmin && (
          <SectionCard
            icon="🏢"
            title="Datos de la empresa"
            description="Solo el administrador puede modificar estos datos"
            colors={colors}
          >
            <AppInput
              label="Nombre de la empresa"
              placeholder="Nombre de tu empresa"
              value={empresaForm}
              onChangeText={setEmpresaForm}
              autoCapitalize="words"
            />
            <View
              style={[
                styles.empresaStatus,
                {
                  backgroundColor: perfil?.empresa?.activa
                    ? colors.successLight
                    : colors.errorLight,
                  borderColor: perfil?.empresa?.activa
                    ? colors.success
                    : colors.error,
                },
              ]}
            >
              <Ionicons
                name={
                  perfil?.empresa?.activa
                    ? 'checkmark-circle'
                    : 'close-circle'
                }
                size={16}
                color={
                  perfil?.empresa?.activa ? colors.success : colors.error
                }
              />
              <Text
                style={[
                  styles.empresaStatusText,
                  {
                    color: perfil?.empresa?.activa
                      ? colors.success
                      : colors.error,
                  },
                ]}
              >
                {perfil?.empresa?.activa
                  ? 'Empresa activa'
                  : 'Empresa inactiva'}
              </Text>
            </View>
            <AppButton
              title="Actualizar empresa"
              onPress={handleGuardarEmpresa}
              loading={actualizarEmpresaMutation.isPending}
              icon="business-outline"
            />
          </SectionCard>
        )}

        {/* Info de cuenta */}
        <View
          style={[
            styles.accountInfo,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.accountInfoRow}>
            <Text style={[styles.accountInfoLabel, { color: colors.textTertiary }]}>
              ID:
            </Text>
            <Text
              style={[styles.accountInfoValue, { color: colors.textSecondary }]}
            >
              {user?.id?.slice(0, 8)}…
            </Text>
          </View>
          <View style={styles.accountInfoRow}>
            <Text style={[styles.accountInfoLabel, { color: colors.textTertiary }]}>
              Rol:
            </Text>
            <Text
              style={[styles.accountInfoValue, { color: colors.textSecondary }]}
            >
              {user?.rol === 'ADMIN'
                ? 'Administrador'
                : user?.rol === 'SUPERADMIN'
                  ? 'Super Admin'
                  : 'Empleado'}
            </Text>
          </View>
          <View style={styles.accountInfoRow}>
            <Text style={[styles.accountInfoLabel, { color: colors.textTertiary }]}>
              Cuenta creada:
            </Text>
            <Text
              style={[styles.accountInfoValue, { color: colors.textSecondary }]}
            >
              {perfil?.usuario?.createdAt
                ? new Date(perfil.usuario.createdAt).toLocaleDateString(
                    'es-DO',
                    {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    },
                  )
                : '—'}
            </Text>
          </View>
          <View style={styles.accountInfoRow}>
            <Text style={[styles.accountInfoLabel, { color: colors.textTertiary }]}>
              Versión:
            </Text>
            <Text
              style={[styles.accountInfoValue, { color: colors.textSecondary }]}
            >
              {Constants.expoConfig?.version || '—'}
            </Text>
          </View>
        </View>

        {/* Logout */}
        <AppButton
          title="Cerrar sesión"
          onPress={handleLogout}
          loading={isLoggingOut}
          variant="danger"
          icon="log-out-outline"
        />

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </KeyboardAvoidingView>
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
  toast: {
    position: 'absolute',
    top: 8,
    left: Spacing.md,
    right: Spacing.md,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  toastText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    flex: 1,
  },
  hero: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  heroGradient: {
    padding: Spacing.lg,
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarText: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
  },
  heroInfo: {
    flex: 1,
  },
  heroName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
  },
  heroEmail: {
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  heroBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  rolBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  rolBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: '#FFFFFF',
  },
  empresaText: {
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.8)',
    maxWidth: 180,
  },
  pwErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  pwErrorText: {
    fontSize: FontSize.xs,
    flex: 1,
  },
  empresaStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  empresaStatusText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  accountInfo: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  accountInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  accountInfoLabel: {
    fontSize: FontSize.xs,
  },
  accountInfoValue: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  bottomSpacer: {
    height: Spacing.xxl,
  },
});
