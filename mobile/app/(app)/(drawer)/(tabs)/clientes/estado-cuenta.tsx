import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { getEstadoCuenta } from '@/api/clientes.api';
import KpiCard from '@/components/clientes/kpi-card';
import EmptyState from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import LoadingScreen from '@/components/ui/loading-screen';
import { BorderRadius, FontSize, FontWeight, Shadows, Spacing } from '@/constants/theme';
import { formatCurrency, formatDate, formatDateShort } from '@/utils/formatters';
import type { EstadoCuentaResponse, PrestamoEstadoCuenta } from '@/types/cliente.types';
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
            subtitle={(error as any)?.message || 'No se pudo obtener el estado de cuenta'}
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
          <PrestamoCard key={p.id} prestamo={p} colors={colors} />
        ))}
        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </View>
  );
}

function ClienteSummary({ data, colors }: { data: EstadoCuentaResponse; colors: any }) {
  const c = data.cliente;
  return (
    <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }, Shadows.sm]}>
      <View style={styles.summaryRow}>
        <View style={[styles.avatar, { backgroundColor: colors.primaryLight }]}>
          <Text style={[styles.avatarText, { color: colors.primary }]}>
            {c.nombre.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.summaryInfo}>
          <Text style={[styles.summaryName, { color: colors.text }]}>{c.nombre}</Text>
          <Text style={[styles.summaryDetail, { color: colors.textSecondary }]}>
            Cédula: {c.cedula || 'N/A'}
          </Text>
          {c.celular && (
            <Text style={[styles.summaryDetail, { color: colors.textSecondary }]}>
              {c.celular}
            </Text>
          )}
        </View>
      </View>
      {c.direccion && (
        <Text style={[styles.summaryAddress, { color: colors.textTertiary }]}>
          <Ionicons name="location-outline" size={12} color={colors.textTertiary} /> {c.direccion}
          {c.sector ? `, ${c.sector}` : ''}
          {c.municipio ? `, ${c.municipio}` : ''}
        </Text>
      )}
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

const ESTADO_LABEL: Record<string, string> = {
  ACTIVO: 'Activo',
  ATRASADO: 'Atrasado',
  PAGADO: 'Pagado',
  CANCELADO: 'Cancelado',
};

const ESTADO_ACCENT: Record<string, 'success' | 'danger' | 'info' | 'warning'> = {
  ACTIVO: 'success',
  ATRASADO: 'danger',
  PAGADO: 'info',
  CANCELADO: 'warning',
};

function PrestamoCard({ prestamo, colors }: { prestamo: PrestamoEstadoCuenta; colors: any }) {
  const [showCuotas, setShowCuotas] = useState(false);
  const [showPagos, setShowPagos] = useState(false);

  const progress = prestamo.totalCuotas > 0
    ? Math.round((prestamo.cuotasPagadas / prestamo.totalCuotas) * 100)
    : 0;

  const accent = ESTADO_ACCENT[prestamo.estado] || 'warning';
  const label = ESTADO_LABEL[prestamo.estado] || prestamo.estado;

  return (
    <View style={[styles.loanCard, { backgroundColor: colors.surface, borderColor: colors.border }, Shadows.sm]}>
      <View style={styles.loanHeader}>
        <Text style={[styles.loanId, { color: colors.textTertiary }]}>
          #{prestamo.id.slice(0, 8)}
        </Text>
        <View style={[styles.estadoBadge, { backgroundColor: (colors as any)[`${accent}Light`] }]}>
          <Text style={[styles.estadoText, { color: (colors as any)[accent] }]}>{label}</Text>
        </View>
      </View>

      <View style={styles.loanAmountRow}>
        <Text style={[styles.loanAmount, { color: colors.text }]}>
          {formatCurrency(prestamo.monto)}
        </Text>
        <Text style={[styles.loanFreq, { color: colors.textSecondary }]}>
          {prestamo.frecuencia}
        </Text>
      </View>

      <View style={styles.loanInfoGrid}>
        <InfoRow icon="cash-outline" label="Saldo" value={formatCurrency(prestamo.saldo)} colors={colors} />
        <InfoRow icon="trending-up-outline" label="Interés" value={`${prestamo.tasaInteres}%`} colors={colors} />
        <InfoRow icon="calendar-outline" label="Inicio" value={formatDateShort(prestamo.fechaInicio)} colors={colors} />
        <InfoRow icon="alert-circle-outline" label="Mora" value={formatCurrency(prestamo.moraAcumulada)} colors={colors} />
      </View>

      <View style={styles.progressSection}>
        <View style={styles.progressHeader}>
          <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
            Cuotas: {prestamo.cuotasPagadas}/{prestamo.totalCuotas}
          </Text>
          <Text style={[styles.progressPct, { color: colors.primary }]}>{progress}%</Text>
        </View>
        <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${progress}%`,
                backgroundColor: progress === 100 ? colors.success : colors.primary,
              },
            ]}
          />
        </View>
      </View>

      {prestamo.proximaFecha && (
        <View style={[styles.nextPayment, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
          <Ionicons name="calendar" size={14} color={colors.primary} />
          <Text style={[styles.nextPaymentText, { color: colors.primary }]}>
            Próximo pago: {formatDateShort(prestamo.proximaFecha)} — {formatCurrency(prestamo.proximaMonto)}
          </Text>
        </View>
      )}

      {prestamo.cuotasPendientesDetalle.length > 0 && (
        <TouchableOpacity
          style={[styles.collapseBtn, { borderTopColor: colors.borderLight }]}
          onPress={() => setShowCuotas(!showCuotas)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={showCuotas ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.textSecondary}
          />
          <Text style={[styles.collapseLabel, { color: colors.textSecondary }]}>
            Cuotas pendientes ({prestamo.cuotasPendientesDetalle.length})
          </Text>
        </TouchableOpacity>
      )}

      {showCuotas && prestamo.cuotasPendientesDetalle.length > 0 && (
        <View style={[styles.table, { borderColor: colors.borderLight }]}>
          <View style={[styles.tableHeader, { backgroundColor: colors.borderLight }]}>
            <Text style={[styles.tableCell, styles.colNum, { color: colors.textSecondary, fontWeight: FontWeight.semibold, fontSize: FontSize.xs }]}>#</Text>
            <Text style={[styles.tableCell, styles.colDate, { color: colors.textSecondary, fontWeight: FontWeight.semibold, fontSize: FontSize.xs }]}>Vence</Text>
            <Text style={[styles.tableCell, styles.colMonto, { color: colors.textSecondary, fontWeight: FontWeight.semibold, fontSize: FontSize.xs }]}>Monto</Text>
            <Text style={[styles.tableCell, styles.colStatusText, { color: colors.textSecondary, fontWeight: FontWeight.semibold, fontSize: FontSize.xs }]}>Estado</Text>
          </View>
          {prestamo.cuotasPendientesDetalle.map((c, i) => (
            <View key={i} style={[styles.tableRow, i % 2 === 1 && { backgroundColor: colors.borderLight }]}>
              <Text style={[styles.tableCell, styles.colNum, { color: colors.text, fontSize: FontSize.xs }]}>#{c.numero}</Text>
              <Text style={[styles.tableCell, styles.colDate, { color: colors.textSecondary, fontSize: FontSize.xs }]}>
                {formatDateShort(c.fechaVencimiento)}
              </Text>
              <Text style={[styles.tableCell, styles.colMonto, { color: colors.text, fontSize: FontSize.xs }]}>
                {formatCurrency(c.monto)}
              </Text>
              <View style={[styles.tableCell, styles.colStatus]}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: c.vencida ? colors.error : colors.success },
                  ]}
                />
                <Text
                  style={[
                    styles.statusLabel,
                    { color: c.vencida ? colors.error : colors.success, fontSize: FontSize.xs },
                  ]}
                >
                  {c.vencida ? 'Vencida' : 'Pendiente'}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {prestamo.pagos.length > 0 && (
        <TouchableOpacity
          style={[styles.collapseBtn, { borderTopColor: colors.borderLight }]}
          onPress={() => setShowPagos(!showPagos)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={showPagos ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.textSecondary}
          />
          <Text style={[styles.collapseLabel, { color: colors.textSecondary }]}>
            Historial de pagos ({prestamo.pagos.length})
          </Text>
        </TouchableOpacity>
      )}

      {showPagos && prestamo.pagos.length > 0 && (
        <View style={[styles.pagosList, { borderColor: colors.borderLight }]}>
          {prestamo.pagos.map((p, i) => (
            <View
              key={i}
              style={[
                styles.pagoRow,
                { borderBottomColor: colors.borderLight },
                i === prestamo.pagos.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <View style={styles.pagoLeft}>
                <Text style={[styles.pagoFecha, { color: colors.text }]}>
                  {formatDateShort(p.fecha)}
                </Text>
                <Text style={[styles.pagoCobrador, { color: colors.textTertiary }]}>
                  {p.cobrador} · {p.metodo}
                </Text>
              </View>
              <View style={styles.pagoRight}>
                <Text style={[styles.pagoTotal, { color: colors.text }]}>
                  {formatCurrency(p.total)}
                </Text>
                <Text style={[styles.pagoDetalle, { color: colors.textTertiary }]}>
                  C: {formatCurrency(p.capital)} I: {formatCurrency(p.interes)}
                  {p.mora > 0 ? ` M: ${formatCurrency(p.mora)}` : ''}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function InfoRow({ icon, label, value, colors }: { icon: string; label: string; value: string; colors: any }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon as any} size={13} color={colors.textTertiary} />
      <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>{label}:</Text>
      <Text style={[styles.infoValue, { color: colors.text }]}>{value}</Text>
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
  summaryCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  avatarText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  summaryInfo: {
    flex: 1,
  },
  summaryName: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    marginBottom: 2,
  },
  summaryDetail: {
    fontSize: FontSize.sm,
  },
  summaryAddress: {
    fontSize: FontSize.xs,
    marginTop: Spacing.sm,
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
  loanCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  loanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  loanId: {
    fontSize: FontSize.xs,
  },
  estadoBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  estadoText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  loanAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  loanAmount: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
  },
  loanFreq: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  loanInfoGrid: {
    gap: 4,
    marginBottom: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoLabel: {
    fontSize: FontSize.xs,
    width: 60,
  },
  infoValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  progressSection: {
    marginBottom: Spacing.sm,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: FontSize.xs,
  },
  progressPct: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  nextPayment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  nextPaymentText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    flex: 1,
  },
  collapseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
  },
  collapseLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  table: {
    borderTopWidth: 1,
    marginBottom: Spacing.sm,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  tableCell: {},
  colNum: {
    width: 40,
  },
  colDate: {
    flex: 1,
  },
  colMonto: {
    width: 80,
    textAlign: 'right',
  },
  colStatus: {
    width: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  colStatusText: {
    width: 72,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusLabel: {},
  pagosList: {
    borderTopWidth: 1,
    marginBottom: Spacing.sm,
  },
  pagoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
  },
  pagoLeft: {
    flex: 1,
  },
  pagoFecha: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  pagoCobrador: {
    fontSize: FontSize.xs,
    marginTop: 1,
  },
  pagoRight: {
    alignItems: 'flex-end',
  },
  pagoTotal: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  pagoDetalle: {
    fontSize: 10,
    marginTop: 1,
  },
});
