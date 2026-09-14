import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Keyboard, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery } from '@tanstack/react-query';

import { listar } from '@/api/prestamos.api';
import PrestamoCard from '@/components/clientes/prestamo-card';
import EmptyState from '@/components/ui/empty-state';
import ScrollToTopButton from '@/components/ui/scroll-to-top';
import SearchBar from '@/components/ui/search-bar';
import { SkeletonCard } from '@/components/ui/skeleton';
import ActionConfirmModal from '@/components/ui/action-confirm-modal';
import { ActionBottomSheet } from '@/components/ui/action-bottom-sheet';
import DesembolsoModal from '@/components/prestamos/desembolso-modal';
import { useToast } from '@/components/ui/toast';
import { useAuthStore } from '@/store/auth.store';
import { usePermisos } from '@/permisos/use-permisos';
import { FontSize, FontWeight, Spacing, BorderRadius, scale } from '@/constants/theme';
import {
  usePrestamoEstados,
  useAccionesFlow,
  obtenerAccionesPorEstado,
  type AccionPrestamo,
} from '@/hooks/use-prestamo-estados';
import { getNetworkStatus, useNetworkStatus } from '@/hooks/use-network-status';
import { getPrestamosOffline } from '@/services/offline-data';
import { useCambiarEstadoPrestamo,
  useDesembolsarPrestamo,
  useCancelarPrestamo } from '@/hooks/use-prestamos';
import type { EstadoPrestamo } from '@/types/prestamo.types';
import { useTheme, getSolidFill } from '@/components/ui/theme-provider';
import { humanizeError } from '@/utils/errors';

const PAGE_SIZE = 20;

const ESTADOS_FILTRO: { label: string; value: EstadoPrestamo | '' }[] = [
  { label: 'Todos', value: '' },
  { label: 'Activo', value: 'ACTIVO' },
  { label: 'Renovado', value: 'RENOVADO' },
  { label: 'Atrasado', value: 'ATRASADO' },
  { label: 'Pagado', value: 'PAGADO' },
  { label: 'Cancelado', value: 'CANCELADO' },
  { label: 'Solicitado', value: 'SOLICITADO' },
  { label: 'Revisión', value: 'EN_REVISION' },
  { label: 'Aprobado', value: 'APROBADO' },
  { label: 'Rechazado', value: 'RECHAZADO' },
];

function usePrestamosInfinite(search: string, estado: EstadoPrestamo | '') {
  return useInfiniteQuery({
    queryKey: ['prestamos', search, estado],
    queryFn: async ({ pageParam = 1 }) => {
      try {
        return await listar({
          page: pageParam,
          limit: PAGE_SIZE,
          search: search || undefined,
          estado: estado || undefined,
        });
      } catch (error) {
        if (getNetworkStatus().isOnline) throw error;
        return getPrestamosOffline(search, estado);
      }
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.pagina < lastPage.totalPaginas) {
        return lastPage.pagina + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
  });
}

export default function PrestamosListScreen() {
  const { colorScheme, colors } = useTheme();
  const user = useAuthStore((state) => state.user);
  const userId = user?.id;
  const { tienePermiso } = usePermisos();
  const puedeRevisar = tienePermiso('prestamos:revisar');
  const puedeAprobar = tienePermiso('prestamos:aprobar');
  const puedeDesembolsarPermiso = tienePermiso('prestamos:desembolsar');
  const puedeCrear = tienePermiso('prestamos:crear');
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<EstadoPrestamo | ''>('');
  const [filtroOpen, setFiltroOpen] = useState(false);
  const [accionModal, setAccionModal] = useState<{ prestamo: any; accion: string; estado: string } | null>(null);
  const [desembolsoPrestamo, setDesembolsoPrestamo] = useState<any | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const listRef = useRef<FlatList<any>>(null);

  const {
    data,
    isLoading,
    error,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = usePrestamosInfinite(search, filtroEstado);

  const { isOnline } = useNetworkStatus();

  useEffect(() => {
    if (!isOnline) {
      refetch();
    }
  }, [isOnline, refetch]);

  const cambiarEstadoMutation = useCambiarEstadoPrestamo();
  const desembolsarMutation = useDesembolsarPrestamo();
  const cancelarMutation = useCancelarPrestamo();

  const prestamos = useMemo(
    () => data?.pages.flatMap((page) => page.data) ?? [],
    [data],
  );

  const totalPrestamos = data?.pages[0]?.total ?? 0;

  const handleSearch = useCallback((text: string) => {
    setSearch(text);
  }, []);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const ejecutarAccion = useCallback(async (motivo?: string) => {
    if (!accionModal) return;
    const { prestamo, accion, estado } = accionModal;
    try {
      if (accion === 'CANCELAR') {
        const result = await cancelarMutation.mutateAsync(prestamo.id);
        showToast(result?.esOffline ? 'Cancelación encolada — se sincronizará cuando vuelva la conexión' : 'Préstamo cancelado correctamente', result?.esOffline ? 'info' : 'success');
      } else {
        const result = await cambiarEstadoMutation.mutateAsync({
          id: prestamo.id,
          data: { estado: estado as EstadoPrestamo, motivo },
        });
        showToast(result?.esOffline ? `Estado encolado a ${estado} — se sincronizará cuando vuelva la conexión` : `Estado actualizado a ${estado}`, result?.esOffline ? 'info' : 'success');
      }
      setAccionModal(null);
    } catch (err: any) {
      setAccionModal(null);
      showToast(humanizeError(err, 'Error al ejecutar acción'), 'error');
    }
  }, [accionModal, cambiarEstadoMutation, cancelarMutation, showToast]);

  const abrirAccion = useCallback((prestamo: any, tipo: AccionPrestamo['tipo']) => {
    if (tipo === 'desembolsar') {
      setDesembolsoPrestamo(prestamo);
      return;
    }
    const map: Record<string, { accion: string; estado: string }> = {
      revisar: { accion: 'EN_REVISION', estado: 'EN_REVISION' },
      aprobar: { accion: 'APROBADO', estado: 'APROBADO' },
      rechazar: { accion: 'RECHAZADO', estado: 'RECHAZADO' },
    };
    const m = map[tipo];
    if (m) setAccionModal({ prestamo, accion: m.accion, estado: m.estado });
  }, []);

  const confirmarDesembolso = useCallback(async () => {
    if (!desembolsoPrestamo) return;
    try {
      const result = await desembolsarMutation.mutateAsync(desembolsoPrestamo.id);
      showToast(result?.esOffline ? 'Desembolso encolado — se sincronizará cuando vuelva la conexión' : 'Préstamo desembolsado correctamente', result?.esOffline ? 'info' : 'success');
      setDesembolsoPrestamo(null);
    } catch (err: any) {
      setDesembolsoPrestamo(null);
      showToast(humanizeError(err, 'Error al desembolsar'), 'error');
    }
  }, [desembolsoPrestamo, desembolsarMutation, showToast]);

  const cerrarModal = useCallback(() => {
    setAccionModal(null);
  }, []);

  const renderItem = useCallback(
    ({ item }: any) => {
      const puedeDesembolsar = item.estado === 'APROBADO' && (puedeDesembolsarPermiso || item.solicitadoPor === userId);

      const acciones = obtenerAccionesPorEstado({
        estado: item.estado,
        puedeRevisar,
        puedeAprobar,
        puedeDesembolsar,
        colores: { info: colors.info, success: colors.success, error: colors.error, primary: colors.primary },
      });

      return (
        <PrestamoCard
          prestamo={item}
          onPress={() => router.push(`/prestamos/${item.id}`)}
          acciones={acciones.map((a) => ({
            id: a.id,
            label: a.label,
            icon: a.icon as any,
            color: a.color,
            esPrimaria: a.esPrimaria,
            onPress: () => abrirAccion(item, a.tipo),
            accessibilityLabel: a.tipo === 'desembolsar' ? 'Desembolsar préstamo' : undefined,
          }))}
        />
      );
    },
    [colors, puedeRevisar, puedeAprobar, puedeDesembolsarPermiso, userId, abrirAccion],
  );

  const renderSeparator = useCallback(
    () => <View style={{ height: Spacing.sm }} />,
    [],
  );

  const ACCION_CONFIG = useAccionesFlow();
  const ESTADO_CONFIG = usePrestamoEstados();
  const estadoFiltroActual = ESTADOS_FILTRO.find((e) => e.value === filtroEstado);
  const estadoLabel = estadoFiltroActual?.label ?? 'Todos';
  const estadoCfgFiltro = filtroEstado ? ESTADO_CONFIG[filtroEstado] : null;

  if (isLoading && !data) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={styles.searchContainer}>
          <SearchBar
            value={search}
            onSearch={handleSearch}
            placeholder="Buscar por cliente..."
          />
        </View>
        <View style={styles.list}>
          {[1, 2, 3, 4, 5].map((i) => (
            <SkeletonCard key={i} lines={3} style={{ marginBottom: scale(8) }} />
          ))}
        </View>
      </View>
    );
  }

  if (error && prestamos.length === 0) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={styles.searchContainer}>
          <SearchBar
            value={search}
            onSearch={handleSearch}
            placeholder="Buscar por cliente..."
          />
        </View>
        <EmptyState
          icon="alert-circle-outline"
          title="Error al cargar préstamos"
          subtitle={humanizeError(error, 'Error al cargar préstamos')}
          actionLabel="Reintentar"
          onAction={() => refetch()}
        />
      </View>
    );
  }

  const cfg = accionModal ? ACCION_CONFIG[accionModal.accion] : null;
  const accionLoading = accionModal?.accion === 'CANCELAR' ? cancelarMutation.isPending
    : cambiarEstadoMutation.isPending;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.searchContainer}>
        <SearchBar
          value={search}
          onSearch={handleSearch}
          placeholder="Buscar por cliente..."
        />
      </View>

      <View style={styles.filterRow}>
        <View>
          <Text style={[styles.filterTitle, { color: colors.text }]}>
            Préstamos
          </Text>
          <Text style={[styles.filterCount, { color: colors.textTertiary }]}>
            {totalPrestamos} en total
          </Text>
        </View>
        <Pressable
          onPress={() => setFiltroOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Filtrar por estado. Actual: ${estadoLabel}`}
          accessibilityState={{ expanded: filtroOpen }}
          style={({ pressed }) => [
            styles.filterTrigger,
            {
              backgroundColor: colors.surface,
              borderColor: filtroEstado ? colors.primary : colors.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Text
            style={[
              styles.filterTriggerText,
              {
                color: filtroEstado
                  ? (estadoCfgFiltro?.text ?? colors.primary)
                  : colors.textSecondary,
              },
            ]}
          >
            {estadoLabel}
          </Text>
          <Ionicons name="chevron-down" size={scale(16)} color={colors.textSecondary} />
        </Pressable>
      </View>

      <View style={{ flex: 1 }}>
        {prestamos.length === 0 && !isFetching ? (
          search ? (
            <EmptyState
              icon="search-outline"
              title="Sin resultados"
              subtitle={`No se encontraron préstamos que coincidan con "${search}"`}
            />
          ) : (
            <EmptyState
              icon="cash-outline"
              title="No hay préstamos"
              subtitle="Aún no se han registrado préstamos"
              actionLabel={puedeCrear ? 'Solicitar préstamo' : undefined}
              onAction={puedeCrear ? () => router.push('/prestamos/nuevo') : undefined}
            />
          )
        ) : (
          <FlatList
            ref={listRef}
            data={prestamos}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            accessibilityRole="list"
            style={{ flex: 1 }}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={renderSeparator}
            keyboardShouldPersistTaps="handled"
            onScrollBeginDrag={Keyboard.dismiss}
            onScroll={(e) => {
              const y = e.nativeEvent.contentOffset.y;
              setShowScrollTop(y > 300);
            }}
            scrollEventThrottle={100}
            refreshControl={
              <RefreshControl
                refreshing={isFetching && !isFetchingNextPage}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.3}
            ListFooterComponent={
              isFetchingNextPage ? (
                <View style={styles.footerLoader}>
                  <Text style={[styles.footerText, { color: colors.textTertiary }]}>
                    Cargando más...
                  </Text>
                </View>
              ) : null
            }
          />
        )}
      </View>

      {prestamos.length > 0 && (
        <ScrollToTopButton
          visible={showScrollTop}
          bottom={88}
          onPress={() =>
            listRef.current?.scrollToOffset({
              offset: 0,
              animated: true,
            })
          }
        />
      )}

      {puedeCrear && (
        <Pressable
          style={[styles.fab, { backgroundColor: getSolidFill(colors, colorScheme, 'primary') }]}
          onPress={() => router.push('/prestamos/nuevo')}
          accessibilityRole="button"
          accessibilityLabel="Solicitar préstamo"
        >
          <Ionicons name="add" size={scale(28)} color="#FFFFFF" />
        </Pressable>
      )}

      <ActionConfirmModal
        visible={!!accionModal}
        titulo={cfg?.titulo || ''}
        desc={cfg?.desc || ''}
        icon={cfg?.icon || ''}
        colorAccion={cfg?.color || ''}
        pedirMotivo={cfg?.pedirMotivo || false}
        confirmacionConHold={accionModal?.accion === 'RECHAZADO' || accionModal?.accion === 'CANCELAR'}
        danger={accionModal?.accion === 'RECHAZADO' || accionModal?.accion === 'CANCELAR'}
        subtitle={accionModal?.prestamo ? `Préstamo #${accionModal.prestamo.id.slice(0, 8)}` : undefined}
        estadoActual={accionModal?.prestamo?.estado}
        estadoNuevo={accionModal?.accion}
        prestamo={accionModal?.prestamo ? { monto: accionModal.prestamo.monto, numeroCuotas: accionModal.prestamo.numeroCuotas, frecuenciaPago: accionModal.prestamo.frecuenciaPago } : null}
        cliente={accionModal?.prestamo?.cliente ? { nombre: accionModal.prestamo.cliente.nombre, apellido: accionModal.prestamo.cliente.apellido } : null}
        loading={accionLoading}
        onConfirm={ejecutarAccion}
        onCancel={cerrarModal}
      />

      <DesembolsoModal
        visible={!!desembolsoPrestamo}
        onClose={() => setDesembolsoPrestamo(null)}
        onConfirm={confirmarDesembolso}
        loading={desembolsarMutation.isPending}
        monto={desembolsoPrestamo?.monto ?? 0}
        numeroCuotas={desembolsoPrestamo?.numeroCuotas ?? 0}
        tasaInteres={desembolsoPrestamo?.tasaInteres ?? 0}
        frecuenciaPago={desembolsoPrestamo?.frecuenciaPago ?? ''}
      />

      <ActionBottomSheet
        visible={filtroOpen}
        onClose={() => setFiltroOpen(false)}
        title="Filtrar por estado"
        subtitle="Selecciona un estado para filtrar los préstamos"
        groups={[
          {
            key: 'estados',
            actions: ESTADOS_FILTRO.map((e) => ({
              id: e.value,
              label: e.label,
              selected: filtroEstado === e.value,
              onPress: () => setFiltroEstado(e.value),
            })),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  filterTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  filterCount: {
    fontSize: FontSize.xs,
    marginTop: scale(1),
  },
  filterTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    minHeight: scale(44),
    paddingHorizontal: Spacing.sm + 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  filterTriggerText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  list: {
    padding: Spacing.md,
    paddingBottom: scale(100),
  },
  footerLoader: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  footerText: {
    fontSize: FontSize.sm,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: scale(56),
    height: scale(56),
    borderRadius: scale(28),
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
