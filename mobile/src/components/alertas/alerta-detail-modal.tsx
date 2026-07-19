import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { TipoAlerta, Alerta } from '@/types/prestamo.types';
import { FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { AppButton } from '@/components/ui/app-button';
import { useTheme } from '@/components/ui/theme-provider';

const ALERTA_COLORS: Record<TipoAlerta, string> = {
  SOLICITUD: '#0EA5E9',
  REFINANCIAMIENTO: '#8B5CF6',
  CAMBIO_FRECUENCIA: '#F59E0B',
  CAMBIO_TASA: '#3B82F6',
  CAMBIO_CUOTAS: '#10B981',
  CAMBIO_FECHA_PAGO: '#EC4899',
  CANCELACION: '#EF4444',
  CAMBIO_ESTADO: '#6366F1',
};

const ALERTA_ICONS: Record<TipoAlerta, keyof typeof Ionicons.glyphMap> = {
  SOLICITUD: 'document-text-outline',
  REFINANCIAMIENTO: 'git-network-outline',
  CAMBIO_FRECUENCIA: 'swap-horizontal-outline',
  CAMBIO_TASA: 'options-outline',
  CAMBIO_CUOTAS: 'grid-outline',
  CAMBIO_FECHA_PAGO: 'calendar-outline',
  CANCELACION: 'close-circle-outline',
  CAMBIO_ESTADO: 'shuffle-outline',
};

const TIPO_LABELS: Record<TipoAlerta, string> = {
  SOLICITUD: 'Solicitud de prestamo',
  REFINANCIAMIENTO: 'Refinanciamiento',
  CAMBIO_FRECUENCIA: 'Cambio de frecuencia',
  CAMBIO_TASA: 'Cambio de tasa',
  CAMBIO_CUOTAS: 'Cambio de cuotas',
  CAMBIO_FECHA_PAGO: 'Cambio de fecha de pago',
  CANCELACION: 'Cancelacion',
  CAMBIO_ESTADO: 'Cambio de estado',
};

const DETALLE_LABELS: Record<string, string> = {
  estadoAnterior: 'Estado anterior',
  estadoNuevo: 'Estado nuevo',
  monto: 'Monto',
  numeroCuotas: 'Cuotas',
  tasaInteres: 'Tasa de interes',
  frecuenciaPago: 'Frecuencia',
  saldoRefinanciado: 'Saldo refinanciado',
  nuevasCuotas: 'Nuevas cuotas',
  nuevaCuota: 'Nueva cuota mensual',
  tasaAnterior: 'Tasa anterior',
  tasaNueva: 'Tasa nueva',
  cuotasAntes: 'Cuotas anteriores',
  cuotasNuevas: 'Nuevas cuotas',
  frecuenciaAnterior: 'Frecuencia anterior',
  frecuenciaNueva: 'Nueva frecuencia',
  nuevaFecha: 'Nueva fecha',
  motivo: 'Motivo',
};

const SKIP_KEYS = new Set(['prestamoId', 'clienteNombre']);

function formatDetalleValue(key: string, value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'number') {
    if (key.toLowerCase().includes('monto') || key.toLowerCase().includes('cuota')) {
      return `RD$${value.toLocaleString('es-DO')}`;
    }
    if (key.toLowerCase().includes('tasa')) {
      return `${value}%`;
    }
    return String(value);
  }
  return String(value);
}

function formatFullDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-DO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface AlertaDetailModalProps {
  visible: boolean;
  alerta: Alerta | null;
  onClose: () => void;
  onMarkRead?: (alertaId: string) => void;
  onGoToLoan?: (prestamoId: string) => void;
}

export default function AlertaDetailModal({
  visible,
  alerta,
  onClose,
  onMarkRead,
  onGoToLoan,
}: AlertaDetailModalProps) {
  const { colors } = useTheme();

  if (!alerta) return null;

  const tipoColor = ALERTA_COLORS[alerta.tipo] ?? colors.primary;
  const icon = ALERTA_ICONS[alerta.tipo] ?? 'alert-circle-outline';
  const detalle = alerta.detalle && typeof alerta.detalle === 'object'
    ? alerta.detalle as Record<string, unknown>
    : null;

  const detalleEntries = detalle
    ? Object.entries(detalle).filter(([k]) => !SKIP_KEYS.has(k))
    : [];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.overlay, { backgroundColor: colors.overlay }]} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.surfaceElevated }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.header, { backgroundColor: tipoColor + '12', borderBottomColor: colors.border }]}>
            <View style={[styles.headerIcon, { backgroundColor: tipoColor + '20' }]}>
              <Ionicons name={icon} size={28} color={tipoColor} />
            </View>
            <View style={styles.headerInfo}>
              <Text style={[styles.headerTitle, { color: tipoColor }]}>
                {TIPO_LABELS[alerta.tipo]}
              </Text>
              <Text style={[styles.headerClient, { color: colors.text }]}>
                {alerta.clienteNombre}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            <Text style={[styles.description, { color: colors.text }]}>
              {alerta.descripcion}
            </Text>

            {detalleEntries.length > 0 && (
              <View style={[styles.detailSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.detailSectionTitle, { color: colors.textSecondary }]}>Detalle</Text>
                {detalleEntries.map(([key, value]) => (
                  <View key={key} style={[styles.detailRow, { borderBottomColor: colors.borderLight }]}>
                    <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>
                      {DETALLE_LABELS[key] ?? key}
                    </Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>
                      {formatDetalleValue(key, value)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={14} color={colors.textTertiary} />
              <Text style={[styles.metaText, { color: colors.textTertiary }]}>
                {formatFullDate(alerta.createdAt)}
              </Text>
            </View>
            {alerta.usuarioNombre !== 'Sistema' && (
              <View style={styles.metaRow}>
                <Ionicons name="person-outline" size={14} color={colors.textTertiary} />
                <Text style={[styles.metaText, { color: colors.textTertiary }]}>
                  {alerta.usuarioNombre}
                </Text>
              </View>
            )}
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            {onGoToLoan && (
              <AppButton
                title="Ver prestamo"
                onPress={() => onGoToLoan(alerta.prestamoId)}
                variant="outline"
                icon="open-outline"
                style={styles.footerBtn}
              />
            )}
            {!alerta.leida && onMarkRead && (
              <AppButton
                title="Marcar leida"
                onPress={() => onMarkRead(alerta.id)}
                variant="primary"
                icon="checkmark-done-outline"
                style={styles.footerBtn}
              />
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '85%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
      },
      android: { elevation: 8 },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerClient: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    marginTop: 2,
  },
  closeBtn: {
    padding: Spacing.xs,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  description: {
    fontSize: FontSize.md,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  detailSection: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  detailSectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  detailLabel: {
    fontSize: FontSize.sm,
    flex: 1,
  },
  detailValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    textAlign: 'right',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  metaText: {
    fontSize: FontSize.xs,
  },
  footer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerBtn: {
    flex: 1,
  },
});
