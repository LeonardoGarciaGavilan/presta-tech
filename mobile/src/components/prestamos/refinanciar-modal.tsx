import { useCallback, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRefinanciarPrestamo } from '@/hooks/use-prestamos';
import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import PickerField from '@/components/ui/picker-field';
import DatePickerField from '@/components/ui/date-picker-field';
import { useTheme } from '@/components/ui/theme-provider';
import { useToast } from '@/components/ui/toast';
import { getConfiguracion } from '@/db/config-db';
import {
  construirPrestamoRefinanciadoLocal,
  calcularAmortizacionRapidaLocal,
} from '@/utils/amortizacion';
import { formatCurrency } from '@/utils/formatters';
import { m } from '@/utils/money';
import type { FrecuenciaPago, Prestamo } from '@/types/prestamo.types';
import { FontSize, FontWeight, Spacing, BorderRadius, scale} from '@/constants/theme';

interface RefinanciarModalProps {
  visible: boolean;
  onClose: () => void;
  prestamo: Prestamo;
  onSuccess?: () => void;
}

const FRECUENCIAS: FrecuenciaPago[] = ['DIARIO', 'SEMANAL', 'QUINCENAL', 'MENSUAL'];

const FREQ_LABEL: Record<string, string> = {
  DIARIO: 'diario',
  SEMANAL: 'semanal',
  QUINCENAL: 'quincenal',
  MENSUAL: 'mensual',
};

const DURACION_LABEL: Record<string, string> = {
  DIARIO: 'días',
  SEMANAL: 'semanas',
  QUINCENAL: 'quincenas',
  MENSUAL: 'meses',
};

// ── Sanitización numérica ───────────────────────────────────────────
// Normaliza coma decimal (teclados es-DO / Android) y filtra caracteres
// inválidos antes de cualquier parseFloat. No altera la lógica posterior.

function sanitizeDecimal(raw: string): string {
  const cleaned = raw.replace(/,/g, '.').replace(/[^0-9.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) return cleaned;
  return (
    cleaned.slice(0, firstDot + 1) +
    cleaned.slice(firstDot + 1).replace(/\./g, '')
  );
}

function sanitizeInteger(raw: string): string {
  return raw.replace(/[^0-9]/g, '');
}

interface PreviewRefinanciamiento {
  cuota: number;
  montoTotal: number;
  saldoRefinanciado: number;
  modoRapido: boolean;
  error: string | null;
}

const RefinanciarModal = ({ visible, onClose, prestamo, onSuccess }: RefinanciarModalProps) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const refinanciarMutation = useRefinanciarPrestamo();
  const [modoRapido, setModoRapido] = useState(true);
  const [modoCalculo, setModoCalculo] = useState<'PAGO' | 'GANANCIA'>('PAGO');
  const [nuevasCuotas, setNuevasCuotas] = useState('');
  const [nuevaTasa, setNuevaTasa] = useState('');
  const [pagoPorPeriodo, setPagoPorPeriodo] = useState('');
  const [gananciaDeseada, setGananciaDeseada] = useState('');
  const [frecuencia, setFrecuencia] = useState<FrecuenciaPago | undefined>(undefined);
  const [fechaPago, setFechaPago] = useState('');
  const [motivo, setMotivo] = useState('');

  const cuotasPendientes = useMemo(
    () => (prestamo.cuotas ?? []).filter((c) => !c.pagada),
    [prestamo.cuotas],
  );

  const frecuenciaEfectiva: FrecuenciaPago =
    frecuencia ?? prestamo.frecuenciaPago;

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
    // Switch maestro: sin el campo (cache antiguo) se trata como activado.
    if ((config as any).permitirRefinanciamiento === false) {
      return "El refinanciamiento de préstamos no está habilitado para tu empresa.";
    }
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

  // Base a refinanciar: capital + mora de las cuotas pendientes. El interés
  // no pagado NO se refinancia (igual que el backend).
  const saldoRefinanciado = useMemo(
    () =>
      Math.round(
        cuotasPendientes.reduce((s, c) => s + m(c.capital) + m(c.mora), 0) * 100,
      ) / 100,
    [cuotasPendientes],
  );

  // Total a cobrar en modo rápido (mismo solver que Nuevo/Renovar).
  const totalCobrarRapido = useMemo(() => {
    const duracionVal = parseInt(nuevasCuotas, 10);
    if (!(duracionVal > 0)) return null;
    if (modoCalculo === 'PAGO') {
      const pagoVal = parseFloat(pagoPorPeriodo);
      if (!(pagoVal > 0)) return null;
      return Math.round(pagoVal * duracionVal * 100) / 100;
    }
    const gananciaVal = parseFloat(gananciaDeseada);
    if (!(gananciaVal >= 0)) return null;
    return Math.round((saldoRefinanciado + gananciaVal) * 100) / 100;
  }, [modoCalculo, nuevasCuotas, pagoPorPeriodo, gananciaDeseada, saldoRefinanciado]);

  // Preview vivo con la misma matemática que validará el backend.
  const preview = useMemo((): PreviewRefinanciamiento | null => {
    if (!visible) return null;

    if (modoRapido) {
      const duracionNum = parseInt(nuevasCuotas, 10);
      const totalCobrar = totalCobrarRapido;
      if (!(duracionNum > 0) || totalCobrar == null || !(totalCobrar > 0)) {
        return null;
      }
      if (totalCobrar <= saldoRefinanciado) {
        return {
          cuota: 0,
          montoTotal: totalCobrar,
          saldoRefinanciado,
          modoRapido: true,
          error: 'El total a cobrar debe ser mayor al saldo refinanciado.',
        };
      }
      const tabla = calcularAmortizacionRapidaLocal(
        saldoRefinanciado,
        duracionNum,
        totalCobrar,
        frecuenciaEfectiva,
        fechaPago ? new Date(fechaPago).toISOString() : undefined,
      );
      return {
        cuota: tabla.cuotaInicial,
        montoTotal: totalCobrar,
        saldoRefinanciado,
        modoRapido: true,
        error: null,
      };
    }

    const cuotasNum = parseInt(nuevasCuotas, 10);
    const tasaNum = parseFloat(nuevaTasa);
    if (!(cuotasNum > 0) || !(tasaNum > 0)) return null;
    try {
      const r = construirPrestamoRefinanciadoLocal(
        prestamo,
        {
          nuevasCuotas: cuotasNum,
          nuevaTasa: tasaNum,
          ...(frecuencia ? { nuevaFrecuencia: frecuencia } : {}),
          ...(fechaPago ? { nuevaFechaPago: fechaPago } : {}),
        },
        new Date(),
      );
      return {
        cuota: r.prestamo.cuotaMensual,
        montoTotal: r.prestamo.montoTotal,
        saldoRefinanciado: r.saldoRefinanciado,
        modoRapido: false,
        error: null,
      };
    } catch {
      return null;
    }
  }, [
    visible,
    modoRapido,
    nuevasCuotas,
    nuevaTasa,
    totalCobrarRapido,
    saldoRefinanciado,
    frecuencia,
    frecuenciaEfectiva,
    fechaPago,
    prestamo,
  ]);

  const inputsValidos = modoRapido
    ? !!parseInt(nuevasCuotas, 10) &&
      parseInt(nuevasCuotas, 10) > 0 &&
      parseInt(nuevasCuotas, 10) <= 3650 &&
      !!totalCobrarRapido &&
      (totalCobrarRapido ?? 0) > saldoRefinanciado
    : !!parseInt(nuevasCuotas, 10) &&
      parseInt(nuevasCuotas, 10) > 0 &&
      parseInt(nuevasCuotas, 10) <= 3650 &&
      !!parseFloat(nuevaTasa) &&
      parseFloat(nuevaTasa) >= 0.1 &&
      parseFloat(nuevaTasa) <= 100;

  // Motivos visibles por los que Refinanciar está deshabilitado (los errores
  // de negocio como total<=saldo ya tienen su propio aviso).
  const razonesValidacion = useMemo(() => {
    const razones: string[] = [];
    const dVal = parseInt(nuevasCuotas, 10);
    if (!(dVal > 0)) {
      razones.push(modoRapido ? 'Ingresa la duración del nuevo plan.' : 'Ingresa el número de cuotas.');
      return razones;
    }
    if (dVal > 3650) {
      razones.push('El máximo es 3650 períodos.');
    }
    if (modoRapido) {
      if (modoCalculo === 'PAGO') {
        if (!(parseFloat(pagoPorPeriodo) > 0))
          razones.push('Ingresa el pago por período.');
      } else if (!(parseFloat(gananciaDeseada) >= 0)) {
        razones.push('Ingresa la ganancia deseada.');
      }
    } else {
      const tVal = parseFloat(nuevaTasa);
      if (!(tVal >= 0.1)) {
        razones.push('La tasa debe ser al menos 0.1%.');
      } else if (tVal > 100) {
        razones.push('La tasa máxima es 100%.');
      }
    }
    return razones;
  }, [modoRapido, modoCalculo, nuevasCuotas, nuevaTasa, pagoPorPeriodo, gananciaDeseada]);

  const formularioTocado =
    nuevasCuotas !== '' ||
    nuevaTasa !== '' ||
    pagoPorPeriodo !== '' ||
    gananciaDeseada !== '';

  const handleRefinanciar = useCallback(async () => {
    const cuotasNum = parseInt(nuevasCuotas, 10);
    if (!cuotasNum || cuotasNum <= 0) {
      showToast('Ingresa valores válidos', 'error');
      return;
    }
    try {
      await refinanciarMutation.mutateAsync({
        id: prestamo.id,
        data: modoRapido
          ? {
              nuevasCuotas: cuotasNum,
              modoRapido: true,
              montoTotal: totalCobrarRapido!,
              ...(frecuencia ? { nuevaFrecuencia: frecuencia } : {}),
              ...(fechaPago ? { nuevaFechaPago: fechaPago } : {}),
              ...(motivo.trim() ? { motivo: motivo.trim() } : {}),
            }
          : {
              nuevasCuotas: cuotasNum,
              nuevaTasa: parseFloat(nuevaTasa),
              ...(frecuencia ? { nuevaFrecuencia: frecuencia } : {}),
              ...(fechaPago ? { nuevaFechaPago: fechaPago } : {}),
              ...(motivo.trim() ? { motivo: motivo.trim() } : {}),
            },
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showToast('Préstamo refinanciado exitosamente', 'success');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      showToast(err?.message || 'Error al refinanciar', 'error');
    }
  }, [
    modoRapido,
    nuevasCuotas,
    nuevaTasa,
    totalCobrarRapido,
    frecuencia,
    fechaPago,
    motivo,
    prestamo.id,
    refinanciarMutation,
    onSuccess,
    onClose,
    showToast,
  ]);

  const cambiarModoRapido = useCallback((rapido: boolean) => {
    Haptics.selectionAsync().catch(() => {});
    setModoRapido(rapido);
  }, []);

  const cambiarModoCalculo = useCallback((modo: 'PAGO' | 'GANANCIA') => {
    Haptics.selectionAsync().catch(() => {});
    setModoCalculo(modo);
  }, []);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.overlay, { backgroundColor: colors.overlay }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
          <View style={[styles.headerBar, { backgroundColor: colors.primary }]}>
            <Ionicons name="refresh" size={scale(22)} color="#FFFFFF" />
            <Text style={[styles.title, { color: '#FFFFFF' }]} accessibilityRole="header">
              Refinanciar Préstamo
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
              accessibilityHint="Cierra el modal sin refinanciar"
              style={styles.closeButton}
            >
              <Ionicons name="close" size={scale(22)} color="#FFFFFF" />
            </Pressable>
          </View>
          <ScrollView
            style={styles.body}
            keyboardShouldPersistTaps="handled"
            bounces={false}
            contentContainerStyle={{
              paddingBottom: Spacing.sm + Math.max(insets.bottom, scale(12)),
            }}
          >
              <View style={[styles.contextBox, { backgroundColor: colors.surface }]}>
                <Text style={[styles.contextText, { color: colors.textSecondary }]}>
                  Saldo a refinanciar: <Text style={{ color: colors.text, fontWeight: FontWeight.bold }}>{formatCurrency(saldoRefinanciado)}</Text>
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

              {/* Selector de modo: Rápido por defecto */}
              <View style={[styles.modeToggle, { backgroundColor: colors.surface }]}>
                <Pressable
                  onPress={() => cambiarModoRapido(false)}
                  style={[styles.modeBtn, !modoRapido && { backgroundColor: colors.primary }]}
                  accessibilityRole="button"
                  accessibilityLabel="Modo de cálculo normal"
                  accessibilityState={{ selected: !modoRapido }}
                >
                  <Text style={[styles.modeBtnText, { color: !modoRapido ? '#FFFFFF' : colors.textSecondary }]}>
                    Normal
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => cambiarModoRapido(true)}
                  style={[styles.modeBtn, modoRapido && { backgroundColor: colors.primary }]}
                  accessibilityRole="button"
                  accessibilityLabel="Modo de cálculo rápido"
                  accessibilityState={{ selected: modoRapido }}
                >
                  <Text style={[styles.modeBtnText, { color: modoRapido ? '#FFFFFF' : colors.textSecondary }]}>
                    Rápido
                  </Text>
                </Pressable>
              </View>
              <Text style={[styles.modeHint, { color: colors.textTertiary }]}>
                {modoRapido
                  ? 'Defines el pago o la ganancia sobre el saldo; la tasa se calcula sola.'
                  : 'Defines la tasa de interés y el número de cuotas.'}
              </Text>

              {modoRapido ? (
                <>
                  <View style={styles.subToggle}>
                    <Pressable
                      onPress={() => cambiarModoCalculo('PAGO')}
                      style={[
                        styles.subBtn,
                        { borderColor: colors.border },
                        modoCalculo === 'PAGO' && { backgroundColor: colors.primary },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Calcular desde pago por período"
                      accessibilityState={{ selected: modoCalculo === 'PAGO' }}
                    >
                      <Text
                        style={[
                          styles.subBtnText,
                          { color: modoCalculo === 'PAGO' ? '#FFFFFF' : colors.textSecondary },
                        ]}
                      >
                        Pago por período
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => cambiarModoCalculo('GANANCIA')}
                      style={[
                        styles.subBtn,
                        { borderColor: colors.border },
                        modoCalculo === 'GANANCIA' && { backgroundColor: colors.primary },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Calcular desde ganancia deseada"
                      accessibilityState={{ selected: modoCalculo === 'GANANCIA' }}
                    >
                      <Text
                        style={[
                          styles.subBtnText,
                          { color: modoCalculo === 'GANANCIA' ? '#FFFFFF' : colors.textSecondary },
                        ]}
                      >
                        Ganancia deseada
                      </Text>
                    </Pressable>
                  </View>

                  {modoCalculo === 'PAGO' ? (
                    <AppInput
                      label={`Pago ${DURACION_LABEL[frecuenciaEfectiva]}`}
                      placeholder="Ej: 500"
                      keyboardType="decimal-pad"
                      value={pagoPorPeriodo}
                      onChangeText={(v) => setPagoPorPeriodo(sanitizeDecimal(v))}
                    />
                  ) : (
                    <>
                      <AppInput
                        label="Ganancia deseada"
                        placeholder="Ej: 2000"
                        keyboardType="decimal-pad"
                        value={gananciaDeseada}
                        onChangeText={(v) => setGananciaDeseada(sanitizeDecimal(v))}
                        hint={`Se suma al saldo refinanciado (${formatCurrency(saldoRefinanciado)})`}
                      />
                      {preview && !preview.error && (
                        <View
                          style={[
                            styles.calcDisplay,
                            { backgroundColor: colors.infoLight, borderColor: colors.info },
                          ]}
                        >
                          <Text style={[styles.calcLabel, { color: colors.info }]}>Pago calculado</Text>
                          <Text style={[styles.calcValue, { color: colors.info }]}>
                            {formatCurrency(preview.cuota)}
                          </Text>
                        </View>
                      )}
                    </>
                  )}
                  <AppInput
                    label={`Duración (${DURACION_LABEL[frecuenciaEfectiva]})`}
                    placeholder="Ej: 12"
                    keyboardType="numeric"
                    value={nuevasCuotas}
                    onChangeText={(v) => setNuevasCuotas(sanitizeInteger(v))}
                    hint={`Máximo 3650 períodos · Total: ${totalCobrarRapido ? formatCurrency(totalCobrarRapido) : '—'}`}
                  />
                </>
              ) : (
                <>
                  <AppInput
                    label="Nueva tasa de interés (%)"
                    placeholder="Ej: 3.5"
                    keyboardType="decimal-pad"
                    value={nuevaTasa}
                    onChangeText={(v) => setNuevaTasa(sanitizeDecimal(v))}
                    hint="Entre 0.1 y 100"
                  />
                  <AppInput
                    label="Nuevo número de cuotas"
                    placeholder="Ej: 12"
                    keyboardType="numeric"
                    value={nuevasCuotas}
                    onChangeText={(v) => setNuevasCuotas(sanitizeInteger(v))}
                    hint="Máximo 3650 cuotas"
                  />
                </>
              )}
              <PickerField
                label="Nueva frecuencia de pago (opcional)"
                value={frecuencia}
                options={FRECUENCIAS}
                onSelect={(v) => setFrecuencia(v as FrecuenciaPago)}
                hint={`Actual: ${FREQ_LABEL[prestamo.frecuenciaPago] ?? prestamo.frecuenciaPago}`}
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

              {preview && !preview.error && (
                <View style={[styles.previewBox, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.previewTitle, { color: colors.textSecondary }]}>Resumen del nuevo plan</Text>
                  <Text style={[styles.previewText, { color: colors.text }]}>
                    Cuota: <Text style={{ fontWeight: FontWeight.bold }}>{formatCurrency(preview.cuota)}</Text>
                    {'  ·  '}Total: <Text style={{ fontWeight: FontWeight.bold }}>{formatCurrency(preview.montoTotal)}</Text>
                  </Text>
                  <Text style={[styles.previewText, { color: colors.textSecondary }]}>
                    Saldo refinanciado: {formatCurrency(preview.saldoRefinanciado)}
                    {preview.modoRapido ? ' · Modo rápido (tasa automática)' : ''}
                  </Text>
                </View>
              )}
              {preview?.error && (
                <View style={[styles.bloqueoBox, { backgroundColor: colors.error + '18' }]}>
                  <Ionicons name="warning" size={scale(14)} color={colors.error} />
                  <Text style={[styles.bloqueoText, { color: colors.error }]}>{preview.error}</Text>
                </View>
              )}

              {formularioTocado &&
                razonesValidacion.length > 0 &&
                !bloqueoRegla && (
                  <View style={[styles.bloqueoBox, { backgroundColor: colors.infoLight }]}>
                    <Ionicons name="information-circle" size={scale(14)} color={colors.info} />
                    <View style={styles.bloqueoMultiText}>
                      {razonesValidacion.map((razon) => (
                        <Text key={razon} style={[styles.bloqueoText, { color: colors.info }]}>
                          • {razon}
                        </Text>
                      ))}
                    </View>
                  </View>
                )}

              <View style={styles.actions}>
                <AppButton title="Cancelar" onPress={onClose} variant="ghost" style={{ flex: 1 }} />
                <AppButton
                  title="Refinanciar"
                  onPress={handleRefinanciar}
                  loading={refinanciarMutation.isPending}
                  disabled={!inputsValidos || !!bloqueoRegla || !!preview?.error}
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
    maxHeight: '90%',
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  title: { fontSize: FontSize.md, fontWeight: FontWeight.bold, flex: 1 },
  closeButton: {
    marginLeft: 'auto',
  },
  body: { padding: Spacing.md },
  modeToggle: {
    flexDirection: 'row',
    borderRadius: BorderRadius.md,
    padding: scale(2),
    marginBottom: Spacing.xs,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
  modeBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  modeHint: {
    fontSize: FontSize.xs,
    marginBottom: Spacing.sm,
    marginTop: scale(2),
  },
  subToggle: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  subBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    alignItems: 'center',
  },
  subBtnText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  calcDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  calcLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  calcValue: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
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
  bloqueoMultiText: {
    flex: 1,
    gap: scale(2),
  },
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
