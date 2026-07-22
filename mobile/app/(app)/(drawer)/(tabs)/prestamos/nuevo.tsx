import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScreenContainer } from '@/components/ui/screen-container';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useCrearPrestamo } from '@/hooks/use-prestamos';
import { useClienteSearch, useGaranteSearch } from '@/hooks/use-entity-search';
import { usePrestamoPreview } from '@/hooks/use-prestamo-preview';
import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import DatePickerField from '@/components/ui/date-picker-field';
import SearchableSelect from '@/components/ui/searchable-select';
import { useToast } from '@/components/ui/toast';
import { FontSize, FontWeight, Spacing, BorderRadius, scale} from '@/constants/theme';
import { formatCurrency, formatDate } from '@/utils/formatters';
import type { FrecuenciaPago } from '@/types/prestamo.types';
import type { ApiError } from '@/types/api.types';
import { useTheme } from '@/components/ui/theme-provider';

const FRECUENCIA_OPTIONS: { label: string; value: FrecuenciaPago }[] = [
  { label: 'Diario', value: 'DIARIO' },
  { label: 'Semanal', value: 'SEMANAL' },
  { label: 'Quincenal', value: 'QUINCENAL' },
  { label: 'Mensual', value: 'MENSUAL' },
];

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

export default function NuevoPrestamoScreen() {
  const { colors } = useTheme();
  const { mutateAsync: crearPrestamo, isPending: isCreando } = useCrearPrestamo();
  const { showToast } = useToast();

  const [modoRapido, setModoRapido] = useState(true);
  const [modoCalculo, setModoCalculo] = useState<'PAGO' | 'GANANCIA'>('PAGO');

  // Entity search
  const clienteSearch = useClienteSearch();
  const garanteSearch = useGaranteSearch(clienteSearch.entity?.id ?? null);

  // Form fields
  const [monto, setMonto] = useState('');
  const [tasaInteres, setTasaInteres] = useState('');
  const [numeroCuotas, setNumeroCuotas] = useState('');
  const [frecuenciaPago, setFrecuenciaPago] = useState<FrecuenciaPago>('SEMANAL');
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().split('T')[0]);

  // Modo rápido fields
  const [pagoPorPeriodo, setPagoPorPeriodo] = useState('');
  const [gananciaDeseada, setGananciaDeseada] = useState('');
  const [duracion, setDuracion] = useState('');

  // Preview
  const [showTabla, setShowTabla] = useState(false);

  // Preview calculation via hook
  const { preview, warnings, isCalculando } = usePrestamoPreview({
    modoRapido,
    modoCalculo,
    monto,
    tasaInteres,
    numeroCuotas,
    frecuenciaPago,
    fechaInicio,
    pagoPorPeriodo,
    gananciaDeseada,
    duracion,
  });

  // Errors (client-side only)
  const [errors, setErrors] = useState<Record<string, string>>({});

  const seleccionarCliente = useCallback(
    (c: import('@/types/cliente.types').Cliente) => {
      const ok = clienteSearch.seleccionar(c);
      if (ok) setErrors((p) => { const n = { ...p }; delete n.cliente; return n; });
      garanteSearch.limpiar();
    },
    [clienteSearch, garanteSearch],
  );

  const limpiarCliente = useCallback(() => {
    clienteSearch.limpiar();
    garanteSearch.limpiar();
  }, [clienteSearch, garanteSearch]);

  const seleccionarGarante = useCallback(
    (c: import('@/types/cliente.types').Cliente) => {
      const ok = garanteSearch.seleccionar(c);
      if (ok) setErrors((p) => { const n = { ...p }; delete n.garante; return n; });
    },
    [garanteSearch],
  );

  // Validate
  const validate = useCallback(() => {
    const e: Record<string, string> = {};
    const montoNum = parseFloat(monto);
    if (!clienteSearch.entity) e.cliente = 'Selecciona un cliente';
    if (!monto || montoNum <= 0) e.monto = 'Ingresa un monto válido';
    if (!modoRapido && (!tasaInteres || parseFloat(tasaInteres) <= 0)) e.tasaInteres = 'Ingresa una tasa válida';
    if (!modoRapido && (!numeroCuotas || parseInt(numeroCuotas) < 1)) e.numeroCuotas = 'Ingresa un número de cuotas válido';
    if (modoRapido && (!duracion || parseInt(duracion, 10) < 1)) e.duracion = 'Ingresa una duración válida';
    if (!frecuenciaPago) e.frecuenciaPago = 'Selecciona la frecuencia';
    if (!fechaInicio) e.fechaInicio = 'Selecciona la fecha de inicio';
    return e;
  }, [clienteSearch.entity, monto, tasaInteres, numeroCuotas, frecuenciaPago, fechaInicio, modoRapido, duracion]);

  const handleSubmit = useCallback(async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    if (modoRapido && (!preview || !preview.montoTotal)) {
      setErrors({ submit: 'El resumen no está disponible. Verifica los datos.' });
      return;
    }

    try {
      const payload: any = {
        clienteId: clienteSearch.entity!.id,
        monto: parseFloat(monto),
        tasaInteres: parseFloat(modoRapido ? '0' : tasaInteres),
        numeroCuotas: parseInt(modoRapido ? duracion : numeroCuotas, 10),
        frecuenciaPago,
        fechaInicio,
        garanteId: garanteSearch.entity?.id || undefined,
      };
      if (modoRapido) {
        payload.modoRapido = true;
        payload.montoTotal = preview?.montoTotal;
      }
      const result = await crearPrestamo(payload);
      showToast('Préstamo creado exitosamente', 'success');
      setTimeout(() => router.replace(`/prestamos/${result.id}`), 500);
    } catch (error) {
      const { message } = error as ApiError;
      showToast(message || 'No se pudo crear el préstamo', 'error');
    }
  }, [validate, modoRapido, preview, crearPrestamo, clienteSearch.entity, garanteSearch.entity, monto, tasaInteres, numeroCuotas, frecuenciaPago, fechaInicio, showToast]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScreenContainer style={{ flex: 1 }}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={scale(24)} color={colors.text} />
          </Pressable>
          <View style={styles.headerInfo}>
            <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">Nuevo Préstamo</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Complete los datos del préstamo</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Mode selector */}
          <View style={styles.section}>
            <View style={[styles.modeToggle, { backgroundColor: colors.surface }]}>
              <Pressable
                onPress={() => setModoRapido(false)}
                style={[styles.modeBtn, !modoRapido && { backgroundColor: colors.primary }]}
                accessibilityRole="button"
                accessibilityState={{ selected: !modoRapido }}
                accessibilityLabel="Modo normal"
              >
                <Text style={[styles.modeBtnText, { color: !modoRapido ? '#FFFFFF' : colors.textSecondary }]}>Normal</Text>
              </Pressable>
              <Pressable
                onPress={() => setModoRapido(true)}
                style={[styles.modeBtn, modoRapido && { backgroundColor: colors.primary }]}
                accessibilityRole="button"
                accessibilityState={{ selected: modoRapido }}
                accessibilityLabel="Modo rápido"
              >
                <Text style={[styles.modeBtnText, { color: modoRapido ? '#FFFFFF' : colors.textSecondary }]}>Rápido</Text>
              </Pressable>
            </View>
            <Text style={[styles.modeHint, { color: colors.textTertiary }]}>
              {modoRapido
                ? 'Cuotas fijas para cobro informal. Define un pago o ganancia deseada.'
                : 'Amortización tradicional con interés sobre saldo.'}
            </Text>
          </View>

          <SearchableSelect
            label="Cliente"
            placeholder="Buscar por nombre o cédula..."
            value={clienteSearch.entity}
            searchText={clienteSearch.searchText}
            onSearchChange={clienteSearch.setSearchText}
            sugerencias={clienteSearch.sugerencias}
            showSugerencias={clienteSearch.showSugerencias}
            onSelect={seleccionarCliente}
            onClear={limpiarCliente}
            error={errors.cliente}
            buscando={clienteSearch.buscando}
            onFocus={() => clienteSearch.sugerencias.length > 0 && clienteSearch.setShowSugerencias(true)}
          />

          <SearchableSelect
            label="Garante (opcional)"
            placeholder="Buscar garante..."
            value={garanteSearch.entity}
            searchText={garanteSearch.searchText}
            onSearchChange={garanteSearch.setSearchText}
            sugerencias={garanteSearch.sugerencias}
            showSugerencias={garanteSearch.showSugerencias}
            onSelect={seleccionarGarante}
            onClear={() => { garanteSearch.limpiar(); setErrors(p => { const n = { ...p }; delete n.garante; return n; }); }}
            error={errors.garante ?? garanteSearch.error ?? undefined}
            buscando={garanteSearch.buscando}
            disabled={!clienteSearch.entity}
            disabledText="Selecciona un cliente primero"
            accentColor={colors.success}
            accentLight={colors.successLight}
            onFocus={() => garanteSearch.sugerencias.length > 0 && garanteSearch.setShowSugerencias(true)}
          />

          {/* Conditions */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Condiciones del Préstamo</Text>

            {/* Monto */}
            <AppInput
              label="Monto a prestar"
              placeholder="0.00"
              prefix="RD$"
              keyboardType="decimal-pad"
              value={monto}
              onChangeText={setMonto}
              error={errors.monto}
            />

            {/* Modo rápido fields */}
            {modoRapido && (
              <>
                <View style={styles.subToggle}>
                  <Pressable
                    onPress={() => setModoCalculo('PAGO')}
                    style={[styles.subBtn, { borderColor: colors.border }, modoCalculo === 'PAGO' && { backgroundColor: colors.primary }]}
                  >
                    <Text style={[styles.subBtnText, { color: modoCalculo === 'PAGO' ? '#FFFFFF' : colors.textSecondary }]}>
                      Pago por período
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setModoCalculo('GANANCIA')}
                    style={[styles.subBtn, { borderColor: colors.border }, modoCalculo === 'GANANCIA' && { backgroundColor: colors.primary }]}
                  >
                    <Text style={[styles.subBtnText, { color: modoCalculo === 'GANANCIA' ? '#FFFFFF' : colors.textSecondary }]}>
                      Ganancia deseada
                    </Text>
                  </Pressable>
                </View>

                {modoCalculo === 'PAGO' ? (
                  <AppInput
                    label={`Pago ${FREQ_LABEL[frecuenciaPago]}`}
                    placeholder="0.00"
                    prefix="RD$"
                    keyboardType="decimal-pad"
                    value={pagoPorPeriodo}
                    onChangeText={setPagoPorPeriodo}
                  />
                ) : (
                  <>
                    <AppInput
                      label="Ganancia deseada"
                      placeholder="0.00"
                      prefix="RD$"
                      keyboardType="decimal-pad"
                      value={gananciaDeseada}
                      onChangeText={setGananciaDeseada}
                    />
                    {warnings.gananciaInvalida && (
                      <Text style={[styles.warningText, { color: colors.warning }]}>{warnings.gananciaInvalida}</Text>
                    )}
                    {(() => {
                      const mVal = parseFloat(monto);
                      const gVal = parseFloat(gananciaDeseada);
                      const dVal = parseInt(duracion, 10);
                      if (mVal > 0 && gVal >= 0 && dVal > 0) {
                        return (
                          <View style={[styles.calcDisplay, { backgroundColor: colors.infoLight, borderColor: colors.info }]}>
                            <Text style={[styles.calcLabel, { color: colors.info }]}>Pago calculado</Text>
                            <Text style={[styles.calcValue, { color: colors.info }]}>
                              {formatCurrency((mVal + gVal) / dVal)}
                            </Text>
                          </View>
                        );
                      }
                      return null;
                    })()}
                  </>
                )}

                {/* Duración */}
                <View>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                    {DURACION_LABEL[frecuenciaPago]?.charAt(0).toUpperCase() + DURACION_LABEL[frecuenciaPago]?.slice(1)}
                  </Text>
                  <View style={[styles.dualInput, { borderColor: colors.border }]}>
                    <TextInput
                      value={duracion}
                      onChangeText={setDuracion}
                      placeholder="12"
                      keyboardType="numeric"
                      placeholderTextColor={colors.textTertiary}
                      style={[styles.dualInputText, { color: colors.text, backgroundColor: colors.surfaceElevated }]}
                    />
                    <View style={[styles.dualInputSuffix, { backgroundColor: colors.borderLight }]}>
                      <Text style={{ color: colors.textTertiary, fontSize: FontSize.sm }}>
                        {DURACION_LABEL[frecuenciaPago]}
                      </Text>
                    </View>
                  </View>
                  {warnings.pagoBajo && (
                    <Text style={[styles.warningText, { color: colors.warning }]}>{warnings.pagoBajo}</Text>
                  )}
                </View>
              </>
            )}

            {/* Tasa (normal only) */}
            {!modoRapido && (
              <AppInput
                label="Tasa de interés (%)"
                placeholder="0.00"
                keyboardType="decimal-pad"
                value={tasaInteres}
                onChangeText={setTasaInteres}
                error={errors.tasaInteres}
              />
            )}

            {modoRapido && tasaInteres && (
              <View style={[styles.calcDisplay, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
                <Text style={[styles.calcLabel, { color: colors.primary }]}>Tasa equivalente</Text>
                <Text style={[styles.calcValue, { color: colors.primary }]}>{tasaInteres}%</Text>
              </View>
            )}

            {/* Cuotas */}
            {!modoRapido && (
              <AppInput
                label="Número de cuotas"
                placeholder="12"
                keyboardType="numeric"
                value={numeroCuotas}
                onChangeText={setNumeroCuotas}
                error={errors.numeroCuotas}
              />
            )}

            {/* Frecuencia */}
            <View>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Frecuencia de pago</Text>
              <View style={styles.freqGrid}>
                {FRECUENCIA_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    onPress={() => { setFrecuenciaPago(opt.value); setErrors(p => { const n = { ...p }; delete n.frecuenciaPago; return n; }); }}
                    style={[
                      styles.freqBtn,
                      {
                        borderColor: frecuenciaPago === opt.value ? colors.primary : colors.border,
                        backgroundColor: frecuenciaPago === opt.value ? colors.primary : colors.surface,
                      },
                    ]}
                  >
                    <Text style={[
                      styles.freqBtnText,
                      { color: frecuenciaPago === opt.value ? '#FFFFFF' : colors.textSecondary },
                    ]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {errors.frecuenciaPago && <Text style={[styles.errorText, { color: colors.error }]}>{errors.frecuenciaPago}</Text>}
            </View>

            {/* Fecha */}
            <DatePickerField
              label="Fecha de inicio"
              value={fechaInicio}
              onChange={setFechaInicio}
              error={errors.fechaInicio}
            />
          </View>

          {/* Preview */}
          {preview && (
            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.md }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Resumen</Text>
              <ResumenItem title="Monto prestado" value={formatCurrency(parseFloat(monto || '0'))} />
              {modoRapido && modoCalculo === 'GANANCIA' && (
                <ResumenItem title="Ganancia deseada" value={formatCurrency(parseFloat(gananciaDeseada || '0'))} />
              )}
              <ResumenItem title={modoRapido ? 'Ganancia total' : 'Total intereses'} value={formatCurrency(preview.totalIntereses)} />
              <ResumenItem title={modoRapido ? 'Total a cobrar' : 'Monto total a pagar'} value={formatCurrency(preview.montoTotal)} highlight />
              <ResumenItem title={modoRapido ? `Pago ${FREQ_LABEL[frecuenciaPago]}` : 'Cuota mensual'} value={formatCurrency(preview.cuotaInicial)} />
              <ResumenItem title="N° de cuotas" value={`${modoRapido ? duracion : numeroCuotas} cuotas`} />
              {modoRapido && duracion && (
                <ResumenItem title="Duración" value={`${duracion} ${DURACION_LABEL[frecuenciaPago]}`} />
              )}

              {/* Progress bar */}
              {preview.montoTotal > 0 && (
                <View style={{ marginTop: Spacing.sm }}>
                  <View style={[styles.progressBar, { backgroundColor: colors.borderLight }]}>
                    <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${(parseFloat(monto || '0') / preview.montoTotal) * 100}%` }]} />
                  </View>
                  <View style={styles.progressLabels}>
                    <Text style={[styles.progressLabelText, { color: colors.primary }]}>
                      Capital {((parseFloat(monto || '0') / preview.montoTotal) * 100).toFixed(1)}%
                    </Text>
                    <Text style={[styles.progressLabelText, { color: colors.warning }]}>
                      Ganancia {((preview.totalIntereses / preview.montoTotal) * 100).toFixed(1)}%
                    </Text>
                  </View>
                </View>
              )}

              {/* Amortization table toggle */}
              <Pressable
                onPress={() => setShowTabla(!showTabla)}
                style={[styles.tablaToggle, { borderTopColor: colors.border }]}
              >
                <Text style={[styles.tablaToggleText, { color: colors.primary }]}>
                  {showTabla ? 'Ocultar' : 'Ver'} tabla de amortización
                </Text>
                <Ionicons name={showTabla ? 'chevron-up' : 'chevron-down'} size={scale(16)} color={colors.primary} />
              </Pressable>

              {showTabla && preview.cuotas && (
                <View style={{ marginTop: Spacing.sm }}>
                  {preview.cuotas.map((c, i) => (
                    <View
                      key={c.numero}
                      style={[styles.cuotaRow, i < preview.cuotas.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}
                    >
                      <View style={styles.cuotaRowHeader}>
                        <Text style={[styles.cuotaNum, { color: colors.text }]}>#{c.numero}</Text>
                        <Text style={[styles.cuotaDate, { color: colors.textTertiary }]}>
                          {c.fechaVencimiento ? formatDate(c.fechaVencimiento) : '-'}
                        </Text>
                      </View>
                      <View style={styles.cuotaAmounts}>
                        <View style={styles.cuotaAmt}>
                          <Text style={[styles.cuotaAmtLabel, { color: colors.textTertiary }]}>Capital</Text>
                          <Text style={[styles.cuotaAmtVal, { color: colors.text }]}>{formatCurrency(c.capital)}</Text>
                        </View>
                        <View style={styles.cuotaAmt}>
                          <Text style={[styles.cuotaAmtLabel, { color: colors.textTertiary }]}>Interés</Text>
                          <Text style={[styles.cuotaAmtVal, { color: colors.warning }]}>{formatCurrency(c.interes)}</Text>
                        </View>
                        <View style={styles.cuotaAmt}>
                          <Text style={[styles.cuotaAmtLabel, { color: colors.textTertiary }]}>Total</Text>
                          <Text style={[styles.cuotaAmtVal, { color: colors.text, fontWeight: FontWeight.bold }]}>{formatCurrency(c.monto)}</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {warnings.tasaAlta && (
                <View style={[styles.warningBox, { backgroundColor: colors.warningLight, borderColor: colors.warning }]}>
                  <Text style={{ color: colors.warning, fontSize: FontSize.xs }}>{warnings.tasaAlta}</Text>
                </View>
              )}
            </View>
          )}

          {errors.submit && (
            <Text style={[styles.errorText, { color: colors.error, textAlign: 'center', marginBottom: Spacing.md }]}>
              {errors.submit}
            </Text>
          )}

          <AppButton
            title="Enviar Solicitud"
            loading={isCreando}
            onPress={handleSubmit}
            icon="checkmark-circle-outline"
            accessibilityRole="button"
            accessibilityLabel="Enviar solicitud de préstamo"
          />

          <View style={{ height: Spacing.xxl }} />
        </ScrollView>
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}

function ResumenItem({ title, value, highlight = false }: { title: string; value: string; highlight?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.resumenRow, { borderBottomColor: colors.borderLight }]}>
      <Text style={[styles.resumenLabel, { color: colors.textTertiary }]}>{title}</Text>
      <Text style={[styles.resumenValue, highlight && { color: colors.primary, fontSize: FontSize.lg }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  headerInfo: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  subtitle: {
    fontSize: FontSize.sm,
    marginTop: scale(2),
  },
  content: {
    padding: Spacing.md,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.sm,
  },
  modeToggle: {
    flexDirection: 'row',
    borderRadius: BorderRadius.md,
    padding: scale(2),
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
    marginTop: Spacing.xs,
  },
  fieldLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    marginBottom: Spacing.xs,
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
  dualInput: {
    flexDirection: 'row',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  dualInputText: {
    flex: 1,
    height: scale(48),
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.md,
  },
  dualInputSuffix: {
    paddingHorizontal: Spacing.md,
    justifyContent: 'center',
  },
  calcDisplay: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.sm + 2,
    marginBottom: Spacing.sm,
  },
  calcLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  calcValue: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    marginTop: scale(2),
  },
  freqGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  freqBtn: {
    flex: 1,
    paddingVertical: Spacing.sm + 4,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  freqBtnText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  resumenRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  resumenLabel: {
    fontSize: FontSize.sm,
  },
  resumenValue: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  progressBar: {
    height: scale(8),
    borderRadius: 4,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  progressLabelText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  tablaToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    marginTop: Spacing.sm,
    borderTopWidth: 1,
  },
  tablaToggleText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  cuotaRow: {
    paddingVertical: Spacing.sm,
  },
  cuotaRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  cuotaNum: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  cuotaDate: {
    fontSize: FontSize.xs,
  },
  cuotaAmounts: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  cuotaAmt: {
    flex: 1,
    alignItems: 'center',
  },
  cuotaAmtLabel: {
    fontSize: FontSize.xs,
  },
  cuotaAmtVal: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    marginTop: scale(1),
  },
  errorText: {
    fontSize: FontSize.xs,
    marginTop: Spacing.xs,
  },
  warningText: {
    fontSize: FontSize.xs,
    marginBottom: Spacing.sm,
  },
  warningBox: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
  },
});
