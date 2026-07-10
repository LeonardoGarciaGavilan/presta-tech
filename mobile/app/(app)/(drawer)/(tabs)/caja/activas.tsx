import { useCallback, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ui/screen-container';
import { PageHeader } from '@/components/ui/page-header';
import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import LoadingScreen from '@/components/ui/loading-screen';
import EmptyState from '@/components/ui/empty-state';
import DetalleSesionModal from '@/components/caja/detalle-sesion-modal';
import { useToast } from '@/components/ui/toast';
import { useCajas, useCerrarCaja } from '@/hooks/use-caja';
import { FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { useTheme } from '@/components/ui/theme-provider';

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
  const ingresos = caja.ingresosCalc ?? 0;
  if (ingresos === 0 && horasAbierta > 4) {
    razones.push('Sin movimientos >4h');
  }
  if (ingresos < caja.montoInicial * 0.05 && horasAbierta > 2 && caja.montoInicial > 0) {
    razones.push('Baja productividad');
  }
  const nivel: RiskLevel = razones.some((r) => r.includes('>12h')) ? 'critico' : razones.length > 0 ? 'alerta' : 'normal';
  return { caja, nivel, razones, horasAbierta };
}

function riskConfig(nivel: RiskLevel) {
  switch (nivel) {
    case 'critico':
      return { label: 'Crítico', color: '#DC2626', bg: '#FEF2F2', icon: 'alert-circle' as const };
    case 'alerta':
      return { label: 'Alerta', color: '#D97706', bg: '#FFFBEB', icon: 'warning-outline' as const };
    default:
      return { label: 'Normal', color: '#16A34A', bg: '#F0FDF4', icon: 'checkmark-circle' as const };
  }
}

function formatHoras(horas: number) {
  if (horas < 1) return `hace ${Math.round(horas * 60)}m`;
  return `hace ${Math.round(horas)}h`;
}

export default function CajasActivasScreen() {
  const { colorScheme, colors } = useTheme();
  const { showToast } = useToast();

  const { data: cajas, isLoading, refetch } = useCajas('ABIERTA');
  const { mutateAsync: cerrarCajaFn, isPending: cerrando } = useCerrarCaja();
  const [selectedCaja, setSelectedCaja] = useState<any>(null);
  const [closeTarget, setCloseTarget] = useState<any>(null);
  const [montoCierre, setMontoCierre] = useState('');
  const [observaciones, setObservaciones] = useState('');

  const cajasConRiesgo: CajaConRiesgo[] = useMemo(() => {
    if (!cajas) return [];
    const mapped = cajas.map(calcularRiesgo);
    const peso: Record<RiskLevel, number> = { critico: 0, alerta: 1, normal: 2 };
    return mapped.sort((a, b) => peso[a.nivel] - peso[b.nivel]);
  }, [cajas]);

  const kpis = useMemo(() => {
    if (!cajas || cajas.length === 0) return null;
    const totalInicial = cajas.reduce((s: number, c: any) => s + (c.montoInicial ?? 0), 0);
    const totalEsperado = cajas.reduce((s: number, c: any) => s + (c.esperadoCalc ?? 0), 0);
    const totalIngresos = cajas.reduce((s: number, c: any) => s + (c.ingresosCalc ?? 0), 0);
    const totalEgresos = cajas.reduce((s: number, c: any) => s + (c.egresosCalc ?? 0), 0);
    return { totalInicial, totalEsperado, totalIngresos, totalEgresos, total: cajas.length };
  }, [cajas]);

  const handleDetalle = useCallback((c: any) => {
    setSelectedCaja(c);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedCaja(null);
  }, []);

  const handleCerrar = useCallback(async () => {
    if (!closeTarget) return;
    const monto = parseFloat(montoCierre.replace(/[^0-9.]/g, '')) || 0;
    try {
      const result = await cerrarCajaFn({
        id: closeTarget.id,
        dto: { montoCierre: monto, observaciones: observaciones || undefined },
      });
      setCloseTarget(null);
      setMontoCierre('');
      setObservaciones('');
      if (result.diferencia === 0) {
        showToast('Caja cerrada — ¡Cuadrada!', 'success');
      } else {
        const tipo = result.diferencia > 0 ? 'sobrante' : 'faltante';
        showToast(`Caja cerrada con ${tipo} de ${formatCurrency(Math.abs(result.diferencia))}`, 'info');
      }
    } catch (err: any) {
      showToast(err?.message || 'Error al cerrar caja', 'error');
    }
  }, [closeTarget, montoCierre, observaciones, cerrarCajaFn, showToast]);

  function formatHour(iso: string) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' });
  }

  const renderCard = useCallback(
    ({ item }: { item: CajaConRiesgo }) => {
      const { caja, nivel, razones, horasAbierta } = item;
      const cfg = riskConfig(nivel);
      return (
        <Pressable
          onPress={() => handleDetalle(caja)}
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: nivel === 'critico' ? '#FCA5A5' : colors.border },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
                <Text style={[styles.userName, { color: colors.text }]}>
                  {caja.usuario?.nombre || '—'}
                </Text>
                <View style={[styles.riskBadge, { backgroundColor: cfg.bg }]}>
                  <Ionicons name={cfg.icon} size={10} color={cfg.color} />
                  <Text style={[styles.riskBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
              </View>
              <Text style={[styles.dateText, { color: colors.textTertiary }]}>
                {formatDate(caja.fecha)} · {formatHoras(horasAbierta)}
              </Text>
            </View>
            <View style={[styles.openBadge, { backgroundColor: '#F0FDF4' }]}>
              <Text style={styles.openBadgeText}>Abierta</Text>
            </View>
          </View>

          {razones.length > 0 && (
            <View style={[styles.razonesBox, { backgroundColor: cfg.bg }]}>
              {razones.map((r, i) => (
                <Text key={i} style={{ fontSize: 9, color: cfg.color }}>{r}</Text>
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
            <Ionicons name="calculator-outline" size={14} color={colors.textTertiary} />
            <Text style={[styles.esperadoLabel, { color: colors.textTertiary }]}>Esperado</Text>
            <Text style={[styles.esperadoValue, { color: colors.text }]}>
              {formatCurrency(caja.esperadoCalc ?? 0)}
            </Text>
          </View>

          {nivel !== 'normal' && razones.length > 0 && (
            <View style={[styles.recomendacionBox, { borderTopColor: colors.borderLight }]}>
              <Ionicons name="bulb-outline" size={12} color={cfg.color} />
              <Text style={{ fontSize: 9, color: cfg.color, flex: 1 }}>
                {nivel === 'critico'
                  ? 'Revisar inmediatamente'
                  : 'Monitorear situación'}
              </Text>
            </View>
          )}

          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              setCloseTarget(caja);
              setMontoCierre('');
              setObservaciones('');
            }}
            style={[styles.cerrarButton, { borderColor: colors.border }]}
          >
            <Ionicons name="lock-closed-outline" size={14} color={colors.textTertiary} />
            <Text style={[styles.cerrarButtonText, { color: colors.textTertiary }]}>Cerrar Caja</Text>
          </Pressable>
        </Pressable>
      );
    },
    [colors, handleDetalle],
  );

  const ListHeader = kpis
    ? () => (
        <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.kpiHeader}>
            <Ionicons name="shield-checkmark" size={18} color={colors.primary} />
            <Text style={[styles.kpiTitle, { color: colors.text }]}>
              Control de Cajas
            </Text>
          </View>
          <View style={styles.kpiGrid}>
            <View style={styles.kpiItem}>
              <Text style={[styles.kpiValue, { color: colors.primary }]}>{kpis.total}</Text>
              <Text style={[styles.kpiLabel, { color: colors.textTertiary }]}>Activas</Text>
            </View>
            <View style={styles.kpiItem}>
              <Text style={[styles.kpiValue, { color: colors.text }]}>
                {formatCurrency(kpis.totalInicial)}
              </Text>
              <Text style={[styles.kpiLabel, { color: colors.textTertiary }]}>Inicial total</Text>
            </View>
            <View style={styles.kpiItem}>
              <Text style={[styles.kpiValue, { color: colors.primary }]}>
                {formatCurrency(kpis.totalIngresos)}
              </Text>
              <Text style={[styles.kpiLabel, { color: colors.textTertiary }]}>Cobrado total</Text>
            </View>
          </View>
          <View style={[styles.kpiDivider, { backgroundColor: colors.borderLight }]} />
          <View style={styles.kpiTotals}>
            <Text style={[styles.kpiTotalLabel, { color: colors.textTertiary }]}>Esperado total</Text>
            <Text style={[styles.kpiTotalValue, { color: colors.text }]}>
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
      <Modal
        visible={!!closeTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setCloseTarget(null)}
      >
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
            <View style={[styles.modalCard, { backgroundColor: colors.surfaceElevated }]}>
              <View style={[styles.modalHeaderBar, { backgroundColor: '#DC2626' }]}>
                <Ionicons name="lock-closed" size={22} color="#FFFFFF" />
                <Text style={styles.modalTitle}>Cerrar Caja</Text>
              </View>
              <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
                {closeTarget && (
                  <View style={[styles.summaryBox, { backgroundColor: colors.borderLight, borderColor: colors.border }]}>
                    <View style={styles.summaryRow}>
                      <Text style={{ fontSize: FontSize.xs, color: colors.textTertiary }}>Cajero</Text>
                      <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: colors.text }}>
                        {closeTarget.usuario?.nombre || '—'}
                      </Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={{ fontSize: FontSize.xs, color: colors.textTertiary }}>Monto inicial</Text>
                      <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: colors.text }}>
                        {formatCurrency(closeTarget.montoInicial)}
                      </Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={{ fontSize: FontSize.xs, color: colors.textTertiary }}>Cobrado</Text>
                      <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: colors.primary }}>
                        {formatCurrency(closeTarget.ingresosCalc ?? 0)}
                      </Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={{ fontSize: FontSize.xs, color: colors.textTertiary }}>Egresos</Text>
                      <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: colors.error }}>
                        -{formatCurrency(closeTarget.egresosCalc ?? 0)}
                      </Text>
                    </View>
                    <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: Spacing.sm, marginTop: Spacing.xs }]}>
                      <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: colors.text }}>
                        Efectivo esperado
                      </Text>
                      <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: colors.text }}>
                        {formatCurrency(closeTarget.esperadoCalc ?? 0)}
                      </Text>
                    </View>
                  </View>
                )}
                <AppInput
                  label="Monto real en caja (RD$)"
                  value={montoCierre}
                  onChangeText={setMontoCierre}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  prefix="RD$"
                />
                {montoCierre && closeTarget && (
                  <View style={[styles.diferenciaPreview, {
                    backgroundColor: (() => {
                      const monto = parseFloat(montoCierre.replace(/[^0-9.]/g, '')) || 0;
                      const esperado = closeTarget.esperadoCalc ?? 0;
                      const dif = monto - esperado;
                      return dif === 0 ? '#F0FDF4' : '#FEF2F2';
                    })(),
                  }]}>
                    <Ionicons
                      name={(() => {
                        const monto = parseFloat(montoCierre.replace(/[^0-9.]/g, '')) || 0;
                        const esperado = closeTarget.esperadoCalc ?? 0;
                        const dif = monto - esperado;
                        return dif === 0 ? 'checkmark-circle' : 'alert-circle';
                      })()}
                      size={16}
                      color={(() => {
                        const monto = parseFloat(montoCierre.replace(/[^0-9.]/g, '')) || 0;
                        const esperado = closeTarget.esperadoCalc ?? 0;
                        const dif = monto - esperado;
                        return dif === 0 ? '#16A34A' : '#DC2626';
                      })()}
                    />
                    <Text style={{
                      fontSize: FontSize.xs,
                      fontWeight: FontWeight.semibold,
                      color: (() => {
                        const monto = parseFloat(montoCierre.replace(/[^0-9.]/g, '')) || 0;
                        const esperado = closeTarget.esperadoCalc ?? 0;
                        const dif = monto - esperado;
                        return dif === 0 ? '#16A34A' : '#DC2626';
                      })(),
                    }}>
                      {(() => {
                        const monto = parseFloat(montoCierre.replace(/[^0-9.]/g, '')) || 0;
                        const esperado = closeTarget.esperadoCalc ?? 0;
                        const dif = monto - esperado;
                        return dif === 0 ? '✅ Cuadrada' : `Diferencia: ${formatCurrency(dif)}`;
                      })()}
                    </Text>
                  </View>
                )}
                <AppInput
                  label="Observaciones (opcional)"
                  value={observaciones}
                  onChangeText={setObservaciones}
                  placeholder="Notas del cierre..."
                />
                <View style={styles.modalActions}>
                  <AppButton
                    title="Cancelar"
                    onPress={() => { setCloseTarget(null); setMontoCierre(''); setObservaciones(''); }}
                    variant="ghost"
                    style={{ flex: 1 }}
                  />
                  <AppButton
                    title="Cerrar Caja"
                    onPress={handleCerrar}
                    loading={cerrando}
                    disabled={!montoCierre}
                    variant="danger"
                    style={{ flex: 1 }}
                  />
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenContainer>
  );
}

const styles = {
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  } as any,
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  } as any,
  userName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, marginBottom: 1 },
  dateText: { fontSize: FontSize.xs },
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  } as any,
  riskBadgeText: { fontSize: 9, fontWeight: FontWeight.bold },
  openBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  } as any,
  openBadgeText: { fontSize: 10, fontWeight: FontWeight.bold, color: '#16A34A' },
  razonesBox: {
    borderRadius: BorderRadius.sm,
    padding: Spacing.xs,
    marginTop: Spacing.xs,
  } as any,
  divider: { height: 1, marginVertical: Spacing.sm } as any,
  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
  } as any,
  statItem: { flex: 1, alignItems: 'center' } as any,
  statLabel: { fontSize: 9 },
  statValue: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, marginTop: 1 },
  esperadoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    gap: Spacing.xs,
  } as any,
  esperadoLabel: { fontSize: FontSize.xs, flex: 1 },
  esperadoValue: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  recomendacionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    gap: Spacing.xs,
  } as any,
  cerrarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.sm,
  } as any,
  cerrarButtonText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  kpiCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  } as any,
  kpiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  } as any,
  kpiTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  kpiGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
  } as any,
  kpiItem: { flex: 1, alignItems: 'center' } as any,
  kpiValue: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  kpiLabel: { fontSize: 9, marginTop: 1 },
  kpiDivider: { height: 1, marginVertical: Spacing.sm } as any,
  kpiTotals: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  } as any,
  kpiTotalLabel: { fontSize: FontSize.xs },
  kpiTotalValue: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  } as any,
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  } as any,
  modalHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
  } as any,
  modalTitle: { color: '#FFFFFF', fontSize: FontSize.md, fontWeight: FontWeight.bold },
  modalBody: { padding: Spacing.md },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm } as any,
  summaryBox: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  } as any,
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  } as any,
  diferenciaPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
  } as any,
} as const;
