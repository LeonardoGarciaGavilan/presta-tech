import { useCallback, useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { FontSize, FontWeight, Spacing, BorderRadius, Shadows, scale} from '@/constants/theme';
import { useResumenRutas } from '@/hooks/use-rutas';
import type { ResumenRuta } from '@/types/rutas.types';
import { Skeleton } from '@/components/ui/skeleton';
import { useTheme } from '@/components/ui/theme-provider';
import { formatCurrencyCompact, formatTimeAgo } from '@/utils/formatters';

const DISTRIBUTION_COLORS = [
  '#2563EB', '#059669', '#D97706', '#DC2626', '#7C3AED',
  '#0891B2', '#DB2777', '#65A30D', '#0D9488', '#9333EA',
];

function calcEficiencia(ruta: ResumenRuta): number {
  if (!ruta.dineroEnCalle) return 0;
  return (ruta.capitalRecuperado / ruta.dineroEnCalle) * 100;
}

function calcRentabilidad(ruta: ResumenRuta): number {
  if (!ruta.dineroEnCalle) return 0;
  return (ruta.totalInteres / ruta.dineroEnCalle) * 100;
}

function calcRiesgo(ruta: ResumenRuta): number {
  return ruta.dineroEnCalle;
}

type EstadoEficiencia = 'Excelente' | 'Estable' | 'Riesgoso';

function getEstado(ef: number): EstadoEficiencia {
  if (ef >= 80) return 'Excelente';
  if (ef >= 60) return 'Estable';
  return 'Riesgoso';
}

const ESTADO_CONFIG: Record<EstadoEficiencia, { color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  Excelente: { color: '#16A34A', bg: '#F0FDF4', icon: 'checkmark-circle' },
  Estable: { color: '#D97706', bg: '#FFFBEB', icon: 'alert-circle' },
  Riesgoso: { color: '#DC2626', bg: '#FEF2F2', icon: 'close-circle' },
};

interface CobradorData {
  nombre: string;
  rutas: string[];
  clientesActivos: number;
  totalCobrado: number;
  eficienciaMedia: number;
  prestamosActivos: number;
}

function initialAvatar(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function AnalisisRutasScreen() {
  const { colorScheme, colors } = useTheme();

  const { data, isLoading, refetch, isRefetching } = useResumenRutas();

  const rutasOrdenadas = useMemo(() => {
    if (!data?.rutas) return [];
    return [...data.rutas].sort((a, b) => calcEficiencia(b) - calcEficiencia(a));
  }, [data]);

  const cobradores = useMemo((): CobradorData[] => {
    if (!data?.rutas) return [];
    const map = new Map<string, CobradorData>();
    for (const r of data.rutas) {
      const ef = calcEficiencia(r);
      const existing = map.get(r.cobrador);
      if (existing) {
        existing.rutas.push(r.nombre);
        existing.clientesActivos += r.clientesActivos;
        existing.totalCobrado += r.totalCobrado;
        existing.eficienciaMedia = (existing.eficienciaMedia + ef) / 2;
        existing.prestamosActivos += r.prestamosActivos;
      } else {
        map.set(r.cobrador, {
          nombre: r.cobrador,
          rutas: [r.nombre],
          clientesActivos: r.clientesActivos,
          totalCobrado: r.totalCobrado,
          eficienciaMedia: ef,
          prestamosActivos: r.prestamosActivos,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.eficienciaMedia - a.eficienciaMedia);
  }, [data]);

  const rutasCriticas = useMemo(
    () => rutasOrdenadas.filter((r) => calcEficiencia(r) < 50),
    [rutasOrdenadas],
  );

  const rutasAlerta = useMemo(
    () => rutasOrdenadas.filter((r) => {
      const ef = calcEficiencia(r);
      return (ef >= 50 && ef < 70) || r.dineroEnCalle > 150_000;
    }),
    [rutasOrdenadas],
  );

  const topRoute = rutasOrdenadas[0];
  const worstRoute = rutasOrdenadas[rutasOrdenadas.length - 1];

  const recomendaciones = useMemo(() => {
    const recs: string[] = [];
    if (topRoute && calcEficiencia(topRoute) > 80) {
      recs.push(`Invertir más en "${topRoute.nombre}" — eficiencia del ${calcEficiencia(topRoute).toFixed(0)}%`);
    }
    if (worstRoute && calcEficiencia(worstRoute) < 60 && worstRoute.dineroEnCalle > 0) {
      recs.push(`Reducir exposición en "${worstRoute.nombre}" — riesgo alto con $${worstRoute.dineroEnCalle.toLocaleString()} en calle`);
    }
    return recs;
  }, [topRoute, worstRoute]);

  const renderRuta = useCallback(
    ({ item, index }: { item: ResumenRuta; index: number }) => {
      const ef = calcEficiencia(item);
      const estado = getEstado(ef);
      const cfg = ESTADO_CONFIG[estado];

      return (
        <View
          style={[
            styles.rutaCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderLeftColor: cfg.color,
              borderLeftWidth: 3,
            },
          ]}
        >
          <View style={styles.rutaTop}>
            <View style={[styles.rutaRank, { backgroundColor: cfg.bg }]}>
              <Text style={[styles.rutaRankText, { color: cfg.color }]}>#{index + 1}</Text>
            </View>
            <View style={styles.rutaInfo}>
              <Text style={[styles.rutaName, { color: colors.text }]} numberOfLines={1}>
                {item.nombre}
              </Text>
              <Text style={[styles.rutaCobrador, { color: colors.textTertiary }]} numberOfLines={1}>
                {item.cobrador}
              </Text>
            </View>
            <View style={[styles.estadoBadge, { backgroundColor: cfg.bg }]}>
              <Ionicons name={cfg.icon} size={scale(14)} color={cfg.color} />
              <Text style={[styles.estadoText, { color: cfg.color }]}>{estado}</Text>
            </View>
          </View>

          <View style={styles.rutaStats}>
            <View style={styles.rutaStat}>
              <Text style={[styles.rutaStatValue, { color: colors.text }]}>
                {formatCurrencyCompact(item.totalCobrado)}
              </Text>
              <Text style={[styles.rutaStatLabel, { color: colors.textTertiary }]}>Cobrado</Text>
            </View>
            <View style={styles.rutaStat}>
              <Text style={[styles.rutaStatValue, { color: colors.text }]}>
                {formatCurrencyCompact(item.dineroEnCalle)}
              </Text>
              <Text style={[styles.rutaStatLabel, { color: colors.textTertiary }]}>En calle</Text>
            </View>
            <View style={styles.rutaStat}>
              <Text style={[styles.rutaStatValue, { color: cfg.color }]}>
                {ef.toFixed(0)}%
              </Text>
              <Text style={[styles.rutaStatLabel, { color: colors.textTertiary }]}>Eficiencia</Text>
            </View>
          </View>

          <View style={[styles.rutaMeta, { borderTopColor: colors.border }]}>
            <Text style={[styles.rutaMetaText, { color: colors.textTertiary }]}>
              {item.clientesActivos} clientes · {item.prestamosActivos} préstamos
            </Text>
            <Text style={[styles.rutaMetaText, { color: colors.textTertiary }]}>
              {formatCurrencyCompact(item.totalInteres)} intereses
            </Text>
          </View>
        </View>
      );
    },
    [colors],
  );

  const totalDistribucion = useMemo(
    () => data?.rutas.reduce((s, r) => s + r.totalCobrado, 0) ?? 0,
    [data],
  );

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.content}>
          <Skeleton height={36} style={{ marginBottom: Spacing.md }} />
          <Skeleton height={88} style={{ marginBottom: Spacing.md }} />
          <Skeleton height={56} style={{ marginBottom: Spacing.md }} />
          <Skeleton height={48} style={{ marginBottom: Spacing.md }} />
          <Skeleton height={100} style={{ marginBottom: Spacing.sm }} />
          <Skeleton height={100} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={rutasOrdenadas}
        keyExtractor={(item) => item.rutaId}
        renderItem={renderRuta}
        refreshing={isRefetching}
        onRefresh={refetch}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {/* Timestamp + refresh */}
            <View style={styles.timestampRow}>
              <Ionicons name="time-outline" size={scale(14)} color={colors.textTertiary} />
              <Text style={[styles.timestamp, { color: colors.textTertiary }]}>
                {data?.timestamp ? `Actualizado ${formatTimeAgo(data.timestamp)}` : 'Sin datos'}
              </Text>
            </View>

            {/* Summary cards 2x2 */}
            <View style={styles.summaryGrid}>
              <View style={[styles.summaryCard, { backgroundColor: colors.primaryLight }]}>
                <Text style={[styles.summaryValue, { color: colors.primary }]}>
                  {formatCurrencyCompact(data?.totales.totalCobrado ?? 0)}
                </Text>
                <Text style={[styles.summaryLabel, { color: colors.primary }]}>Cobrado</Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: colors.warningLight }]}>
                <Text style={[styles.summaryValue, { color: colors.warning }]}>
                  {formatCurrencyCompact(data?.totales.totalInteres ?? 0)}
                </Text>
                <Text style={[styles.summaryLabel, { color: colors.warning }]}>Interés</Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: colors.errorLight }]}>
                <Text style={[styles.summaryValue, { color: colors.error }]}>
                  {formatCurrencyCompact(data?.totales.dineroEnCalle ?? 0)}
                </Text>
                <Text style={[styles.summaryLabel, { color: colors.error }]}>En calle</Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: colors.secondaryLight }]}>
                <Text style={[styles.summaryValue, { color: colors.secondary }]}>
                  {data?.totales.clientesActivos ?? 0}
                </Text>
                <Text style={[styles.summaryLabel, { color: colors.secondary }]}>Clientes</Text>
              </View>
            </View>

            {/* Critical alerts */}
            {rutasCriticas.length > 0 && (
              <View style={[styles.alertBanner, { backgroundColor: colors.errorLight, borderColor: colors.error }]}>
                <View style={styles.alertHeader}>
                  <Ionicons name="warning" size={scale(18)} color={colors.error} />
                  <Text style={[styles.alertTitle, { color: colors.error }]}>
                    Rutas con eficiencia crítica
                  </Text>
                </View>
                {rutasCriticas.map((r) => (
                  <Text key={r.rutaId} style={[styles.alertItem, { color: colors.error }]}>
                    {r.nombre} · {calcEficiencia(r).toFixed(0)}% eficiencia · {formatCurrencyCompact(r.dineroEnCalle)} en calle
                  </Text>
                ))}
              </View>
            )}

            {/* Normal alerts */}
            {rutasAlerta.length > 0 && (
              <View style={[styles.alertBanner, { backgroundColor: colors.warningLight, borderColor: colors.warning }]}>
                <View style={styles.alertHeader}>
                  <Ionicons name="alert-circle" size={scale(18)} color={colors.warning} />
                  <Text style={[styles.alertTitle, { color: colors.warning }]}>
                    Rutas con seguimiento
                  </Text>
                </View>
                {rutasAlerta.slice(0, 3).map((r) => {
                  const ef = calcEficiencia(r);
                  return (
                    <Text key={r.rutaId} style={[styles.alertItem, { color: colors.warning }]}>
                      {r.nombre} · {ef.toFixed(0)}% eficiencia · {formatCurrencyCompact(r.dineroEnCalle)} en calle
                    </Text>
                  );
                })}
              </View>
            )}

            {/* Recommendations */}
            {recomendaciones.length > 0 && (
              <View style={[styles.recCard, { backgroundColor: colors.infoLight, borderColor: colors.info }]}>
                <View style={styles.alertHeader}>
                  <Ionicons name="bulb-outline" size={scale(18)} color={colors.info} />
                  <Text style={[styles.alertTitle, { color: colors.info }]}>Recomendaciones</Text>
                </View>
                {recomendaciones.map((r, i) => (
                  <Text key={i} style={[styles.alertItem, { color: colors.info }]}>
                    {r}
                  </Text>
                ))}
              </View>
            )}

            {/* Distribution bar */}
            {data?.rutas && data.rutas.length > 1 && totalDistribucion > 0 && (
              <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Distribución por ruta</Text>
                <View style={styles.distBar}>
                  {data.rutas.map((r, i) => {
                    const pct = (r.totalCobrado / totalDistribucion) * 100;
                    if (pct < 1) return null;
                    return (
                      <View
                        key={r.rutaId}
                        style={[
                          styles.distSegment,
                          {
                            flex: pct,
                            backgroundColor: DISTRIBUTION_COLORS[i % DISTRIBUTION_COLORS.length],
                          },
                        ]}
                      />
                    );
                  })}
                </View>
                <View style={styles.distLegend}>
                  {data.rutas.map((r, i) => {
                    const pct = (r.totalCobrado / totalDistribucion) * 100;
                    return (
                      <View key={r.rutaId} style={styles.distLegendItem}>
                        <View
                          style={[
                            styles.distDot,
                            { backgroundColor: DISTRIBUTION_COLORS[i % DISTRIBUTION_COLORS.length] },
                          ]}
                        />
                        <Text style={[styles.distLegendText, { color: colors.textSecondary }]} numberOfLines={1}>
                          {r.nombre} {pct.toFixed(0)}%
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Cobradores */}
            {cobradores.length > 0 && (
              <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Cobradores</Text>
                {cobradores.map((c) => {
                  const estado = getEstado(c.eficienciaMedia);
                  const cfg = ESTADO_CONFIG[estado];
                  return (
                    <View key={c.nombre} style={[styles.cobradorRow, { borderBottomColor: colors.border }]}>
                      <View style={[styles.cobradorAvatar, { backgroundColor: colors.primaryLight }]}>
                        <Text style={[styles.cobradorAvatarText, { color: colors.primary }]}>
                          {initialAvatar(c.nombre)}
                        </Text>
                      </View>
                      <View style={styles.cobradorInfo}>
                        <Text style={[styles.cobradorName, { color: colors.text }]} numberOfLines={1}>
                          {c.nombre}
                        </Text>
                        <Text style={[styles.cobradorDetail, { color: colors.textTertiary }]}>
                          {c.rutas.length} ruta{c.rutas.length !== 1 ? 's' : ''} · {c.clientesActivos} clientes
                        </Text>
                      </View>
                      <View style={[styles.estadoBadge, { backgroundColor: cfg.bg }]}>
                        <Ionicons name={cfg.icon} size={scale(14)} color={cfg.color} />
                        <Text style={[styles.estadoText, { color: cfg.color }]}>
                          {c.eficienciaMedia.toFixed(0)}%
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Top route highlight */}
            {topRoute && (
              <View style={[styles.topRouteCard, { backgroundColor: colors.successLight, borderColor: colors.success }]}>
                <View style={styles.alertHeader}>
                  <Ionicons name="trophy" size={scale(18)} color={colors.success} />
                  <Text style={[styles.alertTitle, { color: colors.success }]}>
                    Mejor ruta: {topRoute.nombre}
                  </Text>
                </View>
                <View style={styles.topRouteBody}>
                  <View style={[styles.topRouteAvatar, { backgroundColor: colors.success }]}>
                    <Text style={styles.topRouteAvatarText}>{initialAvatar(topRoute.cobrador)}</Text>
                  </View>
                  <View style={styles.topRouteInfo}>
                    <Text style={[styles.topRouteCobrador, { color: colors.success }]}>
                      {topRoute.cobrador}
                    </Text>
                    <Text style={[styles.topRouteDetail, { color: colors.textSecondary }]}>
                      {formatCurrencyCompact(topRoute.totalInteres)} intereses · {calcEficiencia(topRoute).toFixed(0)}% eficiencia
                    </Text>
                    <Text style={[styles.topRouteDetail, { color: colors.textSecondary }]}>
                      {formatCurrencyCompact(topRoute.dineroEnCalle)} en calle
                    </Text>
                  </View>
                </View>
              </View>
            )}

            <Text style={[styles.sectionTitle, { color: colors.text, marginTop: Spacing.md }]}>
              Ranking de rutas
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="map-outline" size={scale(48)} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
              No hay datos de rutas disponibles aún
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  timestamp: {
    fontSize: FontSize.xs,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  summaryCard: {
    width: '48%',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  summaryLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    marginTop: scale(2),
  },
  alertBanner: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  alertTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    flex: 1,
  },
  alertItem: {
    fontSize: FontSize.xs,
    marginLeft: Spacing.xl,
    lineHeight: scale(18),
  },
  recCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  sectionCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.sm,
  },
  distBar: {
    flexDirection: 'row',
    height: scale(24),
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  distSegment: {
    height: '100%',
  },
  distLegend: {
    gap: Spacing.xs,
  },
  distLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  distDot: {
    width: scale(8),
    height: scale(8),
    borderRadius: 4,
  },
  distLegendText: {
    fontSize: FontSize.xs,
    flex: 1,
  },
  cobradorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  cobradorAvatar: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    justifyContent: 'center',
    alignItems: 'center',
  },
  cobradorAvatarText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  cobradorInfo: {
    flex: 1,
  },
  cobradorName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  cobradorDetail: {
    fontSize: FontSize.xs,
    marginTop: scale(1),
  },
  topRouteCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  topRouteBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  topRouteAvatar: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(22),
    justifyContent: 'center',
    alignItems: 'center',
  },
  topRouteAvatarText: {
    color: '#FFFFFF',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  topRouteInfo: {
    flex: 1,
  },
  topRouteCobrador: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  topRouteDetail: {
    fontSize: FontSize.xs,
    marginTop: scale(1),
  },
  rutaCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  rutaTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  rutaRank: {
    width: scale(32),
    height: scale(32),
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rutaRankText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  rutaInfo: {
    flex: 1,
  },
  rutaName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  rutaCobrador: {
    fontSize: FontSize.xs,
    marginTop: scale(1),
  },
  estadoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    paddingHorizontal: Spacing.sm,
    paddingVertical: scale(3),
    borderRadius: BorderRadius.sm,
  },
  estadoText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  rutaStats: {
    flexDirection: 'row',
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  rutaStat: {
    flex: 1,
    alignItems: 'center',
  },
  rutaStatValue: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  rutaStatLabel: {
    fontSize: FontSize.xs,
    marginTop: scale(1),
  },
  rutaMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  rutaMetaText: {
    fontSize: FontSize.xs,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl * 2,
    gap: Spacing.sm,
  },
  emptyText: {
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
});
