import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '@/components/ui/screen-container';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useCliente,
  useActualizarCliente,
  useEliminarCliente,
  useReactivarCliente } from '@/hooks/use-clientes';
import ClienteForm from '@/components/clientes/cliente-form';
import { obtenerRutaCliente, asignarRuta } from '@/api/rutas.api';
import ClienteInfo from '@/components/clientes/cliente-info';
import ClienteAvatar from '@/components/clientes/cliente-avatar';
import KpiCard from '@/components/clientes/kpi-card';
import PrestamoCard from '@/components/clientes/prestamo-card';
import ClienteQuickActions from '@/components/clientes/cliente-quick-actions';
import DocumentViewer from '@/components/clientes/document-viewer';
import LocationView from '@/components/clientes/location-view';
import AppMapView from '@/components/clientes/map-view';
import { AppButton } from '@/components/ui/app-button';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import EmptyState from '@/components/ui/empty-state';
import ScrollToTopButton from '@/components/ui/scroll-to-top';
import { useToast } from '@/components/ui/toast';
import LoadingScreen from '@/components/ui/loading-screen';
import { SkeletonCard, SkeletonKPIGrid } from '@/components/ui/skeleton';
import type { ClienteFormData } from '@/schemas/cliente.schema';
import { useAuthStore } from '@/store/auth.store';
import type { ApiError } from '@/types/api.types';
import type { Prestamo } from '@/types/cliente.types';
import { FontSize, FontWeight, Fonts, Spacing, BorderRadius, Shadows, scale} from '@/constants/theme';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { useTheme } from '@/components/ui/theme-provider';

type DialogAction = 'eliminar' | 'reactivar' | null;

function obtenerPrestamoPrioritario(prestamos: Prestamo[]): Prestamo | null {
  if (!prestamos?.length) return null;
  const activos = prestamos.filter(
    (p) => p.estado === 'ACTIVO' || p.estado === 'ATRASADO',
  );
  if (!activos.length) return null;
  const atrasados = activos.filter((p) => p.estado === 'ATRASADO');
  if (atrasados.length) {
    return atrasados.sort(
      (a, b) => (b.saldoPendiente || 0) - (a.saldoPendiente || 0),
    )[0];
  }
  return activos.sort(
    (a, b) =>
      new Date(a.fechaVencimiento).getTime() - new Date(b.fechaVencimiento).getTime(),
  )[0];
}

function calcularSaldoReal(prestamo: Prestamo): number {
  if (prestamo.saldoPendiente > 0) return prestamo.saldoPendiente;
  if (prestamo.cuotas?.length) {
    return prestamo.cuotas.reduce(
      (sum, c) => sum + (c.monto || 0) + (c.mora || 0),
      0,
    );
  }
  return prestamo.saldoPendiente ?? 0;
}

export default function ClienteDetalleScreen() {
  const { id, edit, from } = useLocalSearchParams<{ id: string; edit?: string; from?: string }>();
  const { colorScheme, colors } = useTheme();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.rol === 'SUPERADMIN' || user?.rol === 'ADMIN';

  const { data: cliente, isLoading, error: queryError, refetch } = useCliente(id);
  const { mutateAsync: actualizarMutation, isPending: isActualizando } =
    useActualizarCliente();
  const { mutateAsync: eliminarMutation, isPending: isEliminando } =
    useEliminarCliente();
  const { mutateAsync: reactivarMutation, isPending: isReactivando } =
    useReactivarCliente();

  const { showToast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const [dialogAction, setDialogAction] = useState<DialogAction>(null);
  const [currentRutaId, setCurrentRutaId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (edit === 'true') {
      setIsEditing(true);
    }
  }, [edit]);

  useEffect(() => {
    if (id) {
      obtenerRutaCliente(id)
        .then((res) => setCurrentRutaId(res.rutaId))
        .catch(() => showToast('No se pudo obtener la ruta del cliente', 'error'));
    }
  }, [id, showToast]);

  const prestamos = cliente?.prestamos || [];
  const garantias = cliente?.garantias || [];
  const prestamoPrioritario = obtenerPrestamoPrioritario(prestamos);
  const rutaAsignada = cliente?.rutaClientes?.[0]?.ruta?.nombre;

  const totalPrestamos = prestamos.length;
  const prestamosActivos = prestamos.filter(
    (p) => p.estado === 'ACTIVO' || p.estado === 'ATRASADO',
  );
  const prestamosPagados = prestamos.filter((p) => p.estado === 'PAGADO');
  const saldoPendienteTotal = prestamosActivos.reduce(
    (sum, p) => sum + calcularSaldoReal(p),
    0,
  );

  const handleUpdate = useCallback(
    async (data: ClienteFormData) => {
      try {
        await actualizarMutation({ id, data });
        if (currentRutaId !== undefined) {
          await asignarRuta(id, currentRutaId).catch(() => {});
        }
        setIsEditing(false);
        showToast('Cliente actualizado exitosamente', 'success');
      } catch (err) {
        const { message } = err as ApiError;
        throw new Error(message || 'Error al actualizar el cliente.');
      }
    },
    [id, actualizarMutation, currentRutaId, showToast],
  );

  const goBack = useCallback(() => {
    if (from) {
      router.push('/clientes');
    } else {
      router.back();
    }
  }, [from]);

  const handleEliminar = useCallback(async () => {
    try {
      await eliminarMutation(id);
      setDialogAction(null);
      router.back();
    } catch (err) {
      const { message } = err as ApiError;
      showToast(message || 'No se pudo eliminar el cliente.', 'error');
      setDialogAction(null);
    }
  }, [id, eliminarMutation, showToast]);

  const handleReactivar = useCallback(async () => {
    try {
      await reactivarMutation(id);
      setDialogAction(null);
    } catch (err) {
      const { message } = err as ApiError;
      showToast(message || 'No se pudo reactivar el cliente.', 'error');
      setDialogAction(null);
    }
  }, [id, reactivarMutation]);

  if (isLoading) {
    return (
      <ScreenContainer style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={styles.skeletonContainer}>
          <SkeletonCard lines={2} />
          <SkeletonKPIGrid />
          <SkeletonCard lines={5} style={{ marginTop: scale(16) }} />
        </View>
      </ScreenContainer>
    );
  }

  const displayError = queryError?.message;
  if (displayError && !cliente) {
    return (
      <ScreenContainer style={[styles.screen, { backgroundColor: colors.background }]}>
        <EmptyState
          icon="alert-circle-outline"
          title="Cliente no encontrado"
          subtitle={displayError}
          actionLabel="Volver"
          onAction={() => router.back()}
        />
      </ScreenContainer>
    );
  }

  if (!cliente) return null;

  const nombreCompleto =
    cliente.nombre + (cliente.apellido ? ` ${cliente.apellido}` : '');

  const initialData: Partial<ClienteFormData> = {
    nombre: cliente.nombre,
    cedula: cliente.cedula,
    apellido: cliente.apellido ?? undefined,
    telefono: cliente.telefono ?? undefined,
    celular: cliente.celular ?? undefined,
    email: cliente.email ?? undefined,
    provincia: cliente.provincia ?? undefined,
    municipio: cliente.municipio ?? undefined,
    sector: cliente.sector ?? undefined,
    direccion: cliente.direccion ?? undefined,
    ocupacion: cliente.ocupacion ?? undefined,
    empresaLaboral: cliente.empresaLaboral ?? undefined,
    ingresos: cliente.ingresos ?? undefined,
    observaciones: cliente.observaciones ?? undefined,
  };

  if (isEditing) {
    return (
      <ScreenContainer
        style={[styles.screen, { backgroundColor: colors.background }]}
      >
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={goBack} hitSlop={8}>
            <Ionicons name="close" size={scale(24)} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Editar Cliente
          </Text>
          <View style={styles.headerSpacer} />
        </View>
        <ClienteForm
          initialData={initialData}
          onSubmit={handleUpdate}
          isSubmitting={isActualizando}
          submitLabel="Guardar cambios"
          initialRutaId={currentRutaId}
          onRutaChange={setCurrentRutaId}
          clienteId={id}
          hasFrontalDoc={!!cliente.cedulaFrontalPath}
          hasTraseraDoc={!!cliente.cedulaTraseraPath}
          initialLatitud={cliente.latitud}
          initialLongitud={cliente.longitud}
          onUploadComplete={() => {
            refetch();
          }}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={goBack} hitSlop={8}>
          <Ionicons name="arrow-back" size={scale(24)} color={colors.text} />
        </Pressable>
        <View style={styles.headerInfo}>
          <Text
            style={[styles.headerTitle, { color: colors.text }]}
            numberOfLines={1}
          >
            {nombreCompleto}
          </Text>
        </View>
        <Pressable onPress={() => setIsEditing(true)} hitSlop={8}>
          <Ionicons name="pencil" size={scale(22)} color={colors.primary} />
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          setShowScrollTop(y > 300);
        }}
        scrollEventThrottle={100}
      >
        {/* Hero section */}
        <View
          style={[
            styles.hero,
            { backgroundColor: colors.surface, borderColor: colors.border },
            Shadows.sm,
          ]}
        >
          <View style={styles.heroRow}>
            <ClienteAvatar
              nombre={cliente.nombre}
              activo={cliente.activo}
              size={scale(56)}
            />
            <View style={styles.heroInfo}>
              <Text style={[styles.heroName, { color: colors.text }]}>
                {nombreCompleto}
              </Text>
              <View style={styles.heroBadges}>
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor: cliente.activo
                        ? colors.badgeActiveBg
                        : colors.badgeInactiveBg,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.badgeDotSmall,
                      {
                        backgroundColor: cliente.activo
                          ? colors.badgeActive
                          : colors.badgeInactive,
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.badgeLabel,
                      {
                        color: cliente.activo
                          ? colors.badgeActive
                          : colors.badgeInactive,
                      },
                    ]}
                  >
                    {cliente.activo ? 'Activo' : 'Inactivo'}
                  </Text>
                </View>
                {rutaAsignada && (
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: colors.routeBg },
                    ]}
                  >
                    <Ionicons
                      name="git-network-outline"
                      size={scale(12)}
                      color={colors.route}
                    />
                    <Text
                      style={[styles.badgeLabel, { color: colors.route }]}
                    >
                      {rutaAsignada}
                    </Text>
                  </View>
                )}
              </View>
              <Text
                style={[styles.heroSub, { color: colors.textTertiary }]}
              >
                Cédula: {cliente.cedula} · Cliente desde{' '}
                {formatDate(cliente.createdAt)}
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        {cliente.activo && (
          <View
            style={[
              styles.sectionCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={[styles.sectionTitle, { flexDirection: 'row', alignItems: 'center', gap: scale(6) }]}>
              <Ionicons name="flash-outline" size={scale(16)} color={colors.textSecondary} />
              <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: colors.textSecondary }}>
                Acciones rápidas
              </Text>
            </View>
            <ClienteQuickActions
              cliente={cliente}
              prestamo={prestamoPrioritario}
              onRegistrarPago={() =>
                prestamoPrioritario &&
                router.push(
                  `/caja/pago?prestamoId=${prestamoPrioritario.id}`,
                )
              }
              onVerPrestamo={() =>
                prestamoPrioritario &&
                router.push(`/prestamos/${prestamoPrioritario.id}`)
              }
            />
          </View>
        )}

        {/* KPIs Financieros */}
        {cliente.activo && totalPrestamos > 0 && (
          <View style={styles.kpiGrid}>
            <View style={styles.kpiRow}>
              <KpiCard
                icon="documents-outline"
                value={String(totalPrestamos)}
                label="Total préstamos"
                accent="primary"
                delay={0}
              />
              <KpiCard
                icon="checkmark-circle-outline"
                value={String(prestamosActivos.length)}
                label="Préstamos activos"
                accent="success"
                delay={50}
              />
            </View>
            <View style={styles.kpiRow}>
              <KpiCard
                icon="cash-outline"
                value={formatCurrency(saldoPendienteTotal)}
                label="Saldo pendiente"
                accent="info"
                delay={100}
              />
              <KpiCard
                icon="ribbon-outline"
                value={String(prestamosPagados.length)}
                label="Pagados"
                accent="warning"
                delay={150}
              />
            </View>
          </View>
        )}

        {/* Estado de Cuenta */}
        {cliente.activo && (
          <View
            style={[
              styles.sectionCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Pressable
              style={[styles.estadoCuentaBtn, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
              onPress={() =>
                router.push(
                  `/clientes/estado-cuenta?id=${cliente.id}&nombre=${encodeURIComponent(cliente.nombre)}&cedula=${cliente.cedula}`,
                )
              }
            >
              <Ionicons name="document-text-outline" size={scale(20)} color={colors.primary} />
              <View style={styles.estadoCuentaText}>
                <Text style={[styles.estadoCuentaTitle, { color: colors.primary }]}>
                  Estado de Cuenta
                </Text>
                <Text style={[styles.estadoCuentaSub, { color: colors.primary }]}>
                  Ver detalle completo de préstamos, cuotas y pagos
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={scale(18)} color={colors.primary} />
            </Pressable>
          </View>
        )}

        {/* Documentos */}
        {(cliente.cedulaFrontalPath || cliente.cedulaTraseraPath) && (
          <DocumentViewer cliente={cliente} />
        )}

        {/* Información del Cliente */}
        <ClienteInfo cliente={cliente} />

        {/* Ubicación */}
        {cliente.latitud && cliente.longitud && (
          <View
            style={[
              styles.sectionCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={[styles.sectionTitle, { flexDirection: 'row', alignItems: 'center', gap: scale(6) }]}>
              <Ionicons name="location-outline" size={scale(16)} color={colors.textSecondary} />
              <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: colors.textSecondary }}>
                Ubicación
              </Text>
            </View>
            <AppMapView
              latitude={cliente.latitud}
              longitude={cliente.longitud}
              coordsAproximadas={cliente.coordsAproximadas}
              readOnly
              height={180}
            />
            <LocationView
              latitud={cliente.latitud}
              longitud={cliente.longitud}
              coordsAproximadas={cliente.coordsAproximadas}
            />
          </View>
        )}

        {/* Información Financiera */}
        {cliente.ingresos != null && (
          <View
            style={[
              styles.sectionCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={[styles.sectionTitle, { flexDirection: 'row', alignItems: 'center', gap: scale(6) }]}>
              <Ionicons name="briefcase-outline" size={scale(16)} color={colors.textSecondary} />
              <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: colors.textSecondary }}>
                Información Financiera
              </Text>
            </View>
            <View style={styles.finRow}>
              <Ionicons
                name="trending-up-outline"
                size={scale(16)}
                color={colors.textSecondary}
              />
              <Text style={[styles.finLabel, { color: colors.textSecondary }]}>
                Ingresos declarados:
              </Text>
              <Text style={[styles.finValue, { color: colors.text }]} numberOfLines={1}>
                {formatCurrency(cliente.ingresos)}/mes
              </Text>
            </View>
          </View>
        )}

        {/* Préstamos */}
        {prestamos.length > 0 && (
          <View
            style={[
              styles.sectionCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text
              style={[styles.sectionTitle, { color: colors.textSecondary }]}
            >
              Préstamos ({totalPrestamos})
            </Text>
            <View style={styles.prestamosList}>
              {prestamos.map((p) => (
                <PrestamoCard
                  key={p.id}
                  prestamo={p}
                  onPress={() => router.push(`/prestamos/${p.id}`)}
                />
              ))}
            </View>
          </View>
        )}

        {/* Garantías */}
        {garantias.length > 0 && (
          <View
            style={[
              styles.sectionCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text
              style={[
                styles.sectionTitle,
                { color: colors.textSecondary },
              ]}
            >
              Garante en {garantias.length} préstamo(s)
            </Text>
            {garantias.map((g) => (
              <View
                key={g.id}
                style={[
                  styles.garantiaRow,
                  { borderBottomColor: colors.borderLight },
                ]}
              >
                <Text style={[styles.garantiaId, { color: colors.textTertiary }]}>
                  #{g.id.slice(0, 8)}
                </Text>
                <Text style={[styles.garantiaMonto, { color: colors.text }]}>
                  {formatCurrency(g.monto)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Admin Actions */}
        {isAdmin && (
          <View style={styles.adminActions}>
            {cliente.activo ? (
              <AppButton
                title="Deshabilitar cliente"
                onPress={() => setDialogAction('eliminar')}
                variant="danger"
                icon="ban-outline"
              />
            ) : (
              <AppButton
                title="Reactivar cliente"
                onPress={() => setDialogAction('reactivar')}
                variant="secondary"
                icon="refresh-outline"
              />
            )}
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <ScrollToTopButton
        visible={showScrollTop}
        onPress={() =>
          scrollRef.current?.scrollTo({ y: 0, animated: true })
        }
      />

      <ConfirmDialog
        visible={dialogAction === 'eliminar'}
        title="Deshabilitar cliente"
        message="¿Está seguro de deshabilitar este cliente?"
        confirmLabel="Deshabilitar"
        onConfirm={handleEliminar}
        onCancel={() => setDialogAction(null)}
        loading={isEliminando}
        destructive
      />

      <ConfirmDialog
        visible={dialogAction === 'reactivar'}
        title="Reactivar cliente"
        message="¿Desea reactivar este cliente?"
        confirmLabel="Reactivar"
        onConfirm={handleReactivar}
        onCancel={() => setDialogAction(null)}
        loading={isReactivando}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  skeletonContainer: {
    padding: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  headerInfo: {
    flex: 1,
    marginHorizontal: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  headerSpacer: {
    width: scale(32),
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  hero: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  heroName: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  heroBadges: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: scale(4),
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    paddingHorizontal: Spacing.sm,
    paddingVertical: scale(2),
    borderRadius: BorderRadius.sm,
  },
  badgeDotSmall: {
    width: scale(6),
    height: scale(6),
    borderRadius: 3,
  },
  badgeLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  heroSub: {
    fontSize: FontSize.xs,
    marginTop: scale(4),
  },
  sectionCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.sm,
  },
  kpiGrid: {
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  finRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  finLabel: {
    fontSize: FontSize.xs,
  },
  finValue: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    flexShrink: 1,
  },
  prestamosList: {
    gap: Spacing.sm,
  },
  garantiaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  garantiaId: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.mono,
  },
  garantiaMonto: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  estadoCuentaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  estadoCuentaText: {
    flex: 1,
  },
  estadoCuentaTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  estadoCuentaSub: {
    fontSize: FontSize.xs,
    marginTop: scale(2),
  },
  adminActions: {
    marginTop: Spacing.md,
  },
  bottomSpacer: {
    height: Spacing.xxl,
  },
});
