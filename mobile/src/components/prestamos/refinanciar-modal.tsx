import { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRefinanciarPrestamo } from '@/hooks/use-prestamos';
import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import PickerField from '@/components/ui/picker-field';
import DatePickerField from '@/components/ui/date-picker-field';
import { useTheme } from '@/components/ui/theme-provider';
import { useToast } from '@/components/ui/toast';
import { getConfiguracion } from '@/db/config-db';
import { construirPrestamoRefinanciadoLocal } from '@/utils/amortizacion';
import { formatCurrency } from '@/utils/formatters';
import type { FrecuenciaPago, Prestamo } from '@/types/prestamo.types';
import { FontSize, FontWeight, Spacing, BorderRadius, scale} from '@/constants/theme';

interface RefinanciarModalProps {
  visible: boolean;
  onClose: () => void;
  prestamo: Prestamo;
  onSuccess?: () => void;
}

const FRECUENCIAS: FrecuenciaPago[] = ['DIARIO', 'SEMANAL', 'QUINCENAL', 'MENSUAL'];

const RefinanciarModal = ({ visible, onClose, prestamo, onSuccess }: RefinanciarModalProps) => {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const refinanciarMutation = useRefinanciarPrestamo();
  const [nuevasCuotas, setNuevasCuotas] = useState('');
  const [nuevaTasa, setNuevaTasa] = useState('');
  const [frecuencia, setFrecuencia] = useState<FrecuenciaPago | undefined>(undefined);
  const [fechaPago, setFechaPago] = useState('');
  const [motivo, setMotivo] = useState('');

  const cuotasPendientes = useMemo(
    () => (prestamo.cuotas ?? []).filter((c) => !c.pagada),
    [prestamo.cuotas],
  );
  const saldoPendiente = useMemo(
    () =>
      Math.round(
        cuotasPendientes.reduce((s, c) => s + c.capital + c.interes + (c.mora || 0), 0) * 100,
      ) / 100,
    [cuotasPendientes],
  );

  // Reglas parametrizables (best-effort con config cacheada; el servidor
  // re-valida siempre). Solo se evalúan si hay config disponible.
  const bloqueoRegla = useMemo(() => {
    if (!visible) return null;
    let config: ReturnType<typeof getConfiguracion> = null;
    try {
      config = getConfiguracion();
    } catch {
      return null;
    }
    if (!config) return null;
    const maxCuotas = (config as any).cuotasRestantesParaRenovar ?? 0;
    if (maxCuotas > 0 && cuotasPendientes.length > maxCuotas) {
      return `Solo se puede renovar cuando faltan ${maxCuotas} cuota(s) o menos. Este préstamo tiene ${cuotasPendientes.length} pendientes.`;
    }
    const maxVeces = (config as any).maxRefinanciamientosPorPrestamo ?? 0;
    if (maxVeces > 0 && (prestamo.vecesRefinanciado ?? 0) >= maxVeces) {
      return `Este préstamo alcanzó el límite de ${maxVeces} refinanciamiento(s).`;
    }
    return null;
  }, [visible, cuotasPendientes.length, prestamo.vecesRefinanciado]);

  const preview = useMemo(() => {
    const cuotasNum = parseInt(nuevasCuotas, 10);
    const tasaNum = parseFloat(nuevaTasa);
    if (!(cuotasNum > 0) || !(tasaNum > 0)) return null;
    try {
      return construirPrestamoRefinanciadoLocal(
        prestamo,
        {
          nuevasCuotas: cuotasNum,
          nuevaTasa: tasaNum,
          ...(frecuencia ? { nuevaFrecuencia: frecuencia } : {}),
          ...(fechaPago ? { nuevaFechaPago: fechaPago } : {}),
        },
        new Date(),
      );
    } catch {
      return null;
    }
  }, [nuevasCuotas, nuevaTasa, frecuencia, fechaPago, prestamo]);

  const handleRefinanciar = useCallback(async () => {
    const cuotasNum = parseInt(nuevasCuotas, 10);
    const tasaNum = parseFloat(nuevaTasa);
    if (!cuotasNum || cuotasNum <= 0 || !tasaNum || tasaNum <= 0) {
      showToast('Ingresa valores válidos', 'error');
      return;
    }
    if (tasaNum < 0.1 || tasaNum > 100) {
      showToast('La tasa debe estar entre 0.1% y 100%', 'error');
      return;
    }
    try {
      await refinanciarMutation.mutateAsync({
        id: prestamo.id,
        data: {
          nuevasCuotas: cuotasNum,
          nuevaTasa: tasaNum,
          ...(frecuencia ? { nuevaFrecuencia: frecuencia } : {}),
          ...(fechaPago ? { nuevaFechaPago: fechaPago } : {}),
          ...(motivo.trim() ? { motivo: motivo.trim() } : {}),
        },
      });
      onSuccess?.();
      onClose();
    } catch (err: any) {
      showToast(err?.message || 'Error al refinanciar', 'error');
    }
  }, [nuevasCuotas, nuevaTasa, frecuencia, fechaPago, motivo, prestamo.id, refinanciarMutation, onSuccess, onClose, showToast]);

  const inputsValidos =
    !!parseInt(nuevasCuotas, 10) &&
    parseInt(nuevasCuotas, 10) > 0 &&
    !!parseFloat(nuevaTasa) &&
    parseFloat(nuevaTasa) >= 0.1 &&
    parseFloat(nuevaTasa) <= 100;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.overlay, { backgroundColor: colors.overlay }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
          <View style={[styles.headerBar, { backgroundColor: colors.primary }]}>
            <Ionicons name="refresh" size={scale(22)} color="#FFFFFF" />
            <Text style={[styles.title, { color: '#FFFFFF' }]}>Refinanciar Préstamo</Text>
          </View>
          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled" bounces={false} contentContainerStyle={{ paddingBottom: Spacing.sm }}>
              <View style={[styles.contextBox, { backgroundColor: colors.surface }]}>
                <Text style={[styles.contextText, { color: colors.textSecondary }]}>
                  Saldo pendiente: <Text style={{ color: colors.text, fontWeight: FontWeight.bold }}>{formatCurrency(saldoPendiente)}</Text>
                </Text>
                <Text style={[styles.contextText, { color: colors.textSecondary }]}>
                  Cuotas pendientes: <Text style={{ color: colors.text, fontWeight: FontWeight.bold }}>{cuotasPendientes.length}</Text>
                  {'  ·  '}Tasa actual: <Text style={{ color: colors.text, fontWeight: FontWeight.bold }}>{prestamo.tasaInteres}%</Text>
                </Text>
                <Text style={[styles.contextText, { color: colors.textSecondary }]}>
                  El interés no pagado NO se refinancia; se recalcula sobre capital + mora.
                </Text>
              </View>

              {bloqueoRegla && (
                <View style={[styles.bloqueoBox, { backgroundColor: colors.error + '18' }]}>
                  <Ionicons name="lock-closed" size={scale(14)} color={colors.error} />
                  <Text style={[styles.bloqueoText, { color: colors.error }]}>{bloqueoRegla}</Text>
                </View>
              )}

              <AppInput
                label="Nuevo número de cuotas"
                placeholder="Ej: 12"
                keyboardType="numeric"
                value={nuevasCuotas}
                onChangeText={setNuevasCuotas}
              />
              <AppInput
                label="Nueva tasa de interés (%)"
                placeholder="Ej: 3.5"
                keyboardType="decimal-pad"
                value={nuevaTasa}
                onChangeText={setNuevaTasa}
                hint="Entre 0.1 y 100"
              />
              <PickerField
                label="Nueva frecuencia de pago (opcional)"
                value={frecuencia}
                options={FRECUENCIAS}
                onSelect={(v) => setFrecuencia(v as FrecuenciaPago)}
                hint={`Actual: ${prestamo.frecuenciaPago}`}
              />
              <DatePickerField
                label="Nueva fecha de próxima cuota (opcional)"
                value={fechaPago}
                onChange={setFechaPago}
              />
              <AppInput
                label="Motivo (opcional)"
                placeholder="Ej: Cliente solicitó reducir cuota"
                value={motivo}
                onChangeText={setMotivo}
                multiline
                numberOfLines={2}
              />

              {preview && (
                <View style={[styles.previewBox, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.previewTitle, { color: colors.textSecondary }]}>Resumen del nuevo plan</Text>
                  <Text style={[styles.previewText, { color: colors.text }]}>
                    Cuota: <Text style={{ fontWeight: FontWeight.bold }}>{formatCurrency(preview.prestamo.cuotaMensual)}</Text>
                    {'  ·  '}Total: <Text style={{ fontWeight: FontWeight.bold }}>{formatCurrency(preview.prestamo.montoTotal)}</Text>
                  </Text>
                  <Text style={[styles.previewText, { color: colors.textSecondary }]}>
                    Saldo refinanciado: {formatCurrency(preview.saldoRefinanciado)}
                  </Text>
                </View>
              )}

              <View style={styles.actions}>
                <AppButton title="Cancelar" onPress={onClose} variant="ghost" style={{ flex: 1 }} />
                <AppButton
                  title="Refinanciar"
                  onPress={handleRefinanciar}
                  loading={refinanciarMutation.isPending}
                  disabled={!inputsValidos || !!bloqueoRegla}
                  style={{ flex: 1 }}
                />
              </View>
            </ScrollView>
          </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  title: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  body: { padding: Spacing.md },
  contextBox: {
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    gap: 2,
  },
  contextText: { fontSize: FontSize.xs },
  bloqueoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  bloqueoText: { fontSize: FontSize.xs, flex: 1, fontWeight: FontWeight.bold },
  previewBox: {
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
    gap: 2,
  },
  previewTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  previewText: { fontSize: FontSize.xs },
  actions: { flexDirection: 'row', gap: Spacing.sm, flexShrink: 0 },
});

export default RefinanciarModal;
