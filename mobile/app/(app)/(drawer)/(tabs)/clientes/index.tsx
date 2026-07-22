import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Keyboard, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';

import { listar, eliminar, reactivar } from '@/api/clientes.api';
import ClienteCard from '@/components/clientes/cliente-card';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import EmptyState from '@/components/ui/empty-state';
import LoadingScreen from '@/components/ui/loading-screen';
import ScrollToTopButton from '@/components/ui/scroll-to-top';
import SearchBar from '@/components/ui/search-bar';
import { SkeletonCard } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { FontSize, FontWeight, Spacing, BorderRadius, scale } from '@/constants/theme';
import { useTheme } from '@/components/ui/theme-provider';

const PAGE_SIZE = 20;

function useClientesInfinite(search: string, verInactivos: boolean) {
  return useInfiniteQuery({
    queryKey: ['clientes', search, verInactivos],
    queryFn: ({ pageParam = 1 }) =>
      listar(
        {
          page: pageParam,
          limit: PAGE_SIZE,
          search: search || undefined,
        },
        verInactivos,
      ),
    getNextPageParam: (lastPage) => {
      if (lastPage.pagina < lastPage.totalPaginas) {
        return lastPage.pagina + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
  });
}

export default function ClientesListScreen() {
  const { colorScheme, colors } = useTheme();

  const [search, setSearch] = useState('');
  const [verInactivos, setVerInactivos] = useState(false);
  const [dialogAction, setDialogAction] = useState<'deshabilitar' | 'habilitar' | null>(null);
  const [dialogClient, setDialogClient] = useState<{ id: string; nombre: string } | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const listRef = useRef<FlatList<any>>(null);
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const {
    data,
    isLoading,
    error,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useClientesInfinite(search, verInactivos);

  const clientes = useMemo(() => {
    const all = data?.pages.flatMap((page) => page.data) ?? [];
    const seen = new Set<string>();
    return all.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [data]);

  const totalClientes = data?.pages[0]?.total ?? 0;

  const handleSearch = useCallback((text: string) => {
    setSearch(text);
  }, []);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleToggleFilter = useCallback(() => {
    setVerInactivos((prev) => !prev);
  }, []);

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleEdit = useCallback((id: string) => {
    router.push(`/clientes/${id}?edit=true`);
  }, []);

  const handleEstadoCuenta = useCallback((id: string) => {
    router.push(`/clientes/estado-cuenta?id=${id}`);
  }, []);

  const renderItem = useCallback(
    ({ item }: any) => (
      <ClienteCard
        cliente={item}
        onPress={() => router.push(`/clientes/${item.id}`)}
        onEstadoCuenta={() => handleEstadoCuenta(item.id)}
        onEdit={() => handleEdit(item.id)}
        onToggleStatus={() => {
          const c = item as { id: string; nombre: string; activo: boolean };
          setDialogClient({ id: c.id, nombre: c.nombre });
          setDialogAction(c.activo ? 'deshabilitar' : 'habilitar');
        }}
      />
    ),
    [handleEdit, handleEstadoCuenta],
  );

  const renderSeparator = useCallback(
    () => <View style={[styles.separator, { height: Spacing.sm }]} />,
    [],
  );

  if (isLoading && !data) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={styles.searchContainer}>
          <SearchBar
            value={search}
            onSearch={handleSearch}
            placeholder="Buscar clientes..."
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

  if (error && clientes.length === 0) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={styles.searchContainer}>
          <SearchBar
            value={search}
            onSearch={handleSearch}
            placeholder="Buscar clientes..."
          />
        </View>
        <EmptyState
          icon="alert-circle-outline"
          title="Error al cargar clientes"
          subtitle={error?.message || 'Error al cargar clientes'}
          actionLabel="Reintentar"
          onAction={() => refetch()}
        />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.searchContainer}>
        <SearchBar
          value={search}
          onSearch={handleSearch}
          placeholder="Buscar clientes..."
        />
      </View>

      <View style={styles.filterRow}>
        <View style={styles.filterLeft}>
          <Text style={[styles.filterTitle, { color: colors.text }]}>
            {verInactivos ? 'Clientes inactivos' : 'Clientes activos'}
          </Text>
          <Text style={[styles.filterCount, { color: colors.textTertiary }]}>
            {totalClientes} en total
          </Text>
        </View>
        <Pressable
          onPress={handleToggleFilter}
          accessibilityRole="button"
          accessibilityLabel={verInactivos ? 'Ver clientes activos' : 'Ver clientes inactivos'}
          style={[
            styles.filterToggle,
            {
              backgroundColor: verInactivos
                ? colors.secondaryLight
                : colors.primaryLight,
              borderColor: verInactivos ? colors.secondary : colors.primary,
            },
          ]}
        >
          <Ionicons
            name={verInactivos ? 'checkmark-circle' : 'eye-off-outline'}
            size={scale(14)}
            color={verInactivos ? colors.secondary : colors.primary}
          />
          <Text
            style={[
              styles.filterToggleText,
              {
                color: verInactivos ? colors.secondary : colors.primary,
              },
            ]}
          >
            {verInactivos ? 'Ver activos' : 'Ver inactivos'}
          </Text>
        </Pressable>
      </View>

      {clientes.length === 0 && !isFetching ? (
        search ? (
          <EmptyState
            icon="search-outline"
            title="Sin resultados"
            subtitle={`No se encontraron clientes que coincidan con "${search}"`}
          />
        ) : (
          <EmptyState
            icon="people-outline"
            title={
              verInactivos
                ? 'No hay clientes inactivos'
                : 'No hay clientes activos'
            }
            subtitle="Aún no se han registrado clientes"
            actionLabel={!verInactivos ? 'Crear cliente' : undefined}
            onAction={
              !verInactivos
                ? () => router.push('/clientes/crear')
                : undefined
            }
          />
        )
      ) : (
        <FlatList
          ref={listRef}
          data={clientes}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={renderSeparator}
          keyboardShouldPersistTaps="handled"
          accessibilityRole="list"
          accessibilityLabel={`Lista de clientes, ${totalClientes} en total`}
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
                <Text
                  style={[styles.footerText, { color: colors.textTertiary }]}
                >
                  Cargando más...
                </Text>
              </View>
            ) : null
          }
        />
      )}

      <ConfirmDialog
        visible={dialogAction === 'deshabilitar'}
        title="Deshabilitar cliente"
        message={`¿Estás seguro de deshabilitar a ${dialogClient?.nombre}?`}
        confirmLabel="Deshabilitar"
        destructive
        onConfirm={async () => {
          if (!dialogClient) return;
          try {
            await eliminar(dialogClient.id);
            queryClient.invalidateQueries({ queryKey: ['clientes'] });
            setDialogAction(null);
            setDialogClient(null);
          } catch (err: any) {
            showToast(err?.message || 'Error al deshabilitar', 'error');
          }
        }}
        onCancel={() => { setDialogAction(null); setDialogClient(null); }}
      />
      <ConfirmDialog
        visible={dialogAction === 'habilitar'}
        title="Habilitar cliente"
        message={`¿Estás seguro de habilitar a ${dialogClient?.nombre}?`}
        confirmLabel="Habilitar"
        onConfirm={async () => {
          if (!dialogClient) return;
          try {
            await reactivar(dialogClient.id);
            queryClient.invalidateQueries({ queryKey: ['clientes'] });
            setDialogAction(null);
            setDialogClient(null);
          } catch (err: any) {
            showToast(err?.message || 'Error al habilitar', 'error');
          }
        }}
        onCancel={() => { setDialogAction(null); setDialogClient(null); }}
      />

      {clientes.length > 0 && (
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
        onPress={() => router.push('/clientes/crear')}
        accessibilityRole="button"
        accessibilityLabel="Crear cliente"
      >
        <Ionicons name="add" size={scale(28)} color="#FFFFFF" />
      </Pressable>
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
    paddingBottom: Spacing.sm,
  },
  filterLeft: {
    flex: 1,
  },
  filterTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  filterCount: {
    fontSize: FontSize.xs,
    marginTop: scale(1),
  },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  filterToggleText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  list: {
    padding: Spacing.md,
    paddingBottom: scale(100),
  },
  separator: {},
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
