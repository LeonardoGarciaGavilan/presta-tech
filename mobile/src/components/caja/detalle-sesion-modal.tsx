import { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppButton } from '@/components/ui/app-button';
import LoadingScreen from '@/components/ui/loading-screen';
import { useResumenCaja, useAuditoriaCaja } from '@/hooks/use-caja';
import { obtenerPago } from '@/api/pagos.api';
import { guardarReciboPDF } from '@/utils/recibo-pdf';
import { useToast } from '@/components/ui/toast';
import { FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { formatCurrency, formatDate, formatDateTime } from '@/utils/formatters';
import { useTheme } from '@/components/ui/theme-provider';
import type {
  CajaSesion,
  MovimientoTimeline,
  TipoMovimiento,
  Reconstruccion,
} from '@/types/caja.types';

interface Props {
  visible: boolean;
  cajaId: string;
  caja?: CajaSesion | null;
  onClose: () => void;
}

const METODO_PAGO_LABELS: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  TARJETA: 'Tarjeta',
  CHEQUE: 'Cheque',
};

const MOVIMIENTO_CONFIG: Record<TipoMovimiento, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  APERTURA_CAJA: { label: 'Apertura de caja', icon: 'lock-open-outline' },
  PAGO_RECIBIDO: { label: 'Pago recibido', icon: 'cash-outline' },
  DESEMBOLSO: { label: 'Desembolso', icon: 'cart-outline' },
  GASTO: { label: 'Gasto', icon: 'receipt-outline' },
  RETIRO_GANANCIAS: { label: 'Retiro de ganancias', icon: 'arrow-up-outline' },
  CIERRE_CAJA: { label: 'Cierre de caja', icon: 'lock-closed-outline' },
  INYECCION_CAPITAL: { label: 'Inyección de capital', icon: 'add-circle-outline' },
  AJUSTE_CAJA: { label: 'Ajuste de caja', icon: 'swap-horizontal-outline' },
  CORRECCION: { label: 'Corrección', icon: 'swap-horizontal-outline' },
};

function getTipoColor(tipo: TipoMovimiento): string {
  const ingresos: TipoMovimiento[] = ['PAGO_RECIBIDO', 'INYECCION_CAPITAL', 'AJUSTE_CAJA', 'CORRECCION'];
  const egresos: TipoMovimiento[] = ['DESEMBOLSO', 'GASTO', 'RETIRO_GANANCIAS'];
  if (tipo === 'APERTURA_CAJA') return '#16A34A';
  if (ingresos.includes(tipo)) return '#16A34A';
  if (egresos.includes(tipo)) return '#DC2626';
  return '#6B7280';
}

function formatHour(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' });
}

function formatFullDate(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-DO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function ReconstruccionCard({
  data,
  colors,
}: {
  data: Reconstruccion;
  colors: any;
}) {
  const difColor = data.diferencia === 0 ? '#16A34A' : '#DC2626';
  return (
    <View style={[s.reconstruccionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[s.sectionTitle, { color: colors.text }]}>Reconstrucción</Text>
      <View style={s.reconRow}>
        <Text style={[s.reconLabel, { color: colors.textTertiary }]}>Inicial</Text>
        <Text style={[s.reconValue, { color: colors.text }]}>{formatCurrency(data.inicial)}</Text>
      </View>
      <View style={s.reconRow}>
        <Text style={[s.reconLabel, { color: colors.textTertiary }]}>+ Ingresos</Text>
        <Text style={[s.reconValue, { color: '#16A34A' }]}>+{formatCurrency(data.ingresos)}</Text>
      </View>
      <View style={s.reconRow}>
        <Text style={[s.reconLabel, { color: colors.textTertiary }]}>- Egresos</Text>
        <Text style={[s.reconValue, { color: '#DC2626' }]}>-{formatCurrency(data.egresos)}</Text>
      </View>
      <View style={[s.reconDivider, { backgroundColor: colors.border }]} />
      <View style={s.reconRow}>
        <Text style={[s.reconLabel, { color: colors.text, fontWeight: FontWeight.semibold }]}>
          Esperado
        </Text>
        <Text style={[s.reconValue, { color: colors.text, fontWeight: FontWeight.bold }]}>
          {formatCurrency(data.esperado)}
        </Text>
      </View>
      <View style={s.reconRow}>
        <Text style={[s.reconLabel, { color: colors.textTertiary }]}>Real (cierre)</Text>
        <Text style={[s.reconValue, { color: colors.text }]}>
          {data.real != null ? formatCurrency(data.real) : '—'}
        </Text>
      </View>
      <View style={[s.reconDivider, { backgroundColor: colors.border }]} />
      <View style={s.reconRow}>
        <Text style={[s.reconLabel, { color: difColor, fontWeight: FontWeight.semibold }]}>
          Diferencia
        </Text>
        <Text style={[s.reconValue, { color: difColor, fontWeight: FontWeight.bold }]}>
          {data.diferencia === 0 ? '✅ Cuadrada' : formatCurrency(data.diferencia)}
        </Text>
      </View>
    </View>
  );
}

export default function DetalleSesionModal({ visible, cajaId, caja, onClose }: Props) {
  const { colorScheme, colors } = useTheme();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'resumen' | 'auditoria'>('resumen');

  const { data: resumenData, isLoading: loadingResumen } = useResumenCaja(
    caja?.fecha ?? undefined,
    cajaId,
  );
  const { data: auditoria, isLoading: loadingAuditoria } = useAuditoriaCaja(
    activeTab === 'auditoria' ? cajaId : undefined,
  );

  const handleReimprimir = useCallback(
    async (pagoId: string) => {
      try {
        const detalle = await obtenerPago(pagoId);
        await guardarReciboPDF(detalle);
        showToast('Recibo reimpreso exitosamente', 'success');
      } catch (err: any) {
        showToast(err?.message || 'Error al reimprimir recibo', 'error');
      }
    },
    [showToast],
  );

  function getEstadoColor(estado: string) {
    return estado === 'ABIERTA' ? '#16A34A' : colors.textTertiary;
  }
  function getEstadoBg(estado: string) {
    return estado === 'ABIERTA' ? '#F0FDF4' : colors.borderLight;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[s.modalOverlay, { backgroundColor: colors.overlay }]}>
        <View style={[s.modalCard, { backgroundColor: colors.surfaceElevated }]}>
          {/* Header */}
          <View style={[s.modalHeader, { borderBottomColor: colors.borderLight }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.modalTitle, { color: colors.text }]}>
                {caja ? formatDate(caja.fecha) : ''}
              </Text>
              {/* Tabs */}
              <View style={s.tabRow}>
                <Pressable
                  onPress={() => setActiveTab('resumen')}
                  style={[
                    s.tab,
                    activeTab === 'resumen' && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
                  ]}
                >
                  <Text
                    style={[
                      s.tabText,
                      { color: activeTab === 'resumen' ? colors.primary : colors.textTertiary },
                    ]}
                  >
                    Resumen
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setActiveTab('auditoria')}
                  style={[
                    s.tab,
                    activeTab === 'auditoria' && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
                  ]}
                >
                  <Text
                    style={[
                      s.tabText,
                      { color: activeTab === 'auditoria' ? colors.primary : colors.textTertiary },
                    ]}
                  >
                    Auditoría
                  </Text>
                </Pressable>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          {activeTab === 'resumen' && (
            <ResumenTab
              loading={loadingResumen}
              resumenData={resumenData}
              caja={caja}
              colors={colors}
              onReimprimir={handleReimprimir}
              onClose={onClose}
              getEstadoColor={getEstadoColor}
            />
          )}

          {activeTab === 'auditoria' && (
            <AuditoriaTab
              loading={loadingAuditoria}
              auditoria={auditoria}
              colors={colors}
              onClose={onClose}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

function ResumenTab({
  loading,
  resumenData,
  caja,
  colors,
  onReimprimir,
  onClose,
  getEstadoColor,
}: {
  loading: boolean;
  resumenData: any;
  caja?: CajaSesion | null;
  colors: any;
  onReimprimir: (pagoId: string) => void;
  onClose: () => void;
  getEstadoColor: (estado: string) => string;
}) {
  if (loading) {
    return (
      <View style={{ padding: Spacing.xl }}>
        <LoadingScreen message="Cargando detalle..." />
      </View>
    );
  }

  if (!resumenData) {
    return (
      <View style={{ padding: Spacing.xl, alignItems: 'center' }}>
        <Text style={{ color: colors.textTertiary }}>No se encontraron datos para esta fecha</Text>
      </View>
    );
  }

  return (
    <ScrollView style={s.modalBody} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Spacing.md }}>
      {/* Session info */}
      {caja && (
        <View style={[s.infoBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={s.infoRow}>
            <Text style={[s.infoLabel, { color: colors.textTertiary }]}>Estado</Text>
            <Text style={[s.infoValue, { color: getEstadoColor(caja.estado) }]}>
              {caja.estado === 'ABIERTA' ? 'Abierta' : 'Cerrada'}
            </Text>
          </View>
          <View style={s.infoRow}>
            <Text style={[s.infoLabel, { color: colors.textTertiary }]}>Apertura</Text>
            <Text style={[s.infoValue, { color: colors.text }]}>
              {formatDateTime(caja.createdAt)}
            </Text>
          </View>
          {caja.fechaCierre && (
            <View style={s.infoRow}>
              <Text style={[s.infoLabel, { color: colors.textTertiary }]}>Cierre</Text>
              <Text style={[s.infoValue, { color: colors.text }]}>
                {formatDateTime(caja.fechaCierre)}
              </Text>
            </View>
          )}
          <View style={s.infoRow}>
            <Text style={[s.infoLabel, { color: colors.textTertiary }]}>Usuario</Text>
            <Text style={[s.infoValue, { color: colors.text }]}>
              {caja.usuario?.nombre || '—'}
            </Text>
          </View>
          <View style={[s.divider, { backgroundColor: colors.borderLight }]} />
          <View style={s.infoRow}>
            <Text style={[s.infoLabel, { color: colors.textTertiary }]}>Monto inicial</Text>
            <Text style={[s.infoValue, { color: colors.text }]}>
              {formatCurrency(caja.montoInicial)}
            </Text>
          </View>
          {caja.montoCierre != null && (
            <View style={s.infoRow}>
              <Text style={[s.infoLabel, { color: colors.textTertiary }]}>Monto cierre</Text>
              <Text style={[s.infoValue, { color: colors.text }]}>
                {formatCurrency(caja.montoCierre)}
              </Text>
            </View>
          )}
          {caja.diferencia != null && (
            <View style={s.infoRow}>
              <Text style={[s.infoLabel, { color: colors.textTertiary }]}>Diferencia</Text>
              <Text
                style={[
                  s.infoValue,
                  {
                    color:
                      caja.diferencia === 0
                        ? '#16A34A'
                        : caja.diferencia > 0
                          ? '#D97706'
                          : '#DC2626',
                  },
                ]}
              >
                {caja.diferencia === 0
                  ? 'Cuadrada'
                  : `${caja.diferencia > 0 ? '+' : ''}${formatCurrency(caja.diferencia)}`}
              </Text>
            </View>
          )}
          {caja.observaciones && (
            <View style={s.infoRow}>
              <Text style={[s.infoLabel, { color: colors.textTertiary }]}>Obs.</Text>
              <Text style={[s.infoValue, { color: colors.text, flex: 2, textAlign: 'right' }]}>
                {caja.observaciones}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Resumen cards */}
      <View style={s.resumenGrid}>
        <View style={[s.resumenCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[s.resumenValue, { color: colors.primary }]}>
            {formatCurrency(resumenData.resumen?.totalCobrado || 0)}
          </Text>
          <Text style={[s.resumenLabel, { color: colors.textTertiary }]}>Cobrado</Text>
        </View>
        <View style={[s.resumenCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[s.resumenValue, { color: colors.text }]}>
            {resumenData.resumen?.cantidadPagos || 0}
          </Text>
          <Text style={[s.resumenLabel, { color: colors.textTertiary }]}>Pagos</Text>
        </View>
        <View style={[s.resumenCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[s.resumenValue, { color: colors.warning }]}>
            {formatCurrency(resumenData.resumen?.efectivoSistema || 0)}
          </Text>
          <Text style={[s.resumenLabel, { color: colors.textTertiary }]}>Efectivo sis.</Text>
        </View>
      </View>

      {/* Pagos por método */}
      {resumenData.pagosPorMetodo && Object.keys(resumenData.pagosPorMetodo).length > 0 && (
        <View style={[s.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>Cobros por método</Text>
          {Object.entries(resumenData.pagosPorMetodo).map(([metodo, data]: [string, any]) => (
            <View key={metodo} style={s.metodoRow}>
              <Text style={{ fontSize: FontSize.sm, color: colors.text }}>
                {METODO_PAGO_LABELS[metodo] || metodo}
              </Text>
              <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: colors.text }}>
                {formatCurrency(data.monto)} ({data.cantidad})
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Pagos del día */}
      {resumenData.pagos && resumenData.pagos.length > 0 && (
        <View style={[s.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>Pagos del día</Text>
          {resumenData.pagos.map((p: any) => (
            <View key={p.id} style={[s.pagoRow, { borderBottomColor: colors.borderLight }]}>
              <Pressable onPress={() => onReimprimir(p.id)} hitSlop={8} style={s.reprintIcon}>
                <Ionicons name="print-outline" size={18} color={colors.primary} />
              </Pressable>
              <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: colors.text }}>
                  {p.prestamo?.cliente?.nombre} {p.prestamo?.cliente?.apellido || ''}
                </Text>
                <Text style={{ fontSize: 10, color: colors.textTertiary }}>
                  {formatDateTime(p.createdAt)} · {p.metodo}
                </Text>
              </View>
              <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: colors.text }}>
                {formatCurrency(p.montoTotal)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Desembolsos */}
      {resumenData.desembolsos && resumenData.desembolsos.length > 0 && (
        <View style={[s.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>Desembolsos del día</Text>
          {resumenData.desembolsos.map((d: any) => (
            <View key={d.id} style={[s.pagoRow, { borderBottomColor: colors.borderLight }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: colors.text }}>
                  {d.prestamo?.cliente?.nombre} {d.prestamo?.cliente?.apellido || ''}
                </Text>
                <Text style={{ fontSize: 10, color: colors.textTertiary }}>
                  {d.concepto || 'Desembolso'} · {formatDateTime(d.createdAt)}
                </Text>
              </View>
              <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: colors.error }}>
                -{formatCurrency(d.monto)}
              </Text>
            </View>
          ))}
        </View>
      )}

      <AppButton title="Cerrar" onPress={onClose} variant="ghost" style={{ marginTop: Spacing.sm }} />
    </ScrollView>
  );
}

function AuditoriaTab({
  loading,
  auditoria,
  colors,
  onClose,
}: {
  loading: boolean;
  auditoria: any;
  colors: any;
  onClose: () => void;
}) {
  if (loading) {
    return (
      <View style={{ padding: Spacing.xl }}>
        <LoadingScreen message="Cargando auditoría..." />
      </View>
    );
  }

  if (!auditoria) {
    return (
      <View style={{ padding: Spacing.xl, alignItems: 'center' }}>
        <Text style={{ color: colors.textTertiary }}>No hay datos de auditoría</Text>
      </View>
    );
  }

  return (
    <ScrollView style={s.modalBody} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Spacing.md }}>
      {/* Reconstrucción */}
      <ReconstruccionCard data={auditoria.reconstruccion} colors={colors} />

      {/* Alertas */}
      {auditoria.validaciones?.alertas?.length > 0 && (
        <View style={[s.alertaCard, { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' }]}>
          <Text style={[s.sectionTitle, { color: '#991B1B' }]}>Alertas</Text>
          {auditoria.validaciones.alertas.map((alerta: string, i: number) => (
            <View key={i} style={s.alertaRow}>
              <Ionicons name="alert-circle" size={16} color="#DC2626" />
              <Text style={{ fontSize: FontSize.xs, color: '#991B1B', marginLeft: Spacing.xs, flex: 1 }}>
                {alerta}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Timeline */}
      {auditoria.timeline && auditoria.timeline.length > 0 && (
        <View style={[s.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>
            Movimientos ({auditoria.timeline.length})
          </Text>
          {auditoria.timeline.map((mov: MovimientoTimeline, i: number) => {
            const config = MOVIMIENTO_CONFIG[mov.tipo] || { label: mov.tipo, icon: 'ellipse-outline' as const };
            const tipoColor = getTipoColor(mov.tipo);
            const esIngreso = ['PAGO_RECIBIDO', 'INYECCION_CAPITAL', 'AJUSTE_CAJA', 'CORRECCION'].includes(mov.tipo);
            const esEgreso = ['DESEMBOLSO', 'GASTO', 'RETIRO_GANANCIAS'].includes(mov.tipo);

            return (
              <View key={mov.id || i}>
                {i > 0 && <View style={[s.timelineDot, { backgroundColor: colors.borderLight }]} />}
                <View style={s.timelineRow}>
                  <View style={[s.timelineIcon, { backgroundColor: tipoColor + '20' }]}>
                    <Ionicons name={config.icon} size={18} color={tipoColor} />
                  </View>
                  <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: colors.text }}>
                        {config.label}
                      </Text>
                      <Text style={{ fontSize: 10, color: colors.textTertiary }}>
                        {formatHour(mov.fecha)}
                      </Text>
                    </View>
                    {mov.descripcion && (
                      <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: 1 }}>
                        {mov.descripcion}
                      </Text>
                    )}
                  </View>
                  <Text
                    style={{
                      fontSize: FontSize.xs,
                      fontWeight: FontWeight.bold,
                      color: esIngreso ? '#16A34A' : esEgreso ? '#DC2626' : colors.text,
                      marginLeft: Spacing.sm,
                    }}
                  >
                    {esEgreso ? '-' : esIngreso ? '+' : ''}{formatCurrency(mov.monto)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Validación quick summary */}
      {auditoria.validaciones && (
        <View style={[s.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>Validación</Text>
          <View style={s.metodoRow}>
            <Text style={{ fontSize: FontSize.xs, color: colors.text }}>
              Secuencia válida (apertura → cierre)
            </Text>
            <Ionicons
              name={auditoria.validaciones.secuenciaValida ? 'checkmark-circle' : 'close-circle'}
              size={18}
              color={auditoria.validaciones.secuenciaValida ? '#16A34A' : '#DC2626'}
            />
          </View>
          <View style={s.metodoRow}>
            <Text style={{ fontSize: FontSize.xs, color: colors.text }}>
              Diferencia justificada
            </Text>
            <Ionicons
              name={auditoria.validaciones.diferenciaJustificada ? 'checkmark-circle' : 'close-circle'}
              size={18}
              color={auditoria.validaciones.diferenciaJustificada ? '#16A34A' : '#DC2626'}
            />
          </View>
        </View>
      )}

      <AppButton title="Cerrar" onPress={onClose} variant="ghost" style={{ marginTop: Spacing.sm }} />
    </ScrollView>
  );
}

// Re-exported helper used externally
export { METODO_PAGO_LABELS };

const s = {
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  } as any,
  modalCard: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  } as any,
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  } as any,
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  tabRow: {
    flexDirection: 'row',
    marginTop: Spacing.sm,
    gap: Spacing.lg,
  } as any,
  tab: {
    paddingBottom: Spacing.xs,
  } as any,
  tabText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  modalBody: { padding: Spacing.md },
  infoBox: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  } as any,
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  } as any,
  infoLabel: { fontSize: FontSize.xs, flex: 1 },
  infoValue: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, flex: 1, textAlign: 'right' },
  divider: { height: 1, marginVertical: Spacing.sm } as any,
  resumenGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  } as any,
  resumenCard: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    alignItems: 'center',
  } as any,
  resumenValue: { fontSize: FontSize.md, fontWeight: FontWeight.bold } as any,
  resumenLabel: { fontSize: FontSize.xs, marginTop: 2, textAlign: 'center' } as any,
  sectionCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  } as any,
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.sm,
  },
  metodoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  } as any,
  pagoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
  } as any,
  reprintIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  } as any,
  reconstruccionCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  } as any,
  reconRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  } as any,
  reconLabel: { fontSize: FontSize.xs },
  reconValue: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  reconDivider: { height: 1, marginVertical: Spacing.xs } as any,
  alertaCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  } as any,
  alertaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  } as any,
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  } as any,
  timelineIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  } as any,
  timelineDot: {
    height: 1,
    marginLeft: 18,
    marginVertical: 1,
  } as any,
} as const;
