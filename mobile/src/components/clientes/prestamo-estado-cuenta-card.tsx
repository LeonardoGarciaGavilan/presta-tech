import { useState } from 'react';
import { StyleSheet, Text, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { BorderRadius, FontSize, FontWeight, IoniconsName, Shadows, Spacing, getColor, scale} from '@/constants/theme';
import { formatCurrency, formatDateShort } from '@/utils/formatters';
import type { PrestamoEstadoCuenta } from '@/types/cliente.types';
import InfoRow from '@/components/ui/info-row';
import { useTheme } from '@/components/ui/theme-provider';

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

interface PrestamoEstadoCuentaCardProps {
  prestamo: PrestamoEstadoCuenta;
}

export default function PrestamoEstadoCuentaCard({ prestamo }: PrestamoEstadoCuentaCardProps) {
  const { colors } = useTheme();
  const [showCuotas, setShowCuotas] = useState(false);
  const [showPagos, setShowPagos] = useState(false);

  const progress = prestamo.totalCuotas > 0
    ? Math.round((prestamo.cuotasPagadas / prestamo.totalCuotas) * 100)
    : 0;

  const accent = ESTADO_ACCENT[prestamo.estado] || 'warning';
  const label = ESTADO_LABEL[prestamo.estado] || prestamo.estado;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, Shadows.sm]}>
      <View style={styles.header}>
        <Text style={[styles.id, { color: colors.textTertiary }]}>
          #{prestamo.id.slice(0, 8)}
        </Text>
        <View style={[styles.badge, { backgroundColor: getColor(colors, `${accent}Light`) }]}>
          <Text style={[styles.badgeText, { color: getColor(colors, accent) }]}>{label}</Text>
        </View>
      </View>

      <View style={styles.amountRow}>
        <Text style={[styles.amount, { color: colors.text }]}>
          {formatCurrency(prestamo.monto)}
        </Text>
        <Text style={[styles.freq, { color: colors.textSecondary }]}>
          {prestamo.frecuencia}
        </Text>
      </View>

      <View style={styles.infoGrid}>
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
          <Ionicons name="calendar" size={scale(14)} color={colors.primary} />
          <Text style={[styles.nextPaymentText, { color: colors.primary }]}>
            Próximo pago: {formatDateShort(prestamo.proximaFecha)} — {formatCurrency(prestamo.proximaMonto)}
          </Text>
        </View>
      )}

      {prestamo.cuotasPendientesDetalle.length > 0 && (
        <Pressable
          style={({ pressed }) => [styles.collapseBtn, { borderTopColor: colors.borderLight }, { opacity: pressed ? 0.7 : 1 }]}
          onPress={() => setShowCuotas(!showCuotas)}
        >
          <Ionicons
            name={showCuotas ? 'chevron-up' : 'chevron-down'}
            size={scale(16)}
            color={colors.textSecondary}
          />
          <Text style={[styles.collapseLabel, { color: colors.textSecondary }]}>
            Cuotas pendientes ({prestamo.cuotasPendientesDetalle.length})
          </Text>
        </Pressable>
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
        <Pressable
          style={({ pressed }) => [styles.collapseBtn, { borderTopColor: colors.borderLight }, { opacity: pressed ? 0.7 : 1 }]}
          onPress={() => setShowPagos(!showPagos)}
        >
          <Ionicons
            name={showPagos ? 'chevron-up' : 'chevron-down'}
            size={scale(16)}
            color={colors.textSecondary}
          />
          <Text style={[styles.collapseLabel, { color: colors.textSecondary }]}>
            Historial de pagos ({prestamo.pagos.length})
          </Text>
        </Pressable>
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

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  id: {
    fontSize: FontSize.xs,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: scale(2),
    borderRadius: BorderRadius.sm,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  amount: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
  },
  freq: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  infoGrid: {
    gap: scale(4),
    marginBottom: Spacing.md,
  },
  progressSection: {
    marginBottom: Spacing.sm,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: scale(4),
  },
  progressLabel: {
    fontSize: FontSize.xs,
  },
  progressPct: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  progressBar: {
    height: scale(6),
    borderRadius: scale(3),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: scale(3),
  },
  nextPayment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
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
    gap: scale(4),
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
    width: scale(40),
  },
  colDate: {
    flex: 1,
  },
  colMonto: {
    width: scale(80),
    textAlign: 'right',
  },
  colStatus: {
    width: scale(72),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(3),
  },
  colStatusText: {
    width: scale(72),
  },
  statusDot: {
    width: scale(6),
    height: scale(6),
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
    marginTop: scale(1),
  },
  pagoRight: {
    alignItems: 'flex-end',
  },
  pagoTotal: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  pagoDetalle: {
    fontSize: FontSize.xs,
    marginTop: scale(1),
  },
});
