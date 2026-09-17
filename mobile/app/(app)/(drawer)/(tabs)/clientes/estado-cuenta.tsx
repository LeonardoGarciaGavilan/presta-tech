import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { getEstadoCuenta } from '@/api/clientes.api';
import ClienteSummary from '@/components/clientes/cliente-summary-card';
import KpiCard from '@/components/clientes/kpi-card';
import PrestamoEstadoCuentaCard from '@/components/clientes/prestamo-estado-cuenta-card';
import EmptyState from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { SkeletonCard, SkeletonKPIGrid } from '@/components/ui/skeleton';
import { FontSize, Spacing, scale } from '@/constants/theme';
import { formatCurrency, formatDateShort } from '@/utils/formatters';
import type { EstadoCuentaResponse } from '@/types/cliente.types';
import { useTheme } from '@/components/ui/theme-provider';
import { useNetworkStatus } from '@/hooks/use-network-status';

export default function EstadoCuentaScreen() {
  const { id } = useLocalSearchParams<{ id: string; nombre?: string; cedula?: string }>();
  const { colors } = useTheme();
  const { isOnline } = useNetworkStatus();

  const { data, isLoading, error, refetch, isFetching } = useQuery<EstadoCuentaResponse>({
    queryKey: ['estado-cuenta', id],
    queryFn: () => getEstadoCuenta(id!),
    enabled: !!id,
  });

  if (isLoading)
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <PageHeader title="Estado de Cuenta" />
        <ScrollView contentContainerStyle={styles.content}>
          <SkeletonCard lines={2} />
          <SkeletonKPIGrid />
          <SkeletonCard lines={6} style={{ marginTop: scale(16) }} />
          <SkeletonCard lines={6} style={{ marginTop: scale(16) }} />
        </ScrollView>
      </View>
    );

  if (error) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <PageHeader title="Estado de Cuenta" />
        <View style={{ flex: 1, justifyContent: 'center' }}>
          {!isOnline ? (
            <EmptyState
              icon="cloud-offline-outline"
              title="Sin conexión"
              subtitle="El estado de cuenta se genera en línea. Conéctate e inténtalo de nuevo."
              actionLabel="Volver"
              onAction={() => router.back()}
            />
          ) : (
            <EmptyState
              icon="alert-circle-outline"
              title="Error al cargar"
              subtitle="No pudimos cargar el estado de cuenta. Intenta de nuevo."
              actionLabel="Reintentar"
              onAction={() => refetch()}
            />
          )}
        </View>
      </View>
    );
  }

  if (!data || data.prestamos.length === 0) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <PageHeader title="Estado de Cuenta" />
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            icon="receipt-outline"
            title="Sin préstamos"
            subtitle="Este cliente no tiene préstamos registrados"
            actionLabel="Volver"
            onAction={() => router.back()}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <PageHeader title="Estado de Cuenta" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={() => refetch()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <ClienteSummary data={data} />
        <GeneratedDate date={data.fechaGenerado} />
        <KpiGrid data={data} />
        {data.prestamos.map((p) => (
          <PrestamoEstadoCuentaCard key={p.id} prestamo={p} />
        ))}
        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </View>
  );
}

function GeneratedDate({ date }: { date: string }) {
  const { colors } = useTheme();
  return (
    <Text style={[styles.generatedDate, { color: colors.textTertiary }]}>
      Generado: {formatDateShort(date)}
    </Text>
  );
}

function KpiGrid({ data }: { data: EstadoCuentaResponse }) {
  return (
    <View style={styles.kpiGrid}>
      <KpiCard
        icon="documents-outline"
        value={String(data.totalPrestamos)}
        label="Total préstamos"
        accent="primary"
        delay={0}
        width="47%"
      />
      <KpiCard
        icon="checkmark-circle-outline"
        value={String(data.prestamosActivos)}
        label="Préstamos activos"
        accent="success"
        delay={50}
        width="47%"
      />
      <KpiCard
        icon="cash-outline"
        value={formatCurrency(data.totalPagado)}
        label="Total pagado"
        accent="info"
        delay={100}
        width="47%"
      />
      <KpiCard
        icon="trending-up-outline"
        value={formatCurrency(data.totalSaldo)}
        label="Saldo pendiente"
        accent="primary"
        delay={150}
        width="47%"
      />
      <KpiCard
        icon="alert-circle-outline"
        value={formatCurrency(data.totalMora)}
        label="Mora acumulada"
        accent="danger"
        delay={200}
        width="100%"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: Spacing.md,
  },
  generatedDate: {
    fontSize: FontSize.xs,
    textAlign: 'right',
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
});