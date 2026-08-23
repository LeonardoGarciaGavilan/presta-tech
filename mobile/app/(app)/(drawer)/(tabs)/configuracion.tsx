import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  FontSize,
  FontWeight,
  Spacing,
  BorderRadius,
  Shadows,
  scale,
} from "@/constants/theme";
import {
  useConfiguracion,
  useGuardarConfiguracion,
} from "@/hooks/use-configuracion";
import {
  configuracionSchema,
  type ConfiguracionFormData,
} from "@/schemas/configuracion.schema";
import { AppInput } from "@/components/ui/app-input";
import { AppButton } from "@/components/ui/app-button";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useTheme } from "@/components/ui/theme-provider";
import { usePermisos } from "@/permisos/use-permisos";
import SinAcceso from "@/components/permisos/sin-acceso";
import { SectionCard } from "@/components/ui/section-card";
import { SettingRow } from "@/components/ui/setting-row";
import { formatIngresosInput } from "@/utils/formatters";

// ── Parsing numérico seguro ─────────────────────────────────────────
// Normaliza coma decimal (es-DO / teclados Android), filtra caracteres
// inválidos y evita estados NaN durante la edición.

function sanitizeNumeric(raw: string, integer: boolean): string {
  let cleaned = raw.replace(integer ? /[^0-9]/g : /[^0-9.]/g, "");
  if (!integer) {
    const firstDot = cleaned.indexOf(".");
    if (firstDot !== -1) {
      cleaned =
        cleaned.slice(0, firstDot + 1) +
        cleaned.slice(firstDot + 1).replace(/\./g, "");
    }
  }
  return cleaned;
}

interface NumericFieldProps {
  label: string;
  value: number | null | undefined;
  onChange: (value: number | null | undefined) => void;
  /** Valor a aplicar cuando el campo queda vacío. Omitir = undefined. */
  fallbackOnEmpty?: number | null;
  integer?: boolean;
  /** Formato con separador de miles mientras se edita. */
  currency?: boolean;
  placeholder?: string;
  prefix?: string;
  hint?: string;
  error?: string;
  editable?: boolean;
  maxLength?: number;
}

/**
 * Input numérico con texto local: permite escribir "12." sin perder el
 * punto y sincroniza con react-hook-form solo valores válidos.
 */
function NumericField({
  label,
  value,
  onChange,
  fallbackOnEmpty,
  integer = false,
  currency = false,
  maxLength = 13,
  ...inputProps
}: NumericFieldProps) {
  const [text, setText] = useState(() => (value == null ? "" : String(value)));
  const lastPushed = useRef<number | null | undefined>(value);

  useEffect(() => {
    if (value !== lastPushed.current) {
      setText(value == null ? "" : String(value));
      lastPushed.current = value;
    }
  }, [value]);

  const handleChange = useCallback(
    (raw: string) => {
      const cleaned = sanitizeNumeric(raw, integer);
      setText(currency ? formatIngresosInput(cleaned) : cleaned);

      if (cleaned === "" || cleaned === ".") {
        lastPushed.current = fallbackOnEmpty;
        onChange(fallbackOnEmpty);
        return;
      }
      const parsed = Number(cleaned.replace(/\.$/, ""));
      if (!Number.isNaN(parsed)) {
        lastPushed.current = parsed;
        onChange(parsed);
      }
    },
    [integer, currency, fallbackOnEmpty, onChange],
  );

  return (
    <AppInput
      label={label}
      {...inputProps}
      value={text}
      onChangeText={handleChange}
      onBlur={() => setText((t) => t.replace(/\.+$/, ""))}
      keyboardType={integer ? "number-pad" : "decimal-pad"}
      autoCorrect={false}
      maxLength={maxLength}
    />
  );
}

export default function ConfiguracionScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const { moduloHabilitado, tienePermiso } = usePermisos();
  const puedeEditar = tienePermiso("configuracion:editar");

  const { data: config, isLoading, isError, refetch } = useConfiguracion();
  const guardarMutation = useGuardarConfiguracion();

  const defaultValues = useMemo(
    () => ({
      tasaInteresBase: config?.tasaInteresBase ?? 0,
      moraPorcentajeMensual: config?.moraPorcentajeMensual ?? 0,
      diasGracia: config?.diasGracia ?? 5,
      permitirAbonoCapital: config?.permitirAbonoCapital ?? true,
      montoMinimoPrestamo: config?.montoMinimoPrestamo ?? 500,
      montoMaximoPrestamo: config?.montoMaximoPrestamo ?? null,
      montoMaximoPago: config?.montoMaximoPago ?? null,
      cuotasRestantesParaRenovar: config?.cuotasRestantesParaRenovar ?? 0,
      maxRefinanciamientosPorPrestamo:
        config?.maxRefinanciamientosPorPrestamo ?? 0,
      permitirRefinanciamiento: config?.permitirRefinanciamiento ?? true,
      maxPrestamosActivosPorCliente:
        config?.maxPrestamosActivosPorCliente ?? null,
      permitirRenovacion: config?.permitirRenovacion ?? false,
      maxCuotasRestantesParaRenovacion:
        config?.maxCuotasRestantesParaRenovacion ?? 0,
      incluirInteresEnRenovacion: config?.incluirInteresEnRenovacion ?? true,
      porcentajeMaximoSaldoAplicado:
        config?.porcentajeMaximoSaldoAplicado ?? 100,
      maxRenovacionesConsecutivas: config?.maxRenovacionesConsecutivas ?? 0,
    }),
    [config],
  );

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isDirty },
  } = useForm<ConfiguracionFormData>({
    resolver: zodResolver(configuracionSchema),
    defaultValues,
    values: defaultValues,
  });

  const permitirRenovacionValue = watch("permitirRenovacion") ?? false;
  const permitirRefinanciamientoValue =
    watch("permitirRefinanciamiento") ?? true;

  // Resumen en vivo: refleja el borrador actual del formulario
  const resumenTasa = watch("tasaInteresBase");
  const resumenMora = watch("moraPorcentajeMensual");
  const resumenDiasGracia = watch("diasGracia");
  const resumenAbonoCapital = watch("permitirAbonoCapital") ?? false;

  const onSubmit = useCallback(
    async (data: ConfiguracionFormData) => {
      try {
        await guardarMutation.mutateAsync({
          tasaInteresBase: data.tasaInteresBase,
          moraPorcentajeMensual: data.moraPorcentajeMensual,
          diasGracia: data.diasGracia,
          permitirAbonoCapital: data.permitirAbonoCapital,
          montoMinimoPrestamo: data.montoMinimoPrestamo,
          montoMaximoPrestamo: data.montoMaximoPrestamo ?? null,
          montoMaximoPago: data.montoMaximoPago ?? null,
          cuotasRestantesParaRenovar: data.cuotasRestantesParaRenovar ?? 0,
          maxRefinanciamientosPorPrestamo:
            data.maxRefinanciamientosPorPrestamo ?? 0,
          permitirRefinanciamiento: data.permitirRefinanciamiento ?? true,
          maxPrestamosActivosPorCliente:
            data.maxPrestamosActivosPorCliente ?? 0,
          permitirRenovacion: data.permitirRenovacion ?? false,
          maxCuotasRestantesParaRenovacion:
            data.maxCuotasRestantesParaRenovacion ?? 0,
          incluirInteresEnRenovacion: data.incluirInteresEnRenovacion ?? true,
          porcentajeMaximoSaldoAplicado:
            data.porcentajeMaximoSaldoAplicado ?? 100,
          maxRenovacionesConsecutivas: data.maxRenovacionesConsecutivas ?? 0,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
          () => {},
        );
        showToast("Configuración guardada correctamente", "success");
      } catch {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
          () => {},
        );
        showToast("Error al guardar la configuración", "error");
      }
    },
    [guardarMutation, showToast],
  );

  const handleDescartar = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    reset(defaultValues);
  }, [reset, defaultValues]);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Skeleton height={scale(120)} borderRadius={BorderRadius.xl} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={4} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={5} />
        </ScrollView>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centerContent}>
          <Ionicons
            name="alert-circle-outline"
            size={scale(48)}
            color={colors.error}
          />
          <Text style={[styles.errorTitle, { color: colors.text }]}>
            Error al cargar configuración
          </Text>
          <Text style={[styles.errorDesc, { color: colors.textTertiary }]}>
            Verifica tu conexión e intenta de nuevo
          </Text>
          <AppButton
            title="Reintentar"
            variant="outline"
            icon="refresh-outline"
            onPress={() => refetch()}
            style={styles.retryButton}
          />
        </View>
      </View>
    );
  }

  if (!moduloHabilitado("CONFIGURACION") || !puedeEditar) {
    return <SinAcceso />;
  }

  const mostrarBarraGuardado = puedeEditar && isDirty;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          mostrarBarraGuardado && {
            paddingBottom: scale(96) + insets.bottom,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ marginBottom: Spacing.md }}>
          <Text
            style={{
              fontSize: FontSize.xxl,
              fontWeight: FontWeight.bold,
              color: colors.text,
            }}
            accessibilityRole="header"
          >
            Configuración
          </Text>
          <Text style={{ fontSize: FontSize.sm, color: colors.textTertiary }}>
            Parámetros operativos del sistema
          </Text>
        </View>

        <View
          style={[
            styles.summaryCard,
            { backgroundColor: colors.primary, ...Shadows.md },
          ]}
        >
          <Text style={styles.summaryTitle}>Resumen de configuración</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{String(resumenTasa ?? 0)}%</Text>
              <Text style={styles.summaryLabel}>Tasa base</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{String(resumenMora ?? 0)}%</Text>
              <Text style={styles.summaryLabel}>Mora</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>
                {String(resumenDiasGracia ?? 0)}
              </Text>
              <Text style={styles.summaryLabel}>Días gracia</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>
                {resumenAbonoCapital ? "Sí" : "No"}
              </Text>
              <Text style={styles.summaryLabel}>Abono capital</Text>
            </View>
          </View>
        </View>

        <SectionCard
          iconName="stats-chart-outline"
          title="Tasas e intereses"
          description="Define las tasas aplicadas a los préstamos"
          colors={colors}
        >
          <Controller
            control={control}
            name="tasaInteresBase"
            render={({ field: { onChange, value } }) => (
              <NumericField
                label="Tasa de interés base"
                placeholder="0.00"
                value={value}
                onChange={(v) => onChange(v ?? 0)}
                fallbackOnEmpty={0}
                editable={puedeEditar}
                error={errors.tasaInteresBase?.message}
                hint="Se usa como sugerencia al crear un préstamo"
              />
            )}
          />
          <Controller
            control={control}
            name="moraPorcentajeMensual"
            render={({ field: { onChange, value } }) => (
              <NumericField
                label="Porcentaje de mora mensual"
                placeholder="0.00"
                value={value}
                onChange={(v) => onChange(v ?? 0)}
                fallbackOnEmpty={0}
                editable={puedeEditar}
                error={errors.moraPorcentajeMensual?.message}
                hint="Se aplica una sola vez tras los días de gracia"
              />
            )}
          />
        </SectionCard>

        <SectionCard
          iconName="time-outline"
          title="Reglas de mora"
          description="Configura los plazos y reglas de mora"
          colors={colors}
        >
          <Controller
            control={control}
            name="diasGracia"
            render={({ field: { onChange, value } }) => (
              <NumericField
                label="Días de gracia"
                placeholder="0"
                value={value}
                onChange={(v) => onChange(v ?? 0)}
                fallbackOnEmpty={0}
                integer
                editable={puedeEditar}
                error={errors.diasGracia?.message}
                hint="Días después del vencimiento antes de aplicar mora"
              />
            )}
          />
          <Controller
            control={control}
            name="permitirAbonoCapital"
            render={({ field: { onChange, value } }) => (
              <SettingRow
                label="Permitir abono a capital"
                description="Los clientes pueden pagar directo al capital"
                value={value}
                onValueChange={onChange}
                disabled={!puedeEditar}
                colors={colors}
                isLast
              />
            )}
          />
        </SectionCard>

        <SectionCard
          iconName="cash-outline"
          title="Límites financieros"
          description="Define montos mínimos y máximos para préstamos y pagos"
          colors={colors}
        >
          <Controller
            control={control}
            name="montoMinimoPrestamo"
            render={({ field: { onChange, value } }) => (
              <NumericField
                label="Monto mínimo de préstamo"
                placeholder="500"
                prefix="RD$"
                currency
                value={value}
                onChange={onChange}
                editable={puedeEditar}
                error={errors.montoMinimoPrestamo?.message}
                hint="Dejar vacío = RD$500 por defecto"
              />
            )}
          />
          <Controller
            control={control}
            name="montoMaximoPrestamo"
            render={({ field: { onChange, value } }) => (
              <NumericField
                label="Monto máximo de préstamo"
                placeholder="Sin límite"
                prefix="RD$"
                currency
                value={value}
                onChange={onChange}
                fallbackOnEmpty={null}
                editable={puedeEditar}
                error={errors.montoMaximoPrestamo?.message}
                hint="Dejar vacío para no establecer límite"
              />
            )}
          />
          <Controller
            control={control}
            name="montoMaximoPago"
            render={({ field: { onChange, value } }) => (
              <NumericField
                label="Monto máximo por pago"
                placeholder="Sin límite"
                prefix="RD$"
                currency
                value={value}
                onChange={onChange}
                fallbackOnEmpty={null}
                editable={puedeEditar}
                error={errors.montoMaximoPago?.message}
                hint="Límite por transacción de pago"
              />
            )}
          />
          <Controller
            control={control}
            name="maxPrestamosActivosPorCliente"
            render={({ field: { onChange, value } }) => (
              <NumericField
                label="Máximo de préstamos activos por cliente"
                placeholder="Sin límite"
                integer
                value={value}
                onChange={onChange}
                fallbackOnEmpty={null}
                editable={puedeEditar}
                error={errors.maxPrestamosActivosPorCliente?.message}
                hint="Cuenta préstamos ACTIVOS y ATRASADOS. Vacío o 0 = sin límite"
              />
            )}
          />
        </SectionCard>

        <SectionCard
          iconName="swap-horizontal-outline"
          title="Reglas de refinanciamiento"
          description="Controla cuándo se puede refinanciar un préstamo"
          colors={colors}
        >
          <Controller
            control={control}
            name="permitirRefinanciamiento"
            render={({ field: { value } }) => (
              <SettingRow
                label="Permitir refinanciamiento de préstamos"
                description="Habilita la acción de Refinanciar en préstamos ACTIVOS o ATRASADOS"
                value={value}
                onValueChange={(v) =>
                  setValue("permitirRefinanciamiento", v, { shouldDirty: true })
                }
                disabled={!puedeEditar}
                colors={colors}
              />
            )}
          />
          <View
            style={{
              opacity: permitirRefinanciamientoValue ? 1 : 0.45,
            }}
            pointerEvents={permitirRefinanciamientoValue ? "auto" : "none"}
          >
            <Controller
              control={control}
              name="cuotasRestantesParaRenovar"
              render={({ field: { onChange, value } }) => (
                <NumericField
                  label="Cuotas restantes para permitir refinanciamiento"
                  placeholder="0"
                  value={value}
                  onChange={(v) => onChange(v ?? 0)}
                  fallbackOnEmpty={0}
                  integer
                  editable={puedeEditar}
                  error={errors.cuotasRestantesParaRenovar?.message}
                  hint="Solo se puede refinanciar cuando faltan X cuotas o menos. 0 = sin restricción"
                />
              )}
            />
            <Controller
              control={control}
              name="maxRefinanciamientosPorPrestamo"
              render={({ field: { onChange, value } }) => (
                <NumericField
                  label="Máximo de refinanciamientos por préstamo"
                  placeholder="0"
                  value={value}
                  onChange={(v) => onChange(v ?? 0)}
                  fallbackOnEmpty={0}
                  integer
                  editable={puedeEditar}
                  error={errors.maxRefinanciamientosPorPrestamo?.message}
                  hint="Límite de veces que un préstamo puede refinanciarse. 0 = sin límite"
                />
              )}
            />
          </View>
        </SectionCard>

        <SectionCard
          iconName="repeat-outline"
          title="Renovación de préstamos"
          description="Liquida el saldo anterior y desembolsa un préstamo nuevo"
          colors={colors}
        >
          <Controller
            control={control}
            name="permitirRenovacion"
            render={({ field: { value } }) => (
              <SettingRow
                label="Permitir renovación de préstamos"
                description="Habilita la acción de Renovar en préstamos ACTIVOS o ATRASADOS"
                value={value}
                onValueChange={(v) =>
                  setValue("permitirRenovacion", v, { shouldDirty: true })
                }
                disabled={!puedeEditar}
                colors={colors}
              />
            )}
          />
          <View
            style={{
              opacity: permitirRenovacionValue ? 1 : 0.45,
            }}
            pointerEvents={permitirRenovacionValue ? "auto" : "none"}
          >
            <Controller
              control={control}
              name="incluirInteresEnRenovacion"
              render={({ field: { value } }) => (
                <SettingRow
                  label="Incluir interés futuro al liquidar"
                  description="Cobra también el interés de las cuotas pendientes al renovar"
                  value={value}
                  onValueChange={(v) =>
                    setValue("incluirInteresEnRenovacion", v, {
                      shouldDirty: true,
                    })
                  }
                  disabled={!puedeEditar || !permitirRenovacionValue}
                  colors={colors}
                />
              )}
            />
            <Controller
              control={control}
              name="maxCuotasRestantesParaRenovacion"
              render={({ field: { onChange, value } }) => (
                <NumericField
                  label="Cuotas pendientes máximas para renovar"
                  placeholder="0"
                  value={value}
                  onChange={(v) => onChange(v ?? 0)}
                  fallbackOnEmpty={0}
                  integer
                  editable={puedeEditar}
                  error={errors.maxCuotasRestantesParaRenovacion?.message}
                  hint="Solo se puede renovar cuando faltan X cuotas o menos. 0 = sin restricción"
                />
              )}
            />
            <Controller
              control={control}
              name="porcentajeMaximoSaldoAplicado"
              render={({ field: { onChange, value } }) => (
                <NumericField
                  label="Porcentaje máximo del saldo anterior aplicado"
                  placeholder="100"
                  value={value}
                  onChange={(v) => onChange(v ?? 100)}
                  fallbackOnEmpty={100}
                  integer
                  editable={puedeEditar}
                  error={errors.porcentajeMaximoSaldoAplicado?.message}
                  hint="Tope del saldo aplicado sobre el monto nuevo. 100 = sin tope"
                />
              )}
            />
            <Controller
              control={control}
              name="maxRenovacionesConsecutivas"
              render={({ field: { onChange, value } }) => (
                <NumericField
                  label="Máximo de renovaciones consecutivas"
                  placeholder="0"
                  value={value}
                  onChange={(v) => onChange(v ?? 0)}
                  fallbackOnEmpty={0}
                  integer
                  editable={puedeEditar}
                  error={errors.maxRenovacionesConsecutivas?.message}
                  hint="Cuántas veces en cadena se puede renovar el mismo préstamo. 0 = sin límite"
                />
              )}
            />
          </View>
        </SectionCard>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Barra sticky de guardado: solo visible con cambios pendientes */}
      {mostrarBarraGuardado && (
        <View
          style={[
            styles.stickyBar,
            {
              backgroundColor: colors.card,
              borderTopColor: colors.border,
              paddingBottom: Math.max(insets.bottom, Spacing.sm + 4),
              ...Shadows.lg,
            },
          ]}
        >
          <View style={styles.stickyStatus}>
            <View
              style={[styles.dirtyDot, { backgroundColor: colors.warning }]}
            />
            <Text style={[styles.stickyText, { color: colors.textSecondary }]}>
              Cambios sin guardar
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleDescartar}
            hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
            disabled={guardarMutation.isPending}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Descartar cambios"
            style={styles.discardButton}
          >
            <Text
              style={[styles.discardText, { color: colors.textTertiary }]}
            >
              Descartar
            </Text>
          </TouchableOpacity>
          <AppButton
            title="Guardar"
            onPress={handleSubmit(onSubmit)}
            loading={guardarMutation.isPending}
            icon="save-outline"
            style={styles.saveButton}
          />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
  },
  errorTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    marginTop: Spacing.md,
  },
  errorDesc: {
    fontSize: FontSize.sm,
    textAlign: "center",
    marginTop: Spacing.xs,
  },
  retryButton: {
    marginTop: Spacing.lg,
    minWidth: scale(180),
  },
  summaryCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  summaryTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: "rgba(255,255,255,0.8)",
    textTransform: "uppercase",
    letterSpacing: scale(1),
    marginBottom: Spacing.md,
  },
  summaryGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryItem: {
    alignItems: "center",
    flex: 1,
  },
  summaryValue: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: "#FFFFFF",
  },
  summaryLabel: {
    fontSize: FontSize.xs,
    color: "rgba(255,255,255,0.7)",
    marginTop: scale(2),
  },
  stickyBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingTop: Spacing.sm + 4,
    paddingHorizontal: Spacing.md,
    borderTopWidth: 1,
  },
  stickyStatus: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  dirtyDot: {
    width: scale(8),
    height: scale(8),
    borderRadius: BorderRadius.full,
  },
  stickyText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  discardButton: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.sm,
  },
  discardText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  saveButton: {
    minHeight: scale(44),
    paddingHorizontal: Spacing.lg,
  },
  bottomSpacer: {
    height: Spacing.xxl,
  },
});
