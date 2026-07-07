import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ScreenContainer } from '@/components/ui/screen-container';
import { SkeletonKPIGrid } from '@/components/ui/skeleton';
import { Skeleton } from '@/components/ui/skeleton';
import EmptyState from '@/components/ui/empty-state';
import { DashboardHero } from '@/components/dashboard/dashboard-hero';
import { KPIGrid } from '@/components/dashboard/kpi-grid';
import { UpcomingCollections } from '@/components/dashboard/upcoming-collections';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { useDashboardMobile } from '@/hooks/use-dashboard';
import { useAuthStore } from '@/store/auth.store';
import { useTheme } from '@/components/ui/theme-provider';

export default function DashboardScreen() {
  const { colorScheme, colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const { data, isLoading, isError, refetch, isRefetching } = useDashboardMobile();

  if (isLoading && !data) {
    return (
      <ScreenContainer>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.heroSkeleton}>
            <Skeleton width="60%" height={28} />
            <Skeleton width="40%" height={16} style={{ marginTop: 8 }} />
            <Skeleton width="100%" height={80} style={{ marginTop: 16, borderRadius: 16 }} />
          </View>
          <SkeletonKPIGrid />
          <View style={styles.listSkeleton}>
            <Skeleton width="50%" height={20} />
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} width="100%" height={60} style={{ marginTop: 8, borderRadius: 12 }} />
            ))}
          </View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  if (isError) {
    return (
      <ScreenContainer>
        <EmptyState
          icon="cloud-offline-outline"
          title="Error al cargar"
          subtitle="No pudimos obtener los datos del dashboard. Revisa tu conexión."
          actionLabel="Reintentar"
          onAction={() => refetch()}
        />
      </ScreenContainer>
    );
  }

  if (!data) {
    return (
      <ScreenContainer>
        <EmptyState
          icon="folder-open-outline"
          title="Sin datos"
          subtitle="Aún no hay información para mostrar."
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
        }
      >
        <DashboardHero nombre={user?.nombre ?? 'Usuario'} caja={data.caja} />
        <KPIGrid portfolio={data.portfolio} today={data.today} />
        <UpcomingCollections cobros={data.proximosCobros} today={data.today} />
        <QuickActions />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  heroSkeleton: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  listSkeleton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});
