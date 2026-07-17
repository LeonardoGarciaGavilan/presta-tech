import { useCallback, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useDashboard,
  useMovimientos,
  useCrearInyeccion,
  useCrearRetiroGanancias,
  useRetirarCapital } from '@/hooks/use-finanzas';
import { AppInput } from '@/components/ui/app-input';
import { AppButton } from '@/components/ui/app-button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { useTheme } from '@/components/ui/theme-provider';
import { formatCurrencyCompact, formatFullCurrency, formatTimeAgo } from '@/utils/formatters';

const MOVEMENT_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  PAGO_RECIBIDO: 'cash',
  DESEMBOLSO: 'arrow-up-circle',
  GASTO: 'cart-outline',
  INYECCION_CAPITAL: 'add-circle',
  RETIRO_GANANCIAS: 'arrow-down-circle',
  RETIRO_CAPITAL: 'remove-circle',
  CIERRE_CAJA: 'lock-closed',
  APERTURA_CAJA: 'lock-open',
  CORRECCION: 'hammer',
  GASTO_CAPITAL: 'trending-down',
  AJUSTE_CAJA: 'options',
};

const MOVEMENT_COLORS: Record<string, string> = {
  PAGO_RECIBIDO: '#16A34A',
  DESEMBOLSO: '#DC2626',
  GASTO: '#D97706',
  INYECCION_CAPITAL: '#2563EB',
  RETIRO_GANANCIAS: '#DC2626',
  RETIRO_CAPITAL: '#DC2626',
  CIERRE_CAJA: '#6B7280',
  APERTURA_CAJA: '#059669',
  CORRECCION: '#7C3AED',
  GASTO_CAPITAL: '#DC2626',
  AJUSTE_CAJA: '#0891B2',
};

function formatMovFecha(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now.getTime() - 86400000);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  if (isToday) return `Hoy ${d.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}`;
  if (isYesterday) return `Ayer ${d.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}`;
  return d.toLocaleDateString('es-DO', { day: '2-digit', month: 'short' });
}

const PATRIMONIO_COLORS = ['#2563EB', '#059669', '#D97706', '#7C3AED'];

export default function EstadoFinancieroScreen() {
  const { colorScheme, colors } = useTheme();
  const { showToast } = useToast();

  const { data: dash, isLoading: dashLoading, refetch, isRefetching } = useDashboard();
  const { data: movimientos } = useMovimientos(15);
  const inyeccionMutation = useCrearInyeccion();
  const retiroGananciasMutation = useCrearRetiroGanancias();
  const retiroCapitalMutation = useRetirarCapital();

  const [showInyectar, setShowInyectar] = useState(false);
  const [inyectarForm, setInyectarForm] = useState({ monto: '', concepto: '' });

  const [showRetirar, setShowRetirar] = useState<'ganancias' | 'capital' | null>(null);
  const [retirarForm, setRetirarForm] = useState({ monto: '', concepto: '' });

  const alertas = dash?.alertas ?? [];

  const patrimonioData = useMemo(() => {
    if (!dash) return [];
    return [
      { label: 'Capital', value: dash.capital.total, color: PATRIMONIO_COLORS[0] },
      { label: 'Ganancias', value: Math.max(0, dash.ganancias.netas), color: PATRIMONIO_COLORS[1] },
    ];
  }, [dash]);

  const patrimonioTotal = patrimonioData.reduce((s, i) => s + i.value, 0);

  const movsCortos = useMemo(() => movimientos?.slice(0, 15) ?? [], [movimientos]);

  const handleInyectar = useCallback(async () => {
    const monto = parseFloat(inyectarForm.monto);
    if (!monto || monto <= 0) { showToast('Ingrese un monto válido', 'error'); return; }
    if (!inyectarForm.concepto.trim()) { showToast('Ingrese un concepto', 'error'); return; }
    try {
      await inyeccionMutation.mutateAsync({ monto, concepto: inyectarForm.concepto.trim() });
      showToast('Capital inyectado exitosamente', 'success');
      setShowInyectar(false);
      setInyectarForm({ monto: '', concepto: '' });
    } catch {
      showToast('Error al inyectar capital', 'error');
    }
  }, [inyectarForm, inyeccionMutation, showToast]);

  const handleRetirar = useCallback(async () => {
    const monto = parseFloat(retirarForm.monto);
    if (!monto || monto <= 0) { showToast('Ingrese un monto válido', 'error'); return; }
    if (!retirarForm.concepto.trim()) { showToast('Ingrese un concepto', 'error'); return; }
    try {
      if (showRetirar === 'ganancias') {
        await retiroGananciasMutation.mutateAsync({ monto, concepto: retirarForm.concepto.trim() });
      } else {
        await retiroCapitalMutation.mutateAsync({ monto, concepto: retirarForm.concepto.trim() });
      }
      showToast('Retiro realizado exitosamente', 'success');
      setShowRetirar(null);
      setRetirarForm({ monto: '', concepto: '' });
    } catch {
      showToast('Error al realizar el retiro', 'error');
    }
  }, [retirarForm, showRetirar, retiroGananciasMutation, retiroCapitalMutation, showToast]);

  const renderMovimiento = useCallback(
    ({ item }: { item: { id: string; tipo: string; monto: number; fecha: string; descripcion: string | null; usuario?: { nombre: string } | null; capital: number; interes: number; mora: number } }) => {
      const icon = MOVEMENT_ICONS[item.tipo] ?? 'ellipse';
      const color = MOVEMENT_COLORS[item.tipo] ?? colors.textSecondary;
      const isPositive = !['DESEMBOLSO', 'GASTO', 'RETIRO_GANANCIAS', 'RETIRO_CAPITAL', 'GASTO_CAPITAL'].includes(item.tipo);

      return (
        <View style={[styles.movCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.movIcon, { backgroundColor: color + '18' }]}>
            <Ionicons name={icon} size={18} color={color} />
          </View>
          <View style={styles.movInfo}>
            <Text style={[styles.movDesc, { color: colors.text }]} numberOfLines={1}>
              {item.descripcion ?? item.tipo.replace(/_/g, ' ')}
            </Text>
            <Text style={[styles.movMeta, { color: colors.textTertiary }]}>
              {item.usuario?.nombre ? `${item.usuario.nombre} · ` : ''}{formatMovFecha(item.fecha)}
              {item.interes > 0 && ` · ${formatCurrencyCompact(item.interes)} int`}
              {item.mora > 0 && ` · ${formatCurrencyCompact(item.mora)} mora`}
            </Text>
          </View>
          <Text style={[styles.movMonto, { color: isPositive ? colors.success : colors.error }]}>
            {isPositive ? '+' : '-'}{formatCurrencyCompact(Math.abs(item.monto))}
          </Text>
        </View>
      );
    },
    [colors],
  );

  if (dashLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.content}>
          <Skeleton height={36} style={{ marginBottom: Spacing.md }} />
          <Skeleton height={88} style={{ marginBottom: Spacing.md }} />
          <Skeleton height={56} style={{ marginBottom: Spacing.md }} />
          <Skeleton height={100} style={{ marginBottom: Spacing.sm }} />
          <Skeleton height={48} style={{ marginBottom: Spacing.sm }} />
          <Skeleton height={80} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={movsCortos}
        keyExtractor={(item) => item.id}
        renderItem={renderMovimiento}
        refreshing={isRefetching}
        onRefresh={refetch}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {/* Timestamp */}
            <View style={styles.timestampRow}>
              <Ionicons name="time-outline" size={14} color={colors.textTertiary} />
              <Text style={[styles.timestamp, { color: colors.textTertiary }]}>
                {dash?.timestamp ? `Actualizado ${formatTimeAgo(dash.timestamp)}` : 'Sin datos'}
              </Text>
            </View>

            {/* Action buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                onPress={() => setShowInyectar(true)}
                style={[styles.actionBtn, { backgroundColor: colors.primary }]}
              >
                <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
                <Text style={styles.actionBtnText}>Inyectar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowRetirar('ganancias')}
                style={[styles.actionBtn, { backgroundColor: colors.success }]}
              >
                <Ionicons name="arrow-down-circle-outline" size={18} color="#FFFFFF" />
                <Text style={styles.actionBtnText}>Ganancias</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowRetirar('capital')}
                style={[styles.actionBtn, { backgroundColor: colors.error }]}
              >
                <Ionicons name="remove-circle-outline" size={18} color="#FFFFFF" />
                <Text style={styles.actionBtnText}>Capital</Text>
              </TouchableOpacity>
            </View>

            {/* KPI Grid 2x2 */}
            <View style={styles.kpiGrid}>
              <View style={[styles.kpiCard, { backgroundColor: colors.primaryLight }]}>
                <Text style={[styles.kpiLabel, { color: colors.primary }]}>Capital</Text>
                <Text style={[styles.kpiValue, { color: colors.primary }]}>
                  {formatCurrencyCompact(dash?.capital.total ?? 0)}
                </Text>
              </View>
              <View style={[styles.kpiCard, { backgroundColor: colors.secondaryLight }]}>
                <Text style={[styles.kpiLabel, { color: colors.secondary }]}>Ganancias</Text>
                <Text style={[styles.kpiValue, { color: colors.secondary }]}>
                  {formatCurrencyCompact(dash?.ganancias.brutas ?? 0)}
                </Text>
              </View>
              <View style={[styles.kpiCard, { backgroundColor: colors.warningLight }]}>
                <Text style={[styles.kpiLabel, { color: colors.warning }]}>En caja</Text>
                <Text style={[styles.kpiValue, { color: colors.warning }]}>
                  {formatCurrencyCompact(dash?.dinero.enCaja ?? 0)}
                </Text>
              </View>
              <View style={[styles.kpiCard, { backgroundColor: colors.errorLight }]}>
                <Text style={[styles.kpiLabel, { color: colors.error }]}>En calle</Text>
                <Text style={[styles.kpiValue, { color: colors.error }]}>
                  {formatCurrencyCompact(dash?.dinero.enCalle ?? 0)}
                </Text>
              </View>
            </View>

            {/* Patrimonio bar */}
            {patrimonioTotal > 0 && (
              <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Patrimonio</Text>
                <View style={styles.patrimonioBar}>
                  {patrimonioData.map((item, i) => {
                    const pct = (item.value / patrimonioTotal) * 100;
                    if (pct < 1) return null;
                    return (
                      <View
                        key={item.label}
                        style={[styles.patrimonioSegment, { flex: pct, backgroundColor: item.color }]}
                      />
                    );
                  })}
                </View>
                {patrimonioData.map((item) => (
                  <View key={item.label} style={styles.patrimonioRow}>
                    <View style={[styles.patrimonioDot, { backgroundColor: item.color }]} />
                    <Text style={[styles.patrimonioLabel, { color: colors.textSecondary }]}>{item.label}</Text>
                    <Text style={[styles.patrimonioValue, { color: colors.text }]}>{formatCurrencyCompact(item.value)}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Metric chips */}
            <View style={styles.metricsRow}>
              <View style={[styles.metricChip, { backgroundColor: colors.primaryLight }]}>
                <Text style={[styles.metricValue, { color: colors.primary }]}>
                  {dash?.metricas.rentabilidad != null ? `${dash.metricas.rentabilidad.toFixed(1)}%` : 'N/A'}
                </Text>
                <Text style={[styles.metricLabel, { color: colors.primary }]}>Rentabilidad</Text>
              </View>
              <View style={[styles.metricChip, { backgroundColor: colors.secondaryLight }]}>
                <Text style={[styles.metricValue, { color: colors.secondary }]}>
                  {dash?.metricas.eficienciaCobranza != null ? `${dash.metricas.eficienciaCobranza.toFixed(1)}%` : 'N/A'}
                </Text>
                <Text style={[styles.metricLabel, { color: colors.secondary }]}>Eficiencia</Text>
              </View>
              <View style={[styles.metricChip, { backgroundColor: colors.warningLight }]}>
                <Text style={[styles.metricValue, { color: colors.warning }]}>
                  {formatCurrencyCompact(dash?.metricas.dineroOcioso ?? 0)}
                </Text>
                <Text style={[styles.metricLabel, { color: colors.warning }]}>Ocioso</Text>
              </View>
              <View style={[styles.metricChip, { backgroundColor: colors.infoLight }]}>
                <Text style={[styles.metricValue, { color: colors.info }]}>
                  {dash?.metricas.crecimientoMensual != null
                    ? `${dash.metricas.crecimientoMensual >= 0 ? '+' : ''}${dash.metricas.crecimientoMensual.toFixed(1)}%`
                    : 'N/A'}
                </Text>
                <Text style={[styles.metricLabel, { color: colors.info }]}>Crecimiento</Text>
              </View>
            </View>

            {/* Alertas */}
            {alertas.length > 0 && (
              <View>
                {alertas.map((alerta, i) => {
                  const isCritical = alerta.tipo === 'CRITICAL';
                  const isWarning = alerta.tipo === 'WARNING';
                  const bgColor = isCritical ? colors.errorLight : isWarning ? colors.warningLight : colors.infoLight;
                  const borderColor = isCritical ? colors.error : isWarning ? colors.warning : colors.info;
                  const txtColor = isCritical ? colors.error : isWarning ? colors.warning : colors.info;
                  const icon = isCritical ? 'warning' : isWarning ? 'alert-circle' : 'information-circle';

                  return (
                    <View key={i} style={[styles.alertBanner, { backgroundColor: bgColor, borderColor }]}>
                      <Ionicons name={icon} size={16} color={txtColor} />
                      <Text style={[styles.alertText, { color: txtColor }]}>{alerta.mensaje}</Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Resumen financiero */}
            <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Resumen financiero</Text>
              {[
                { label: 'Total cobrado', value: dash?.resumen.totalCobrado ?? 0 },
                { label: 'Total gastos', value: dash?.resumen.totalGastos ?? 0 },
                { label: 'Balance neto', value: dash?.resumen.balanceNeto ?? 0, highlight: true },
                { label: 'Total desembolsado', value: dash?.resumen.totalDesembolsos ?? 0 },
                { label: 'Interés total', value: dash?.resumen.totalInteres ?? 0 },
                { label: 'Mora total', value: dash?.resumen.totalMora ?? 0 },
              ].map((item) => (
                <View key={item.label} style={[styles.resRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.resLabel, { color: colors.textSecondary }]}>{item.label}</Text>
                  <Text
                    style={[
                      styles.resValue,
                      {
                        color: item.highlight
                          ? (item.value >= 0 ? colors.success : colors.error)
                          : colors.text,
                        fontWeight: item.highlight ? FontWeight.bold : FontWeight.semibold,
                      },
                    ]}
                  >
                    {formatFullCurrency(item.value)}
                  </Text>
                </View>
              ))}
            </View>

            {/* Movimientos header */}
            {movsCortos.length > 0 && (
              <Text style={[styles.sectionTitle, { color: colors.text, marginTop: Spacing.sm }]}>
                Movimientos recientes
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="wallet-outline" size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
              No hay movimientos disponibles
            </Text>
          </View>
        }
      />

      {/* Modal Inyectar */}
      <Modal visible={showInyectar} transparent animationType="slide" onRequestClose={() => setShowInyectar(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={[styles.modalOverlay, { backgroundColor: colors.overlay }]} onPress={() => setShowInyectar(false)}>
            <Pressable style={[styles.modalContent, { backgroundColor: colors.surfaceElevated }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Inyectar capital</Text>
                <TouchableOpacity onPress={() => setShowInyectar(false)} hitSlop={8}>
                  <Ionicons name="close" size={24} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={[styles.modalHint, { color: colors.textTertiary }]}>
                  Capital actual: {formatFullCurrency(dash?.capital.total ?? 0)}
                </Text>
                <AppInput
                  label="Monto a inyectar"
                  placeholder="0.00"
                  value={inyectarForm.monto}
                  onChangeText={(v) => setInyectarForm((p) => ({ ...p, monto: v }))}
                  keyboardType="decimal-pad"
                />
                <AppInput
                  label="Concepto"
                  placeholder="Ej: Aporte mensual"
                  value={inyectarForm.concepto}
                  onChangeText={(v) => setInyectarForm((p) => ({ ...p, concepto: v }))}
                />
                <AppButton
                  title="Inyectar capital"
                  onPress={handleInyectar}
                  loading={inyeccionMutation.isPending}
                  icon="add-circle-outline"
                />
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Retirar */}
      <Modal visible={!!showRetirar} transparent animationType="slide" onRequestClose={() => setShowRetirar(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={[styles.modalOverlay, { backgroundColor: colors.overlay }]} onPress={() => setShowRetirar(null)}>
            <Pressable style={[styles.modalContent, { backgroundColor: colors.surfaceElevated }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {showRetirar === 'ganancias' ? 'Retirar ganancias' : 'Retirar capital'}
                </Text>
                <TouchableOpacity onPress={() => setShowRetirar(null)} hitSlop={8}>
                  <Ionicons name="close" size={24} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={[styles.modalHint, { color: colors.textTertiary }]}>
                  {showRetirar === 'ganancias'
                    ? `Ganancias disponibles: ${formatFullCurrency(dash?.ganancias.netas ?? 0)}`
                    : `Capital retirable: ${formatFullCurrency(dash?.capital.retirable ?? 0)}`}
                </Text>
                <AppInput
                  label="Monto a retirar"
                  placeholder="0.00"
                  value={retirarForm.monto}
                  onChangeText={(v) => setRetirarForm((p) => ({ ...p, monto: v }))}
                  keyboardType="decimal-pad"
                />
                <AppInput
                  label="Concepto"
                  placeholder="Ej: Retiro mensual"
                  value={retirarForm.concepto}
                  onChangeText={(v) => setRetirarForm((p) => ({ ...p, concepto: v }))}
                />
                <AppButton
                  title={showRetirar === 'ganancias' ? 'Retirar ganancias' : 'Retirar capital'}
                  onPress={handleRetirar}
                  loading={retiroGananciasMutation.isPending || retiroCapitalMutation.isPending}
                  icon="arrow-down-circle-outline"
                  variant={showRetirar === 'capital' ? 'danger' : 'secondary'}
                />
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  timestampRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.md },
  timestamp: { fontSize: FontSize.xs },
  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  actionBtnText: { color: '#FFFFFF', fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  kpiCard: {
    width: '48%',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
  },
  kpiLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.medium, marginBottom: 2 },
  kpiValue: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  sectionCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, marginBottom: Spacing.sm },
  patrimonioBar: { flexDirection: 'row', height: 20, borderRadius: BorderRadius.sm, overflow: 'hidden', marginBottom: Spacing.sm },
  patrimonioSegment: { height: '100%' },
  patrimonioRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 4 },
  patrimonioDot: { width: 8, height: 8, borderRadius: 4 },
  patrimonioLabel: { fontSize: FontSize.xs, flex: 1 },
  patrimonioValue: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  metricChip: {
    width: '48%',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    alignItems: 'center',
  },
  metricValue: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  metricLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.medium, marginTop: 1 },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  alertText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium, flex: 1 },
  resRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  resLabel: { fontSize: FontSize.sm },
  resValue: { fontSize: FontSize.sm },
  movCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.xs,
  },
  movIcon: { width: 36, height: 36, borderRadius: BorderRadius.sm, justifyContent: 'center', alignItems: 'center' },
  movInfo: { flex: 1 },
  movDesc: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  movMeta: { fontSize: FontSize.xs, marginTop: 1 },
  movMonto: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl * 2, gap: Spacing.sm },
  emptyText: { fontSize: FontSize.sm, textAlign: 'center' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  modalHint: { fontSize: FontSize.sm, marginBottom: Spacing.md, textAlign: 'center' },
});
