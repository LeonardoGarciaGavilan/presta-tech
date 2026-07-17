import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { getEstadoCuenta } from '@/api/clientes.api';
import ClienteSummary from '@/components/clientes/cliente-summary-card';
import KpiCard from '@/components/clientes/kpi-card';
import PrestamoEstadoCuentaCard from '@/components/clientes/prestamo-estado-cuenta-card';
import EmptyState from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import LoadingScreen from '@/components/ui/loading-screen';
import { BorderRadius, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { formatCurrency, formatDateShort } from '@/utils/formatters';
import type { EstadoCuentaResponse } from '@/types/cliente.types';
import { useTheme } from '@/components/ui/theme-provider';

export default function EstadoCuentaScreen() {
  const { id, nombre, cedula } = useLocalSearchParams<{ id: string; nombre?: string; cedula?: string }>();
  const { colorScheme, colors } = useTheme();

  const { data, isLoading, error, refetch, isFetching } = useQuery<EstadoCuentaResponse>({
    queryKey: ['estado-cuenta', id],
    queryFn: () => getEstadoCuenta(id!),
    enabled: !!id,
  });

  if (isLoading)
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <PageHeader title="Estado de Cuenta" />
        <LoadingScreen />
      </View>
    );

  if (error) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <PageHeader title="Estado de Cuenta" />
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            icon="alert-circle-outline"
            title="Error al cargar"
            subtitle={error instanceof Error ? error.message : 'No se pudo obtener el estado de cuenta'}
            actionLabel="Reintentar"
            onAction={() => refetch()}
          />
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
        <ClienteSummary data={data} colors={colors} />
        <GeneratedDate date={data.fechaGenerado} colors={colors} />
        <KpiGrid data={data} colors={colors} />
        {data.prestamos.map((p) => (
          <PrestamoEstadoCuentaCard key={p.id} prestamo={p} colors={colors} />
        ))}
        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </View>
  );
}

function GeneratedDate({ date, colors }: { date: string; colors: any }) {
  return (
    <Text style={[styles.generatedDate, { color: colors.textTertiary }]}>
      Generado: {formatDateShort(date)}
    </Text>
  );
}

function KpiGrid({ data, colors }: { data: EstadoCuentaResponse; colors: any }) {
  return (
    <View style={styles.kpiSection}>
      <View style={styles.kpiRow}>
        <View style={styles.kpiCol}>
          <KpiCard
            icon="documents-outline"
            value={String(data.totalPrestamos)}
            label="Total préstamos"
            accent="primary"
            delay={0}
          />
        </View>
        <View style={styles.kpiCol}>
          <KpiCard
            icon="checkmark-circle-outline"
            value={String(data.prestamosActivos)}
            label="Préstamos activos"
            accent="success"
            delay={50}
          />
        </View>
        <View style={styles.kpiCol}>
          <KpiCard
            icon="cash-outline"
            value={formatCurrency(data.totalPagado)}
            label="Total pagado"
            accent="info"
            delay={100}
          />
        </View>
      </View>
      <View style={styles.kpiRow}>
        <View style={[styles.kpiCol, { flex: 1 }]}>
          <KpiCard
            icon="trending-up-outline"
            value={formatCurrency(data.totalSaldo)}
            label="Saldo pendiente"
            accent="warning"
            delay={150}
          />
        </View>
        <View style={[styles.kpiCol, { flex: 1 }]}>
          <KpiCard
            icon="alert-circle-outline"
            value={formatCurrency(data.totalMora)}
            label="Mora acumulada"
            accent="danger"
            delay={200}
          />
        </View>
      </View>
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
  kpiSection: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  kpiCol: {
    flex: 1,
  },
});
