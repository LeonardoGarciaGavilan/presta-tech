import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontSize, FontWeight, IoniconsName, Spacing, BorderRadius, scale} from '@/constants/theme';
import { formatCurrency } from '@/utils/formatters';
import { AppButton } from '@/components/ui/app-button';
import { HoldToConfirmButton } from '@/components/ui/hold-to-confirm-button';
import AnimatedModal from '@/components/ui/animated-modal';
import { useTheme } from '@/components/ui/theme-provider';
import { usePrestamoEstados, type EstadoConfig } from '@/hooks/use-prestamo-estados';

interface ActionConfirmModalProps {
  visible: boolean;
  titulo: string;
  desc: string;
  icon: string;
  colorAccion: string;
  pedirMotivo: boolean;
  motivoLabel?: string;
  confirmacionConHold?: boolean;
  danger?: boolean;
  subtitle?: string;
  estadoActual?: string;
  estadoNuevo?: string;
  prestamo?: { monto: number; numeroCuotas?: number; frecuenciaPago?: string } | null;
  cliente?: { nombre: string; apellido?: string | null } | null;
  loading?: boolean;
  onConfirm: (motivo?: string) => void;
  onCancel: () => void;
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function EstadoPill({ config }: { config?: EstadoConfig }) {
  if (!config) return null;
  return (
    <View
      style={[styles.estadoPill, { backgroundColor: config.bg, borderColor: config.border }]}
      accessibilityRole="text"
      accessibilityLabel={config.label}
    >
      <Ionicons name={config.icon as IoniconsName} size={scale(12)} color={config.color} />
      <Text style={[styles.estadoPillText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

function ResumenFila({
  icon,
  label,
  valor,
  strong = false,
}: {
  icon: string;
  label: string;
  valor: string;
  strong?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.resumenRow}>
      <Ionicons name={icon as IoniconsName} size={scale(14)} color={colors.textSecondary} />
      <Text style={[styles.resumenLabel, { color: colors.textTertiary }]}>{label}</Text>
      <Text
        style={[
          styles.resumenValue,
          { color: colors.text },
          strong && styles.resumenValueStrong,
        ]}
        numberOfLines={1}
      >
        {valor}
      </Text>
    </View>
  );
}

export default function ActionConfirmModal({
  visible,
  titulo,
  desc,
  icon,
  colorAccion,
  pedirMotivo,
  motivoLabel = 'Motivo del rechazo',
  confirmacionConHold = false,
  danger = false,
  subtitle,
  estadoActual,
  estadoNuevo,
  prestamo,
  cliente,
  loading,
  onConfirm,
  onCancel,
}: ActionConfirmModalProps) {
  const { colors } = useTheme();
  const estados = usePrestamoEstados();
  const [motivo, setMotivo] = useState('');

  const handleCancel = () => {
    setMotivo('');
    onCancel();
  };

  const handleConfirm = () => {
    onConfirm(pedirMotivo ? motivo : undefined);
    setMotivo('');
  };

  return (
    <AnimatedModal
      visible={visible}
      onRequestClose={handleCancel}
      avoidKeyboard
      accessibilityLabel={titulo}
    >
      <View style={[styles.header, { backgroundColor: hexToRgba(colorAccion, 0.12) }]}>
        <View
          style={[styles.headerIcon, { backgroundColor: hexToRgba(colorAccion, 0.18) }]}
        >
          <Ionicons name={icon as IoniconsName} size={scale(22)} color={colorAccion} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colorAccion }]} numberOfLines={1}>
            {titulo}
          </Text>
          {!!subtitle && (
            <Text
              style={[styles.subtitle, { color: colors.textTertiary }]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          )}
        </View>
        <Pressable
          onPress={handleCancel}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          style={styles.closeBtn}
        >
          <Ionicons name="close" size={scale(20)} color={colors.textTertiary} />
        </Pressable>
      </View>
      <ScrollView
        style={styles.body}
        keyboardShouldPersistTaps="handled"
        bounces={false}
        contentContainerStyle={{ paddingBottom: Spacing.sm }}
      >
        {estadoActual && estadoNuevo && (
          <View style={styles.transicion}>
            <EstadoPill config={estados[estadoActual]} />
            <Ionicons
              name="arrow-forward"
              size={scale(14)}
              color={colors.textTertiary}
            />
            <EstadoPill config={estados[estadoNuevo]} />
          </View>
        )}

        <Text style={[styles.desc, { color: colors.textSecondary }]}>{desc}</Text>

        {prestamo && (
          <View style={[styles.summaryCard, { backgroundColor: colors.borderLight, borderColor: colors.border }]}>
            {cliente && (
              <ResumenFila
                icon="person-outline"
                label="Cliente"
                valor={`${cliente.nombre} ${cliente.apellido ?? ''}`.trim()}
              />
            )}
            <ResumenFila
              icon="cash-outline"
              label="Monto"
              valor={formatCurrency(prestamo.monto)}
              strong
            />
            {prestamo.numeroCuotas ? (
              <ResumenFila
                icon="repeat-outline"
                label="Condiciones"
                valor={`${prestamo.numeroCuotas} cuotas · ${prestamo.frecuenciaPago ?? ''}`}
              />
            ) : null}
          </View>
        )}

        {pedirMotivo && (
          <>
            <Text style={[styles.motivoLabel, { color: colors.text }]}>
              {motivoLabel} <Text style={{ color: colors.error }}>*</Text>
            </Text>
            <TextInput
              value={motivo}
              onChangeText={setMotivo}
              placeholder="Indica el motivo..."
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={3}
              style={[styles.motivoInput, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, color: colors.text }]}
            />
          </>
        )}

        {confirmacionConHold ? (
          <View style={styles.actionsHold}>
            <HoldToConfirmButton
              title={titulo}
              loading={loading}
              variant={danger ? 'danger' : 'primary'}
              disabled={pedirMotivo && !motivo.trim()}
              onConfirm={handleConfirm}
              icon={danger ? 'warning' : 'lock-closed'}
              hint={pedirMotivo && !motivo.trim() ? 'Indica el motivo para confirmar' : 'Mantén presionado para confirmar'}
            />
            <AppButton title="Cancelar" onPress={handleCancel} variant="ghost" />
          </View>
        ) : (
          <View style={styles.actions}>
            <AppButton
              title={titulo}
              loading={loading}
              disabled={pedirMotivo && !motivo.trim()}
              onPress={handleConfirm}
              style={[
                danger ? { backgroundColor: colors.error } : undefined,
              ]}
            />
            <AppButton
              title="Cancelar"
              onPress={handleCancel}
              variant="ghost"
            />
          </View>
        )}
      </ScrollView>
    </AnimatedModal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  headerIcon: {
    width: scale(44),
    height: scale(44),
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  subtitle: {
    fontSize: FontSize.xs,
    marginTop: scale(1),
  },
  closeBtn: {
    padding: scale(2),
  },
  body: {
    padding: Spacing.md,
  },
  transicion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  estadoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    paddingHorizontal: Spacing.sm,
    paddingVertical: scale(3),
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
  },
  estadoPillText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  desc: {
    fontSize: FontSize.sm,
    marginBottom: Spacing.md,
    lineHeight: scale(20),
  },
  motivoLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.xs,
  },
  motivoInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    fontSize: FontSize.sm,
    minHeight: scale(80),
    textAlignVertical: 'top',
    marginBottom: Spacing.md,
  },
  actions: {
    gap: Spacing.sm,
    flexShrink: 0,
  },
  actionsHold: {
    gap: Spacing.sm,
    flexShrink: 0,
  },
  summaryCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.sm + 2,
    marginBottom: Spacing.md,
    gap: scale(6),
  },
  resumenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  resumenLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    width: scale(84),
  },
  resumenValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  resumenValueStrong: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
});