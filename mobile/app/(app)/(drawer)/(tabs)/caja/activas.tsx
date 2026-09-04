import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ui/screen-container';
import { PageHeader } from '@/components/ui/page-header';
import LoadingScreen from '@/components/ui/loading-screen';
import EmptyState from '@/components/ui/empty-state';
import DetalleSesionModal from '@/components/caja/detalle-sesion-modal';
import ModalCerrarCaja from '@/components/caja/cerrar-caja-modal';
import { useToast } from '@/components/ui/toast';
import { useCajas, useCerrarCaja } from '@/hooks/use-caja';
import { AppStyles, FontSize, FontWeight, Spacing, BorderRadius, scale} from '@/constants/theme';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { m } from '@/utils/money';
import { useTheme } from '@/components/ui/theme-provider';
import { usePermisos } from '@/permisos/use-permisos';

type RiskLevel = 'critico' | 'alerta' | 'normal';

interface CajaConRiesgo {
  caja: any;
  nivel: RiskLevel;
  razones: string[];
  horasAbierta: number;
}

function calcularRiesgo(caja: any): CajaConRiesgo {
  if (!caja?.createdAt) return { caja, nivel: 'normal', razones: [], horasAbierta: 0 };
  const creado = new Date(caja.createdAt).getTime();
  const horasAbierta = (Date.now() - creado) / 3_600_000;
  const razones: string[] = [];
  if (horasAbierta > 12) {
    razones.push(`Abierta >12h (${Math.round(horasAbierta)}h)`);
  } else if (horasAbierta > 8) {
    razones.push(`Abierta >8h (${Math.round(horasAbierta)}h)`);
  }
  const ingresos = m(caja.ingresosCalc);
  if (ingresos === 0 && horasAbierta > 4) {
    razones.push('Sin movimientos >4h');
  }
  if (ingresos < m(caja.montoInicial) * 0.05 && horasAbierta > 2 && m(caja.montoInicial) > 0) {
    razones.push('Baja productividad');
  }
  const nivel: RiskLevel = razones.some((r) => r.includes('>12h')) ? 'critico' : razones.length > 0 ? 'alerta' : 'normal';
  return { caja, nivel, razones, horasAbierta };
}

function riskConfig(nivel: RiskLevel, colors: any) {
  switch (nivel) {
    case 'critico':
      return { label: 'Crítico', color: colors.error, bg: colors.errorLight, icon: 'alert-circle' as const };
    case 'alerta':
      return { label: 'Alerta', color: colors.warning, bg: colors.warningLight, icon: 'warning-outline' as const };
    default:
      return { label: 'Normal', color: colors.success, bg: colors.successLight, icon: 'checkmark-circle' as const };
  }
}

function formatHoras(horas: number) {
  if (horas < 1) return `hace ${Math.round(horas * 60)}m`;
  return `hace ${Math.round(horas)}h`;
}

export default function CajasActivasScreen() {
  const { colorScheme, colors } = useTheme();
  const { showToast } = useToast();
  const { tienePermiso } = usePermisos();
  const puedeCerrar = tienePermiso('caja:ajuste');

  const { data: cajas, isLoading, refetch } = useCajas('ABIERTA');
  const { mutateAsync: cerrarCajaFn, isPending: cerrando } = useCerrarCaja();
  const [selectedCaja, setSelectedCaja] = useState<any>(null);
  const [closeTarget, setCloseTarget] = useState<any>(null);

  const cajasConRiesgo: CajaConRiesgo[] = useMemo(() => {
    if (!cajas) return [];
    const mapped = cajas.map(calcularRiesgo);
    const peso: Record<RiskLevel, number> = { critico: 0, alerta: 1, normal: 2 };
    return mapped.sort((a, b) => peso[a.nivel] - peso[b.nivel]);
  }, [cajas]);

  const kpis = useMemo(() => {
    if (!cajas || cajas.length === 0) return null;
    const totalInicial = cajas.reduce((s: number, c: any) => s + m(c.montoInicial), 0);
    const totalEsperado = cajas.reduce((s: number, c: any) => s + m(c.esperadoCalc), 0);
    const totalIngresos = cajas.reduce((s: number, c: any) => s + m(c.ingresosCalc), 0);
    const totalEgresos = cajas.reduce((s: number, c: any) => s + m(c.egresosCalc), 0);
    return { totalInicial, totalEsperado, totalIngresos, totalEgresos, total: cajas.length };
  }, [cajas]);

  const handleDetalle = useCallback((c: any) => {
    setSelectedCaja(c);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedCaja(null);
  }, []);

  const handleCerrar = useCallback(async (datos: { monto: number; observaciones?: string }) => {
    if (!closeTarget) return;
    try {
      const result = await cerrarCajaFn({
        id: closeTarget.id,
        dto: { montoCierre: datos.monto, observaciones: datos.observaciones },
      });
      setCloseTarget(null);
      const r = result as any;
      if (r.esOffline) {
        showToast('Cierre encolado — se sincronizará cuando vuelva la conexión', 'info');
      } else if (result.diferencia === 0) {
        showToast('Caja cerrada — ¡Cuadrada!', 'success');
      } else {
        const tipo = result.diferencia > 0 ? 'sobrante' : 'faltante';
        showToast(`Caja cerrada con ${tipo} de ${formatCurrency(Math.abs(result.diferencia))}`, 'info');
      }
    } catch (err: any) {
      showToast(err?.message || 'Error al cerrar caja', 'error');
    }
  }, [closeTarget, cerrarCajaFn, showToast]);

  const renderCard = useCallback(
    ({ item }: { item: CajaConRiesgo }) => {
      const { caja, nivel, razones, horasAbierta } = item;
      const cfg = riskConfig(nivel, colors);
      return (
        <Pressable
          onPress={() => handleDetalle(caja)}
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: nivel === 'critico' ? colors.error : colors.border },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
                <Text style={[styles.userName, { color: colors.text }]}>
                  {caja.usuario?.nombre || '—'}
                </Text>
                <View style={[styles.riskBadge, { backgroundColor: cfg.bg }]}>
                  <Ionicons name={cfg.icon} size={scale(10)} color={cfg.color} />
                  <Text style={[styles.riskBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
              </View>
              <Text style={[styles.dateText, { color: colors.textTertiary }]}>
                {formatDate(caja.fecha)} · {formatHoras(horasAbierta)}
              </Text>
            </View>
            <View style={[styles.openBadge, { backgroundColor: colors.successLight }]}>
              <Text style={[styles.openBadgeText, { color: colors.success }]}>Abierta</Text>
            </View>
          </View>

          {razones.length > 0 && (
            <View style={[styles.razonesBox, { backgroundColor: cfg.bg }]}>
              {razones.map((r, i) => (
                <Text key={i} style={{ fontSize: scale(9), color: cfg.color }}>{r}</Text>
              ))}
            </View>
          )}

          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Inicial</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {formatCurrency(caja.montoInicial)}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Cobrado</Text>
              <Text style={[styles.statValue, { color: colors.primary }]}>
                {formatCurrency(caja.ingresosCalc ?? 0)}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Egresos</Text>
              <Text style={[styles.statValue, { color: colors.error }]}>
                {formatCurrency(caja.egresosCalc ?? 0)}
              </Text>
            </View>
          </View>

          <View style={[styles.esperadoRow, { borderTopColor: colors.borderLight }]}>
            <Ionicons name="calculator-outline" size={scale(14)} color={colors.textTertiary} />
            <Text style={[styles.esperadoLabel, { color: colors.textTertiary }]}>Esperado</Text>
            <Text style={[styles.esperadoValue, { color: colors.text }]}>
              {formatCurrency(caja.esperadoCalc ?? 0)}
            </Text>
          </View>

          {nivel !== 'normal' && razones.length > 0 && (
            <View style={[styles.recomendacionBox, { borderTopColor: colors.borderLight }]}>
              <Ionicons name="bulb-outline" size={scale(12)} color={cfg.color} />
              <Text style={{ fontSize: scale(9), color: cfg.color, flex: 1 }}>
                {nivel === 'critico'
                  ? 'Revisar inmediatamente'
                  : 'Monitorear situación'}
              </Text>
            </View>
          )}

          {puedeCerrar && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                setCloseTarget(caja);
              }}
              style={[styles.cerrarButton, { borderColor: colors.border }]}
            >
              <Ionicons name="lock-closed-outline" size={scale(14)} color={colors.textTertiary} />
              <Text style={[styles.cerrarButtonText, { color: colors.textTertiary }]}>Cerrar Caja</Text>
            </Pressable>
          )}
        </Pressable>
      );
    },
    [colors, handleDetalle, puedeCerrar],
  );

  const ListHeader = kpis
    ? () => (
        <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.kpiHeader}>
            <Ionicons name="shield-checkmark" size={scale(18)} color={colors.primary} />
            <Text style={[styles.kpiTitle, { color: colors.text }]}>
              Control de Cajas
            </Text>
          </View>
          <View style={styles.kpiGrid}>
            <View style={styles.kpiItem}>
              <Text style={[styles.kpiValue, { color: colors.primary }]}>{kpis.total}</Text>
              <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Activas</Text>
            </View>
            <View style={styles.kpiItem}>
              <Text style={[styles.kpiValue, { color: colors.text }]}>
                {formatCurrency(kpis.totalInicial)}
              </Text>
              <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Inicial total</Text>
            </View>
            <View style={styles.kpiItem}>
              <Text style={[styles.kpiValue, { color: colors.success }]}>
                {formatCurrency(kpis.totalIngresos)}
              </Text>
              <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Cobrado total</Text>
            </View>
          </View>
          <View style={[styles.kpiDivider, { backgroundColor: colors.borderLight }]} />
          <View style={styles.kpiTotals}>
            <Text style={[styles.kpiTotalLabel, { color: colors.textSecondary }]}>Esperado total</Text>
            <Text style={[styles.kpiTotalValue, { color: colors.success }]}>
              {formatCurrency(kpis.totalEsperado)}
            </Text>
          </View>
        </View>
      )
    : undefined;

  return (
    <ScreenContainer style={{ flex: 1, backgroundColor: colors.background }}>
      <PageHeader title="Cajas activas" />

      <FlatList
        data={cajasConRiesgo}
        keyExtractor={(item) => item.caja.id}
        contentContainerStyle={{ padding: Spacing.md, paddingBottom: Spacing.xxl }}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />
        }
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          isLoading ? (
            <LoadingScreen message="Cargando cajas activas..." />
          ) : (
            <EmptyState
              icon="cash-outline"
              title="Sin cajas activas"
              subtitle="No hay sesiones de caja abiertas en este momento"
            />
          )
        }
        renderItem={renderCard}
      />

      <DetalleSesionModal
        visible={!!selectedCaja}
        cajaId={selectedCaja?.id}
        caja={selectedCaja}
        onClose={handleCloseModal}
      />

      {/* Modal Cerrar desde supervisión */}
      <ModalCerrarCaja
        visible={!!closeTarget}
        onClose={() => setCloseTarget(null)}
        onConfirm={handleCerrar}
        confirmando={cerrando}
        cabecera={closeTarget?.usuario?.nombre || undefined}
        esperado={closeTarget?.esperadoCalc ?? 0}
        filas={
          closeTarget
            ? [
                { label: 'Cajero', valor: closeTarget.usuario?.nombre || '—' },
                { label: 'Monto inicial', valor: formatCurrency(closeTarget.montoInicial) },
                {
                  label: 'Cobrado',
                  valor: formatCurrency(closeTarget.ingresosCalc ?? 0),
                  color: colors.primary,
                },
                {
                  label: 'Egresos',
                  valor: `-${formatCurrency(closeTarget.egresosCalc ?? 0)}`,
                  color: colors.error,
                },
              ]
            : undefined
        }
      />
    </ScreenContainer>
  );
}

const styles = {
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  } as AppStyles,
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  } as AppStyles,
  userName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, marginBottom: scale(1) },
  dateText: { fontSize: FontSize.xs },
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(3),
    paddingHorizontal: Spacing.sm,
    paddingVertical: scale(2),
    borderRadius: BorderRadius.sm,
  } as AppStyles,
  riskBadgeText: { fontSize: scale(9), fontWeight: FontWeight.bold },
  openBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: scale(2),
    borderRadius: BorderRadius.sm,
  } as AppStyles,
  openBadgeText: { fontSize: scale(10), fontWeight: FontWeight.bold },
  razonesBox: {
    borderRadius: BorderRadius.sm,
    padding: Spacing.xs,
    marginTop: Spacing.xs,
  } as AppStyles,
  divider: { height: scale(1), marginVertical: Spacing.sm } as AppStyles,
  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
  } as AppStyles,
  statItem: { flex: 1, alignItems: 'center' } as AppStyles,
  statLabel: { fontSize: scale(9) },
  statValue: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, marginTop: scale(1) },
  esperadoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    gap: Spacing.xs,
  } as AppStyles,
  esperadoLabel: { fontSize: FontSize.xs, flex: 1 },
  esperadoValue: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  recomendacionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    gap: Spacing.xs,
  } as AppStyles,
  cerrarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.sm,
  } as AppStyles,
  cerrarButtonText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  kpiCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  } as AppStyles,
  kpiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  } as AppStyles,
  kpiTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  kpiGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
  } as AppStyles,
  kpiItem: { flex: 1, alignItems: 'center' } as AppStyles,
  kpiValue: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  kpiLabel: { fontSize: scale(9), marginTop: scale(1) },
  kpiDivider: { height: scale(1), marginVertical: Spacing.sm } as AppStyles,
  kpiTotals: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  } as AppStyles,
  kpiTotalLabel: { fontSize: FontSize.xs },
  kpiTotalValue: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
} as const;
