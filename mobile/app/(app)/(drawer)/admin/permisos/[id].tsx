import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { BorderRadius, FontSize, FontWeight, IoniconsName, scale, Spacing } from '@/constants/theme';
import { useTheme } from '@/components/ui/theme-provider';
import { usePermisos as usePermisosAcceso } from '@/permisos/use-permisos';
import SinAcceso from '@/components/permisos/sin-acceso';
import { usePermisos, useActualizarPermisos } from '@/hooks/use-usuarios';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { PageHeader } from '@/components/ui/page-header';
import { AppButton } from '@/components/ui/app-button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';

const MODULO_LABELS: Record<string, string> = {
  DASHBOARD: 'Panel',
  CLIENTES: 'Clientes',
  PRESTAMOS: 'Préstamos',
  PAGOS: 'Pagos',
  CAJA: 'Caja',
  RUTAS: 'Rutas',
  REPORTES: 'Reportes',
  GASTOS: 'Gastos',
  FINANZAS: 'Finanzas',
  EMPLEADOS: 'Empleados',
  USUARIOS: 'Usuarios',
  CONFIGURACION: 'Configuración',
  AUDITORIA: 'Auditoría',
  ALERTAS: 'Alertas',
  SYNC: 'Sincronización',
};

const MODULO_ICONS: Record<string, IoniconsName> = {
  DASHBOARD: 'grid-outline',
  CLIENTES: 'people-outline',
  PRESTAMOS: 'cash-outline',
  PAGOS: 'card-outline',
  CAJA: 'wallet-outline',
  RUTAS: 'map-outline',
  REPORTES: 'bar-chart-outline',
  GASTOS: 'cart-outline',
  FINANZAS: 'trending-up-outline',
  EMPLEADOS: 'briefcase-outline',
  USUARIOS: 'people-circle-outline',
  CONFIGURACION: 'settings-outline',
  AUDITORIA: 'document-text-outline',
  ALERTAS: 'notifications-outline',
  SYNC: 'sync-outline',
};

const PERMISO_LABELS: Record<string, string> = {
  'dashboard:ver': 'Ver panel',
  'clientes:ver': 'Ver clientes',
  'clientes:crear': 'Crear clientes',
  'clientes:editar': 'Editar clientes',
  'clientes:desactivar': 'Desactivar clientes',
  'prestamos:ver': 'Ver préstamos',
  'prestamos:crear': 'Crear préstamos',
  'prestamos:editar': 'Editar préstamos',
  'prestamos:revisar': 'Revisar solicitudes',
  'prestamos:aprobar': 'Aprobar préstamos',
  'prestamos:desembolsar': 'Desembolsar préstamos',
  'prestamos:refinanciar': 'Refinanciar préstamos',
  'prestamos:cancelar': 'Cancelar préstamos',
  'pagos:ver': 'Ver pagos',
  'pagos:registrar': 'Registrar pagos',
  'caja:ver': 'Ver caja',
  'caja:abrir': 'Abrir caja',
  'caja:cerrar': 'Cerrar caja',
  'caja:ajuste': 'Ajustes de caja',
  'rutas:ver': 'Ver rutas',
  'rutas:crear': 'Crear rutas',
  'rutas:asignar': 'Asignar clientes a rutas',
  'rutas:eliminar': 'Eliminar rutas',
  'rutas:marcarVisita': 'Marcar visitas',
  'reportes:exportar': 'Exportar reportes',
  'gastos:ver': 'Ver gastos',
  'gastos:crear': 'Registrar gastos',
  'gastos:editar': 'Editar gastos',
  'gastos:eliminar': 'Eliminar gastos',
  'finanzas:ver': 'Ver finanzas',
  'finanzas:inyeccionCapital': 'Inyección de capital',
  'finanzas:retiroGanancias': 'Retiro de ganancias',
  'empleados:ver': 'Ver empleados',
  'empleados:gestionar': 'Gestionar empleados',
  'empleados:asistencia': 'Gestionar asistencia',
  'empleados:pagosSalario': 'Pagos de salario',
  'usuarios:ver': 'Ver usuarios',
  'usuarios:gestionar': 'Gestionar usuarios',
  'usuarios:resetPassword': 'Resetear contraseñas',
  'configuracion:ver': 'Ver configuración',
  'configuracion:editar': 'Editar configuración',
  'auditoria:ver': 'Ver auditoría',
  'alertas:ver': 'Ver alertas',
};

const ROL_LABEL: Record<string, string> = { ADMIN: 'Admin', EMPLEADO: 'Empleado' };

const moduloDePermiso = (p: string) => p.split(':')[0];

// 0 = por defecto, 1 = permitir, 2 = denegar
type Estado = 0 | 1 | 2;

function PermisoRow({
  permiso,
  estado,
  baseLoConcede,
  editable,
  onCambio,
}: {
  permiso: string;
  estado: Estado;
  baseLoConcede: boolean;
  editable: boolean;
  onCambio: (v: Estado) => void;
}) {
  const { colors } = useTheme();
  const label = PERMISO_LABELS[permiso] ?? permiso;

  const opciones: { val: Estado; label: string }[] = [
    { val: 0, label: 'Por defecto' },
    { val: 1, label: 'Permitir' },
    { val: 2, label: 'Denegar' },
  ];

  const badge: { icon: IoniconsName; text: string; bg: string; color: string } =
    estado === 1
      ? { icon: 'checkmark-circle', text: 'Permitido', bg: colors.successLight, color: colors.success }
      : estado === 2
        ? { icon: 'close-circle', text: 'Denegado', bg: colors.errorLight, color: colors.error }
        : baseLoConcede
          ? { icon: 'help-circle', text: 'Por defecto · sí', bg: colors.warningLight, color: colors.warning }
          : { icon: 'help-circle-outline', text: 'Por defecto · no', bg: colors.borderLight, color: colors.textSecondary };

  return (
    <View style={[styles.row, { borderBottomColor: colors.borderLight }]}>
      <View style={styles.rowHeader}>
        <View style={styles.rowText}>
          <Text style={[styles.rowLabel, { color: colors.text }]} numberOfLines={1}>
            {label}
          </Text>
          <Text style={[styles.rowCode, { color: colors.textTertiary }]} numberOfLines={1}>
            {permiso}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: badge.bg, borderColor: badge.color }]}>
          <Ionicons name={badge.icon} size={scale(10)} color={badge.color} />
          <Text style={[styles.badgeText, { color: badge.color }]}>{badge.text}</Text>
        </View>
      </View>
      <View style={styles.segment}>
        {opciones.map(({ val, label: lbl }) => {
          const activo = estado === val;
          const colorActivo =
            val === 1 ? colors.success : val === 2 ? colors.error : colors.textTertiary;
          const bgActivo =
            val === 1 ? colors.successLight : val === 2 ? colors.errorLight : colors.surface;
          return (
            <Pressable
              key={val}
              disabled={!editable}
              onPress={() => onCambio(val)}
              style={[
                styles.segmentBtn,
                {
                  borderColor: activo ? colorActivo : colors.border,
                  backgroundColor: activo ? bgActivo : 'transparent',
                  borderWidth: activo ? 2 : 1,
                },
              ]}
              accessible
              accessibilityRole="button"
              accessibilityLabel={`${label}: ${lbl}`}
              accessibilityState={{ selected: activo, disabled: !editable }}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: activo ? colorActivo : colors.textTertiary },
                ]}
              >
                {lbl}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function PermisosScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { showToast } = useToast();
  const { isOnline } = useNetworkStatus();
  const { moduloHabilitado, tienePermiso } = usePermisosAcceso();

  const { data, isLoading, isError } = usePermisos(id);
  const mutation = useActualizarPermisos(id);

  const [estados, setEstados] = useState<Record<string, Estado>>({});

  const grupos = useMemo(() => {
    if (!data) return [];
    const inicial: Record<string, Estado> = {};
    for (const p of data.catalogo) {
      if (data.permisos.includes(p)) inicial[p] = 1;
      else if (data.permisosNegados.includes(p)) inicial[p] = 2;
      else inicial[p] = 0;
    }
    setEstados((prev) => (Object.keys(prev).length > 0 ? prev : inicial));
    return data.modulos
      .map((mod) => ({
        mod,
        label: MODULO_LABELS[mod] ?? mod,
        permisos: data.catalogo.filter(
          (p) => moduloDePermiso(p).toUpperCase() === mod,
        ),
      }))
      .filter((g) => g.permisos.length > 0);
  }, [data]);

  const stats = useMemo(() => {
    const vals = Object.values(estados);
    return {
      total: vals.length,
      permitidos: vals.filter((v) => v === 1).length,
      denegados: vals.filter((v) => v === 2).length,
    };
  }, [estados]);

  const efectivo = (permiso: string): boolean => {
    const s = estados[permiso];
    if (s === 1) return true;
    if (s === 2) return false;
    return data?.base.includes(permiso) ?? false;
  };

  const editable = isOnline && !mutation.isPending;

  const handleGuardar = async () => {
    if (!isOnline) {
      showToast('Necesitas conexión para editar permisos', 'error');
      return;
    }
    const permisos = Object.entries(estados)
      .filter(([, v]) => v === 1)
      .map(([p]) => p);
    const permisosNegados = Object.entries(estados)
      .filter(([, v]) => v === 2)
      .map(([p]) => p);
    try {
      await mutation.mutateAsync({ permisos, permisosNegados });
      showToast('Permisos actualizados correctamente', 'success');
      router.navigate('/admin/usuarios');
    } catch {
      showToast('Error al guardar los permisos', 'error');
    }
  };

  if (!moduloHabilitado('USUARIOS') || !tienePermiso('usuarios:gestionar')) {
    return <SinAcceso />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <PageHeader
        title="Permisos"
        onBack={() => router.navigate('/admin/usuarios')}
      />

      {isLoading ? (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Skeleton height={56} style={{ marginBottom: Spacing.md }} />
          <Skeleton height={200} style={{ marginBottom: Spacing.sm }} />
          <Skeleton height={200} />
        </ScrollView>
      ) : isError || !data ? (
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={scale(48)} color={colors.textTertiary} />
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
            No se pudo cargar la configuración de permisos
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Encabezado del usuario */}
          <View style={[styles.userCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.userInfo}>
              <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
                {data.usuario.nombre}
              </Text>
              <Text style={[styles.userEmail, { color: colors.textTertiary }]} numberOfLines={1}>
                {data.usuario.email}
              </Text>
            </View>
            <View
              style={[
                styles.rolBadge,
                {
                  backgroundColor: data.usuario.rol === 'ADMIN' ? colors.primaryLight : colors.surfaceElevated,
                  borderColor: data.usuario.rol === 'ADMIN' ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.rolBadgeText,
                  { color: data.usuario.rol === 'ADMIN' ? colors.primary : colors.textSecondary },
                ]}
              >
                {ROL_LABEL[data.usuario.rol] ?? data.usuario.rol}
              </Text>
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.statNumber, { color: colors.text }]}>{stats.total}</Text>
              <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Permisos</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.successLight }]}>
              <Text style={[styles.statNumber, { color: colors.success }]}>{stats.permitidos}</Text>
              <Text style={[styles.statLabel, { color: colors.success }]}>Permitidos</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.errorLight }]}>
              <Text style={[styles.statNumber, { color: colors.error }]}>{stats.denegados}</Text>
              <Text style={[styles.statLabel, { color: colors.error }]}>Denegados</Text>
            </View>
          </View>

          {/* Aviso offline */}
          {!isOnline && (
            <View style={[styles.offlineBox, { backgroundColor: colors.warningLight, borderColor: colors.warning }]}>
              <Ionicons name="cloud-offline-outline" size={scale(18)} color={colors.warning} />
              <Text style={[styles.offlineText, { color: colors.warning }]}>
                Estás sin conexión. Puedes ver la configuración, pero necesitas conexión para editarla.
              </Text>
            </View>
          )}

          {/* Info tri-estado */}
          <View style={[styles.infoBox, { backgroundColor: colors.infoLight, borderColor: colors.info }]}>
            <Ionicons name="information-circle" size={scale(18)} color={colors.info} />
            <Text style={[styles.infoText, { color: colors.info }]}>
              “Por defecto” usa lo del rol ({ROL_LABEL[data.usuario.rol] ?? data.usuario.rol}). “Permitir”
              da acceso extra y “Denegar” lo bloquea explícitamente.
            </Text>
          </View>

          {/* Matriz */}
          <View style={[styles.matrix, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {grupos.map(({ mod, label, permisos }) => {
              const efectivos = permisos.filter((p) => efectivo(p)).length;
              const pill =
                efectivos === permisos.length
                  ? { bg: colors.successLight, color: colors.success }
                  : efectivos > 0
                    ? { bg: colors.warningLight, color: colors.warning }
                    : { bg: colors.surface, color: colors.textTertiary };
              return (
                <View key={mod} style={[styles.group, { borderBottomColor: colors.border }]}>
                  <View style={styles.groupHeader}>
                    <View style={[styles.groupIcon, { backgroundColor: colors.primaryLight }]}>
                      <Ionicons
                        name={MODULO_ICONS[mod] ?? 'apps-outline'}
                        size={scale(18)}
                        color={colors.primary}
                      />
                    </View>
                    <Text
                      accessibilityRole="header"
                      style={[styles.groupTitle, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {label}
                    </Text>
                    <View
                      style={[
                        styles.groupPill,
                        { backgroundColor: pill.bg, borderColor: pill.color },
                      ]}
                    >
                      <Text style={[styles.groupPillText, { color: pill.color }]}>
                        {efectivos} de {permisos.length}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.progressTrack, { backgroundColor: colors.borderLight }]}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          backgroundColor: pill.color,
                          width: `${permisos.length > 0 ? Math.round((efectivos / permisos.length) * 100) : 0}%`,
                        },
                      ]}
                    />
                  </View>
                  {permisos.map((p) => (
                    <PermisoRow
                      key={p}
                      permiso={p}
                      estado={estados[p] ?? 0}
                      baseLoConcede={(data.base ?? []).includes(p)}
                      editable={editable}
                      onCambio={(v) => setEstados((prev) => ({ ...prev, [p]: v }))}
                    />
                  ))}
                </View>
              );
            })}
          </View>

          {tienePermiso('usuarios:gestionar') && (
            <AppButton
              title="Guardar permisos"
              onPress={handleGuardar}
              loading={mutation.isPending}
              disabled={!isOnline}
              icon="checkmark-outline"
              style={{ marginTop: Spacing.sm }}
            />
          )}
          {!isOnline && (
            <Text style={[styles.disabledHint, { color: colors.textTertiary }]}>
              Conéctate a internet para poder guardar los cambios
            </Text>
          )}
          <View style={{ height: Spacing.xxl }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    padding: Spacing.md,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  emptyText: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    maxWidth: scale(260),
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
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
    color: '#94A3B8',
    marginTop: scale(1),
  },
  rolBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: scale(2),
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  rolBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
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
    borderWidth: 1,
    borderColor: 'transparent',
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
  offlineBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  offlineText: {
    flex: 1,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  infoText: {
    flex: 1,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    lineHeight: scale(17),
  },
  matrix: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  group: {
    borderBottomWidth: 1,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  groupIcon: {
    width: scale(34),
    height: scale(34),
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupTitle: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  groupPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: scale(3),
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  groupPillText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  progressTrack: {
    height: scale(3),
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  progressFill: {
    height: '100%',
    borderRadius: BorderRadius.full,
  },
  row: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  rowCode: {
    fontSize: FontSize.xs,
    marginTop: scale(1),
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(3),
    paddingHorizontal: Spacing.sm,
    paddingVertical: scale(2),
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: scale(9),
    fontWeight: FontWeight.bold,
  },
  segment: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: scale(7),
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    alignItems: 'center',
  },
  segmentText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  disabledHint: {
    fontSize: FontSize.xs,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
});
