import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScreenContainer } from '@/components/ui/screen-container';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useCrearPrestamo, useCalcularTabla } from '@/hooks/use-prestamos';
import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import DatePickerField from '@/components/ui/date-picker-field';
import PickerField from '@/components/ui/picker-field';
import SearchableSelect from '@/components/ui/searchable-select';
import { useToast } from '@/components/ui/toast';
import { useAuthStore } from '@/store/auth.store';
import { FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { listar } from '@/api/clientes.api';
import type { Cliente } from '@/types/cliente.types';
import type { FrecuenciaPago, TablaAmortizacion } from '@/types/prestamo.types';
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
  const { colorScheme, colors } = useTheme();
  const { mutateAsync: crearPrestamo, isPending: isCreando } = useCrearPrestamo();
  const { mutateAsync: calcularMutation, isPending: isCalculando } = useCalcularTabla();
  const { showToast } = useToast();

  const [modoRapido, setModoRapido] = useState(true);
  const [modoCalculo, setModoCalculo] = useState<'PAGO' | 'GANANCIA'>('PAGO');

  // Cliente
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [searchText, setSearchText] = useState('');
  const [sugerencias, setSugerencias] = useState<Cliente[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [showSugerencias, setShowSugerencias] = useState(false);

  // Garante
  const [garante, setGarante] = useState<Cliente | null>(null);
  const [searchTextGarante, setSearchTextGarante] = useState('');
  const [sugerenciasGarante, setSugerenciasGarante] = useState<Cliente[]>([]);
  const [buscandoGarante, setBuscandoGarante] = useState(false);
  const [showSugerenciasGarante, setShowSugerenciasGarante] = useState(false);

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
  const [preview, setPreview] = useState<TablaAmortizacion | null>(null);
  const [showTabla, setShowTabla] = useState(false);

  // Errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [warnings, setWarnings] = useState<Record<string, string>>({});
  const solverRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cliente search
  useEffect(() => {
    if (searchText.length < 2) { setSugerencias([]); return; }
    const timer = setTimeout(async () => {
      setBuscando(true);
      try {
        const res = await listar({ page: 1, limit: 6, search: searchText });
        setSugerencias(res.data.slice(0, 6));
        setShowSugerencias(true);
      } catch { setSugerencias([]); }
      finally { setBuscando(false); }
    }, 350);
    return () => clearTimeout(timer);
  }, [searchText]);

  // Garante search
  useEffect(() => {
    if (searchTextGarante.length < 2 || !cliente) { setSugerenciasGarante([]); return; }
    const timer = setTimeout(async () => {
      setBuscandoGarante(true);
      try {
        const res = await listar({ page: 1, limit: 6, search: searchTextGarante });
        const filtrados = res.data.filter(c => c.id !== cliente.id);
        setSugerenciasGarante(filtrados.slice(0, 5));
        setShowSugerenciasGarante(true);
      } catch { setSugerenciasGarante([]); }
      finally { setBuscandoGarante(false); }
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTextGarante, cliente]);

  // Preview calculation
  useEffect(() => {
    if (modoRapido) {
      const montoVal = parseFloat(monto);
      const duracionVal = parseInt(duracion, 10);
      if (montoVal > 0 && duracionVal > 0) {
        if (modoCalculo === 'PAGO') {
          const pagoVal = parseFloat(pagoPorPeriodo);
          if (pagoVal > 0) {
            const totalCobrar = pagoVal * duracionVal;
            calcularMutation({
              monto: montoVal,
              tasaInteres: 0,
              numeroCuotas: duracionVal,
              frecuenciaPago,
              fechaInicio,
            }).then((res) => {
              setPreview({
                ...res,
                montoTotal: totalCobrar,
                totalIntereses: totalCobrar - montoVal,
                cuotaInicial: Math.round(pagoVal),
              });
            }).catch(() => setPreview(null));
          } else { setPreview(null); }
        } else {
          const gananciaVal = parseFloat(gananciaDeseada);
          if (gananciaVal >= 0) {
            const totalCobrar = montoVal + gananciaVal;
            if (totalCobrar > montoVal) {
              const cuotaIdeal = totalCobrar / duracionVal;
              calcularMutation({
                monto: montoVal,
                tasaInteres: 0,
                numeroCuotas: duracionVal,
                frecuenciaPago,
                fechaInicio,
              }).then((res) => {
                setPreview({
                  ...res,
                  montoTotal: totalCobrar,
                  totalIntereses: gananciaVal,
                  cuotaInicial: Math.round(cuotaIdeal),
                });
              }).catch(() => setPreview(null));
            } else { setPreview(null); }
          } else { setPreview(null); }
        }
      } else { setPreview(null); }
    } else {
      const montoVal = parseFloat(monto);
      const tasaVal = parseFloat(tasaInteres);
      const cuotasVal = parseInt(numeroCuotas);
      if (montoVal > 0 && tasaVal > 0 && cuotasVal > 0) {
        calcularMutation({
          monto: montoVal,
          tasaInteres: tasaVal,
          numeroCuotas: cuotasVal,
          frecuenciaPago,
          fechaInicio,
        }).then(setPreview).catch(() => setPreview(null));
      } else { setPreview(null); }
    }
  }, [modoRapido, modoCalculo, monto, tasaInteres, numeroCuotas, frecuenciaPago, fechaInicio, pagoPorPeriodo, gananciaDeseada, duracion, calcularMutation]);

  // Auto-derive tasa in modo rapido
  useEffect(() => {
    if (!modoRapido) { setWarnings({}); return; }
    if (solverRef.current) clearTimeout(solverRef.current);

    const montoVal = parseFloat(monto);
    const duracionVal = parseInt(duracion, 10);

    let pagoVal: number;
    if (modoCalculo === 'GANANCIA') {
      const gananciaVal = parseFloat(gananciaDeseada);
      if (montoVal > 0 && gananciaVal >= 0 && duracionVal > 0) {
        const totalCobrar = montoVal + gananciaVal;
        if (totalCobrar <= montoVal) {
          setWarnings(p => ({ ...p, gananciaInvalida: 'El total a cobrar debe ser mayor al monto prestado.' }));
          return;
        }
        setWarnings(p => { const n = { ...p }; delete n.gananciaInvalida; return n; });
        pagoVal = totalCobrar / duracionVal;
      } else { return; }
    } else {
      pagoVal = parseFloat(pagoPorPeriodo);
    }

    if (montoVal > 0 && pagoVal > 0 && duracionVal > 0) {
      solverRef.current = setTimeout(() => {
        const pagoMinimo = montoVal / duracionVal;
        if (pagoVal < pagoMinimo) {
          setWarnings(p => ({ ...p, pagoBajo: `El pago mínimo es ${formatCurrency(pagoMinimo)} por período` }));
          return;
        }
        setWarnings(p => { const n = { ...p }; delete n.pagoBajo; return n; });
        setNumeroCuotas(String(duracionVal));
      }, 300);
    }

    return () => { if (solverRef.current) clearTimeout(solverRef.current); };
  }, [modoRapido, modoCalculo, monto, pagoPorPeriodo, gananciaDeseada, duracion, frecuenciaPago]);

  // Select cliente
  const seleccionarCliente = useCallback((c: Cliente) => {
    setCliente(c);
    setSearchText(`${c.nombre} ${c.apellido || ''}`);
    setSugerencias([]);
    setShowSugerencias(false);
    setErrors(p => { const n = { ...p }; delete n.cliente; return n; });
  }, []);

  const limpiarCliente = useCallback(() => {
    setCliente(null);
    setSearchText('');
    setGarante(null);
    setSearchTextGarante('');
  }, []);

  // Select garante
  const seleccionarGarante = useCallback((c: Cliente) => {
    if (c.id === cliente?.id) {
      setErrors(p => ({ ...p, garante: 'El cliente no puede ser su propio garante' }));
      return;
    }
    setGarante(c);
    setSearchTextGarante(`${c.nombre} ${c.apellido || ''}`);
    setSugerenciasGarante([]);
    setShowSugerenciasGarante(false);
    setErrors(p => { const n = { ...p }; delete n.garante; return n; });
  }, [cliente]);

  const limpiarGarante = useCallback(() => {
    setGarante(null);
    setSearchTextGarante('');
    setSugerenciasGarante([]);
  }, []);

  // Validate
  const validate = useCallback(() => {
    const e: Record<string, string> = {};
    const montoNum = parseFloat(monto);
    if (!cliente) e.cliente = 'Selecciona un cliente';
    if (!monto || montoNum <= 0) e.monto = 'Ingresa un monto válido';
    if (!modoRapido && (!tasaInteres || parseFloat(tasaInteres) <= 0)) e.tasaInteres = 'Ingresa una tasa válida';
    if (!numeroCuotas || parseInt(numeroCuotas) < 1) e.numeroCuotas = 'Ingresa un número de cuotas válido';
    if (!frecuenciaPago) e.frecuenciaPago = 'Selecciona la frecuencia';
    if (!fechaInicio) e.fechaInicio = 'Selecciona la fecha de inicio';
    return e;
  }, [cliente, monto, tasaInteres, numeroCuotas, frecuenciaPago, fechaInicio, modoRapido]);

  const handleSubmit = useCallback(async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    if (modoRapido && (!preview || !preview.montoTotal)) {
      setErrors({ submit: 'El resumen no está disponible. Verifica los datos.' });
      return;
    }

    try {
      const payload: any = {
        clienteId: cliente!.id,
        monto: parseFloat(monto),
        tasaInteres: parseFloat(modoRapido ? '0' : tasaInteres),
        numeroCuotas: parseInt(numeroCuotas, 10),
        frecuenciaPago,
        fechaInicio,
        garanteId: garante?.id || undefined,
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
  }, [validate, modoRapido, preview, crearPrestamo, cliente, monto, tasaInteres, numeroCuotas, frecuenciaPago, fechaInicio, garante, showToast]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScreenContainer style={{ flex: 1 }}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <View style={styles.headerInfo}>
            <Text style={[styles.title, { color: colors.text }]}>Nuevo Préstamo</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Complete los datos del préstamo</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Mode selector */}
          <View style={styles.section}>
            <View style={styles.modeToggle}>
              <Pressable
                onPress={() => { setModoRapido(false); setWarnings({}); }}
                style={[styles.modeBtn, !modoRapido && { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.modeBtnText, !modoRapido && { color: '#FFFFFF' }]}>Normal</Text>
              </Pressable>
              <Pressable
                onPress={() => setModoRapido(true)}
                style={[styles.modeBtn, modoRapido && { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.modeBtnText, modoRapido && { color: '#FFFFFF' }]}>Rápido</Text>
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
            value={cliente}
            searchText={searchText}
            onSearchChange={setSearchText}
            sugerencias={sugerencias}
            showSugerencias={showSugerencias}
            onSelect={seleccionarCliente}
            onClear={limpiarCliente}
            error={errors.cliente}
            buscando={buscando}
            onFocus={() => sugerencias.length > 0 && setShowSugerencias(true)}
          />

          <SearchableSelect
            label="Garante (opcional)"
            placeholder="Buscar garante..."
            value={garante}
            searchText={searchTextGarante}
            onSearchChange={setSearchTextGarante}
            sugerencias={sugerenciasGarante}
            showSugerencias={showSugerenciasGarante}
            onSelect={seleccionarGarante}
            onClear={limpiarGarante}
            error={errors.garante}
            buscando={buscandoGarante}
            disabled={!cliente}
            disabledText="Selecciona un cliente primero"
            accentColor={colors.success}
            accentLight={colors.successLight}
            onFocus={() => sugerenciasGarante.length > 0 && setShowSugerenciasGarante(true)}
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
                    onPress={() => { setModoCalculo('PAGO'); setWarnings({}); }}
                    style={[styles.subBtn, modoCalculo === 'PAGO' && { backgroundColor: colors.primary }]}
                  >
                    <Text style={[styles.subBtnText, modoCalculo === 'PAGO' && { color: '#FFFFFF' }]}>
                      Pago por período
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => { setModoCalculo('GANANCIA'); setWarnings({}); }}
                    style={[styles.subBtn, modoCalculo === 'GANANCIA' && { backgroundColor: colors.primary }]}
                  >
                    <Text style={[styles.subBtnText, modoCalculo === 'GANANCIA' && { color: '#FFFFFF' }]}>
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
              <ResumenItem title="N° de cuotas" value={`${numeroCuotas} cuotas`} />
              {modoRapido && duracion && (
                <ResumenItem title="Duración" value={`${duracion} ${DURACION_LABEL[frecuenciaPago]}`} />
              )}

              {/* Progress bar */}
              {preview.montoTotal > 0 && (
                <View style={{ marginTop: Spacing.sm }}>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${(parseFloat(monto || '0') / preview.montoTotal) * 100}%` }]} />
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
                <Ionicons name={showTabla ? 'chevron-up' : 'chevron-down'} size={16} color={colors.primary} />
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
                <View style={[styles.warningBox, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
                  <Text style={{ color: '#92400E', fontSize: FontSize.xs }}>{warnings.tasaAlta}</Text>
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
          />

          <View style={{ height: Spacing.xxl }} />
        </ScrollView>
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}

function ResumenItem({ title, value, highlight = false }: { title: string; value: string; highlight?: boolean }) {
  const { colorScheme, colors } = useTheme();
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
    marginTop: 2,
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
    backgroundColor: '#F1F5F9',
    borderRadius: BorderRadius.md,
    padding: 2,
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
    color: '#64748B',
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
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  subBtnText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: '#64748B',
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
    height: 48,
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
    marginTop: 2,
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
    height: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1A56DB',
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
    fontSize: 10,
  },
  cuotaAmtVal: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    marginTop: 1,
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
