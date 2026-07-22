import { memo, useCallback } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { BorderRadius, FontSize, FontWeight, Spacing, scale} from '@/constants/theme';
import { useTheme } from '@/components/ui/theme-provider';
import { formatCurrency } from '@/utils/formatters';
import type { ClienteVistaDia } from '@/types/rutas.types';

interface MapMarkerSheetProps {
  cliente: ClienteVistaDia;
  onCobrar: (item: ClienteVistaDia) => void;
  onMarcarVisita: (rcId: string, currentState: boolean) => void;
  onVerDetalle: (clienteId: string) => void;
  onClose: () => void;
}

function MapMarkerSheet({
  cliente,
  onCobrar,
  onMarcarVisita,
  onVerDetalle,
  onClose,
}: MapMarkerSheetProps) {
  const { colors } = useTheme();
  const {
    rutaClienteId,
    visitadoHoy,
    cliente: info,
    debeVisitar,
    tieneAtrasados,
    totalACobrar,
    orden,
  } = cliente;

  const handleNavigate = useCallback(() => {
    if (info.latitud && info.longitud) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${info.latitud},${info.longitud}`;
      Linking.openURL(url);
    }
  }, [info.latitud, info.longitud]);

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Pressable
        style={[styles.container, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
      >
        <View style={styles.handle} />

        <View style={styles.header}>
          <View style={[styles.orderBadge, { backgroundColor: colors.routeBg }]}>
            <Text style={[styles.orderText, { color: colors.route }]}>{orden}</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {info.nombre} {info.apellido || ''}
            </Text>
            {info.telefono && (
              <Text style={[styles.phone, { color: colors.textTertiary }]}>{info.telefono}</Text>
            )}
          </View>
          <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
            <Ionicons name="close" size={scale(20)} color={colors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.badges}>
          {tieneAtrasados && (
            <View style={[styles.badge, { backgroundColor: colors.errorLight }]}>
              <Text style={[styles.badgeText, { color: colors.error }]}>Atrasado</Text>
            </View>
          )}
          {visitadoHoy ? (
            <View style={[styles.badge, { backgroundColor: colors.successLight }]}>
              <Ionicons name="checkmark" size={scale(12)} color={colors.success} />
              <Text style={[styles.badgeText, { color: colors.success }]}>Visitado</Text>
            </View>
          ) : debeVisitar ? (
            <View style={[styles.badge, { backgroundColor: colors.warningLight }]}>
              <Text style={[styles.badgeText, { color: colors.warning }]}>Pendiente</Text>
            </View>
          ) : null}
        </View>

        {debeVisitar && (
          <View style={[styles.amountRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.amountLabel, { color: colors.textTertiary }]}>A cobrar</Text>
            <Text style={[styles.amountValue, { color: colors.text }]}>
              RD$ {formatCurrency(totalACobrar)}
            </Text>
          </View>
        )}

        <View style={styles.actions}>
          {debeVisitar && (
            <Pressable
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
              onPress={() => onCobrar(cliente)}
            >
              <Ionicons name="cash-outline" size={scale(18)} color="#FFF" />
              <Text style={styles.actionBtnText}>Cobrar</Text>
            </Pressable>
          )}
          <Pressable
            style={[
              styles.actionBtn,
              {
                backgroundColor: visitadoHoy ? colors.surface : colors.successLight,
                borderColor: visitadoHoy ? colors.border : colors.success,
                borderWidth: 1,
              },
            ]}
            onPress={() => onMarcarVisita(rutaClienteId, visitadoHoy)}
          >
            <Ionicons
              name={visitadoHoy ? 'close-circle-outline' : 'checkmark-circle-outline'}
              size={scale(18)}
              color={visitadoHoy ? colors.textSecondary : colors.success}
            />
            <Text
              style={[
                styles.actionBtnText,
                { color: visitadoHoy ? colors.textSecondary : colors.success },
              ]}
            >
              {visitadoHoy ? 'Desmarcar' : 'Visitado'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.secondaryActions}>
          {info.latitud && info.longitud && (
            <Pressable
              style={[styles.secondaryBtn, { borderColor: colors.border }]}
              onPress={handleNavigate}
            >
              <Ionicons name="navigate-outline" size={scale(16)} color={colors.primary} />
              <Text style={[styles.secondaryBtnText, { color: colors.primary }]}>Navegar</Text>
            </Pressable>
          )}
          <Pressable
            style={[styles.secondaryBtn, { borderColor: colors.border }]}
            onPress={() => onVerDetalle(info.id)}
          >
            <Ionicons name="person-outline" size={scale(16)} color={colors.primary} />
            <Text style={[styles.secondaryBtnText, { color: colors.primary }]}>Ver perfil</Text>
          </Pressable>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  container: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
  },
  handle: {
    width: scale(40),
    height: scale(4),
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: Spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  orderBadge: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  headerInfo: {
    flex: 1,
  },
  name: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  phone: {
    fontSize: FontSize.xs,
    marginTop: scale(1),
  },
  closeBtn: {
    padding: Spacing.xs,
  },
  badges: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    paddingHorizontal: Spacing.sm,
    paddingVertical: scale(3),
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
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  amountLabel: {
    fontSize: FontSize.sm,
  },
  amountValue: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(6),
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
  },
  actionBtnText: {
    color: '#FFF',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(6),
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  secondaryBtnText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
});

const MapMarkerSheetMemo = memo(MapMarkerSheet);
MapMarkerSheetMemo.displayName = 'MapMarkerSheet';
export default MapMarkerSheetMemo;
