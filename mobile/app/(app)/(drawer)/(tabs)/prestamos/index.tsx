import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Keyboard, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
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
import { useToast } from '@/components/ui/toast';
import { useAuthStore } from '@/store/auth.store';
import { FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { ESTADO_CONFIG as BASE_ESTADO_CONFIG, ACCIONES_FLOW_CONFIG } from '@/constants/prestamos.constants';
import { formatCurrency } from '@/utils/formatters';
import { useCambiarEstadoPrestamo,
  useDesembolsarPrestamo,
  useCancelarPrestamo } from '@/hooks/use-prestamos';
import type { EstadoPrestamo } from '@/types/prestamo.types';
import { useTheme } from '@/components/ui/theme-provider';

const PAGE_SIZE = 20;

const ESTADOS_FILTRO: { label: string; value: EstadoPrestamo | '' }[] = [
  { label: 'Todos', value: '' },
  { label: 'Activo', value: 'ACTIVO' },
  { label: 'Atrasado', value: 'ATRASADO' },
  { label: 'Pagado', value: 'PAGADO' },
  { label: 'Cancelado', value: 'CANCELADO' },
  { label: 'Solicitado', value: 'SOLICITADO' },
  { label: 'Revisión', value: 'EN_REVISION' },
  { label: 'Aprobado', value: 'APROBADO' },
  { label: 'Rechazado', value: 'RECHAZADO' },
];

const ACCION_CONFIG: Record<string, { titulo: string; desc: string; icon: string; color: string; pedirMotivo: boolean }> = {
  ...ACCIONES_FLOW_CONFIG,
  DESEMBOLSAR: { titulo: 'Desembolsar Préstamo', desc: 'Se generarán las cuotas, el monto saldrá de tu caja.', icon: 'cash-outline', color: '#1A56DB', pedirMotivo: false },
};

function usePrestamosInfinite(search: string, estado: EstadoPrestamo | '') {
  return useInfiniteQuery({
    queryKey: ['prestamos', search, estado],
    queryFn: ({ pageParam = 1 }) =>
      listar({
        page: pageParam,
        limit: PAGE_SIZE,
        search: search || undefined,
        estado: estado || undefined,
      }),
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
  const isAdmin = user?.rol === 'SUPERADMIN' || user?.rol === 'ADMIN';
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<EstadoPrestamo | ''>('');
  const [accionModal, setAccionModal] = useState<{ prestamo: any; accion: string; estado: string } | null>(null);
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
      if (accion === 'DESEMBOLSAR') {
        await desembolsarMutation.mutateAsync(prestamo.id);
        showToast('Préstamo desembolsado correctamente', 'success');
      } else if (accion === 'CANCELAR') {
        await cancelarMutation.mutateAsync(prestamo.id);
        showToast('Préstamo cancelado correctamente', 'success');
      } else {
        await cambiarEstadoMutation.mutateAsync({
          id: prestamo.id,
          data: { estado: estado as EstadoPrestamo, motivo },
        });
        showToast(`Estado actualizado a ${estado}`, 'success');
      }
      setAccionModal(null);
    } catch (err: any) {
      setAccionModal(null);
      showToast(err?.message || 'Error al ejecutar acción', 'error');
    }
  }, [accionModal, cambiarEstadoMutation, desembolsarMutation, cancelarMutation, showToast]);

  const abrirModal = useCallback((prestamo: any, accion: string, estado: string) => {
    setAccionModal({ prestamo, accion, estado });
  }, []);

  const cerrarModal = useCallback(() => {
    setAccionModal(null);
  }, []);

  const renderItem = useCallback(
    ({ item }: any) => {
      const puedeDesembolsar = item.estado === 'APROBADO' && isAdmin;
      const enFlujoAdmin = isAdmin && ['SOLICITADO', 'EN_REVISION', 'APROBADO'].includes(item.estado);

      return (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <PrestamoCard
            prestamo={item}
            onPress={() => router.push(`/prestamos/${item.id}`)}
          />
          {enFlujoAdmin && (
            <View style={styles.cardActions}>
              {item.estado === 'SOLICITADO' && (
                <>
                  <Pressable
                    onPress={() => abrirModal(item, 'EN_REVISION', 'EN_REVISION')}
                    style={[styles.actionBtn, { backgroundColor: colors.infoLight, borderColor: colors.info }]}
                  >
                    <Text style={[styles.actionBtnText, { color: colors.info }]}>Revisar</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => abrirModal(item, 'RECHAZADO', 'RECHAZADO')}
                    style={[styles.actionBtn, { backgroundColor: colors.errorLight, borderColor: colors.error }]}
                  >
                    <Text style={[styles.actionBtnText, { color: colors.error }]}>Rechazar</Text>
                  </Pressable>
                </>
              )}
              {item.estado === 'EN_REVISION' && (
                <>
                  <Pressable
                    onPress={() => abrirModal(item, 'APROBADO', 'APROBADO')}
                    style={[styles.actionBtn, { backgroundColor: colors.successLight, borderColor: colors.success }]}
                  >
                    <Text style={[styles.actionBtnText, { color: colors.success }]}>Aprobar</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => abrirModal(item, 'RECHAZADO', 'RECHAZADO')}
                    style={[styles.actionBtn, { backgroundColor: colors.errorLight, borderColor: colors.error }]}
                  >
                    <Text style={[styles.actionBtnText, { color: colors.error }]}>Rechazar</Text>
                  </Pressable>
                </>
              )}
              {item.estado === 'APROBADO' && (
                <>
                  {puedeDesembolsar && (
                    <Pressable
                      onPress={() => abrirModal(item, 'DESEMBOLSAR', 'ACTIVO')}
                      style={[styles.actionBtn, { backgroundColor: '#E8EFFB', borderColor: colors.primary }]}
                    >
                      <Ionicons name="cash" size={14} color={colors.primary} />
                      <Text style={[styles.actionBtnText, { color: colors.primary }]}>Desembolsar</Text>
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => abrirModal(item, 'RECHAZADO', 'RECHAZADO')}
                    style={[styles.actionBtn, { backgroundColor: colors.errorLight, borderColor: colors.error }]}
                  >
                    <Text style={[styles.actionBtnText, { color: colors.error }]}>Rechazar</Text>
                  </Pressable>
                </>
              )}
            </View>
          )}
        </View>
      );
    },
    [colors, isAdmin, abrirModal],
  );

  const renderSeparator = useCallback(
    () => <View style={{ height: Spacing.sm }} />,
    [],
  );

  const ESTADO_CONFIG = BASE_ESTADO_CONFIG;

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
            <SkeletonCard key={i} lines={3} style={{ marginBottom: 8 }} />
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
          subtitle={(error as any)?.message || 'Error al cargar préstamos'}
          actionLabel="Reintentar"
          onAction={() => refetch()}
        />
      </View>
    );
  }

  const cfg = accionModal ? ACCION_CONFIG[accionModal.accion] : null;
  const accionLoading = accionModal?.accion === 'DESEMBOLSAR' ? desembolsarMutation.isPending
    : accionModal?.accion === 'CANCELAR' ? cancelarMutation.isPending
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
        <Text style={[styles.filterTitle, { color: colors.text }]}>
          Préstamos
        </Text>
        <Text style={[styles.filterCount, { color: colors.textTertiary }]}>
          {totalPrestamos} en total
        </Text>
      </View>

      <View style={{ height: 36 }}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={ESTADOS_FILTRO}
          keyExtractor={(item) => item.value}
          contentContainerStyle={styles.chipsContainer}
          renderItem={({ item }) => {
          const active = filtroEstado === item.value;
          const c = item.value ? ESTADO_CONFIG[item.value] : null;
          return (
            <Pressable
              onPress={() => setFiltroEstado(item.value)}
              style={[
                styles.chip,
                active
                  ? c
                    ? { backgroundColor: c.bg, borderColor: c.border }
                    : { backgroundColor: colors.primary, borderColor: colors.primary }
                  : { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  active
                    ? c
                      ? { color: c.text }
                      : { color: '#FFFFFF' }
                    : { color: colors.textSecondary },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        }}
      />
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
              actionLabel="Solicitar préstamo"
              onAction={() => router.push('/prestamos/nuevo')}
            />
          )
        ) : (
          <FlatList
            ref={listRef}
            data={prestamos}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
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

      <Pressable
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => router.push('/prestamos/nuevo')}
        accessibilityRole="button"
        accessibilityLabel="Solicitar préstamo"
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </Pressable>

      <ActionConfirmModal
        visible={!!accionModal}
        titulo={cfg?.titulo || ''}
        desc={cfg?.desc || ''}
        icon={cfg?.icon || ''}
        colorAccion={cfg?.color || ''}
        pedirMotivo={cfg?.pedirMotivo || false}
        prestamo={accionModal?.prestamo ? { monto: accionModal.prestamo.monto, numeroCuotas: accionModal.prestamo.numeroCuotas, frecuenciaPago: accionModal.prestamo.frecuenciaPago } : null}
        cliente={accionModal?.prestamo?.cliente ? { nombre: accionModal.prestamo.cliente.nombre, apellido: accionModal.prestamo.cliente.apellido } : null}
        loading={accionLoading}
        onConfirm={ejecutarAccion}
        onCancel={cerrarModal}
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
    marginTop: 1,
  },
  chipsContainer: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  chip: {
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  chipText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  list: {
    padding: Spacing.md,
    paddingBottom: 100,
  },
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
  },
  cardActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
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
