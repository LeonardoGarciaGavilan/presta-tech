import { useCallback, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRenovarPrestamo } from "@/hooks/use-prestamos";
import { calcularAmortizacionRapidaLocal } from "@/hooks/use-prestamo-preview";
import { useCajaActiva } from "@/hooks/use-caja";
import { useNetworkContext } from "@/components/providers/network-provider";
import { AppButton } from "@/components/ui/app-button";
import { AppInput } from "@/components/ui/app-input";
import PickerField from "@/components/ui/picker-field";
import DatePickerField from "@/components/ui/date-picker-field";
import { useTheme } from "@/components/ui/theme-provider";
import { useToast } from "@/components/ui/toast";
import { getConfiguracion } from "@/db/config-db";
import { calcularRenovacionLocal } from "@/utils/amortizacion";
import { formatCurrency } from "@/utils/formatters";
import type {
  FrecuenciaPago,
  LiquidacionRenovacion,
  Prestamo,
} from "@/types/prestamo.types";
import {
  FontSize,
  FontWeight,
  Spacing,
  BorderRadius,
  scale,
} from "@/constants/theme";

interface RenovarModalProps {
  visible: boolean;
  onClose: () => void;
  prestamo: Prestamo;
  onSuccess?: () => void;
}

const FRECUENCIAS: FrecuenciaPago[] = [
  "DIARIO",
  "SEMANAL",
  "QUINCENAL",
  "MENSUAL",
];

const FREQ_LABEL: Record<string, string> = {
  DIARIO: "diario",
  SEMANAL: "semanal",
  QUINCENAL: "quincenal",
  MENSUAL: "mensual",
};

const DURACION_LABEL: Record<string, string> = {
  DIARIO: "días",
  SEMANAL: "semanas",
  QUINCENAL: "quincenas",
  MENSUAL: "meses",
};

// ── Sanitización numérica ───────────────────────────────────────────
// Normaliza coma decimal (teclados es-DO / Android) y filtra caracteres
// inválidos antes de cualquier parseFloat. No altera la lógica posterior.

function sanitizeDecimal(raw: string): string {
  const cleaned = raw.replace(/,/g, ".").replace(/[^0-9.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) return cleaned;
  return (
    cleaned.slice(0, firstDot + 1) +
    cleaned.slice(firstDot + 1).replace(/\./g, "")
  );
}

function sanitizeInteger(raw: string): string {
  return raw.replace(/[^0-9]/g, "");
}

interface PreviewRenovacion {
  liquidacion: LiquidacionRenovacion;
  desembolsoNeto: number;
  nuevaCuota: number;
  montoTotal: number;
  tasaInteres: number;
  numeroCuotas: number;
  modoRapido: boolean;
  error: string | null;
}

interface ResumenRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  sub?: string;
  warn?: boolean;
  isLast?: boolean;
  colors: ReturnType<typeof useTheme>["colors"];
}

function ResumenRow({
  icon,
  label,
  value,
  sub,
  warn = false,
  isLast = false,
  colors,
}: ResumenRowProps) {
  return (
    <View
      style={[
        styles.resumenRow,
        !isLast && {
          borderBottomWidth: 1,
          borderBottomColor: colors.borderLight,
        },
      ]}
    >
      <Ionicons
        name={icon}
        size={scale(16)}
        color={warn ? colors.warning : colors.primary}
      />
      <View style={styles.resumenRowText}>
        <Text style={[styles.resumenRowLabel, { color: colors.textSecondary }]}>
          {label}
        </Text>
        {sub && (
          <Text style={[styles.resumenRowSub, { color: colors.textTertiary }]}>
            {sub}
          </Text>
        )}
      </View>
      <Text
        style={[
          styles.resumenRowValue,
          { color: warn ? colors.warning : colors.text },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const RenovarModal = ({
  visible,
  onClose,
  prestamo,
  onSuccess,
}: RenovarModalProps) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const { network } = useNetworkContext();
  const renovarMutation = useRenovarPrestamo();
  const { data: cajaActiva } = useCajaActiva();
  const [modoRapido, setModoRapido] = useState(true);
  const [modoCalculo, setModoCalculo] = useState<"PAGO" | "GANANCIA">("PAGO");
  const [montoNuevo, setMontoNuevo] = useState("");
  const [tasa, setTasa] = useState("");
  const [cuotas, setCuotas] = useState("");
  const [pagoPorPeriodo, setPagoPorPeriodo] = useState("");
  const [gananciaDeseada, setGananciaDeseada] = useState("");
  const [duracion, setDuracion] = useState("");
  const [frecuencia, setFrecuencia] = useState<FrecuenciaPago | undefined>(
    undefined,
  );
  const [fechaInicio, setFechaInicio] = useState("");
  const [motivo, setMotivo] = useState("");
  const [confirmarPaso, setConfirmarPaso] = useState(false);

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
    if (config.permitirRenovacion === false) {
      return "La renovación de préstamos no está habilitada para tu empresa.";
    }
    const maxCuotas = config.maxCuotasRestantesParaRenovacion ?? 0;
    if (maxCuotas > 0 && cuotasPendientes.length > maxCuotas) {
      return `Solo se puede renovar cuando faltan ${maxCuotas} cuota(s) o menos. Este préstamo tiene ${cuotasPendientes.length} pendientes.`;
    }
    const maxCadena = config.maxRenovacionesConsecutivas ?? 0;
    if (maxCadena > 0 && (prestamo.cadenaRenovaciones ?? 0) >= maxCadena) {
      return `Este préstamo alcanzó el límite de ${maxCadena} renovación(es) consecutiva(s).`;
    }
    return null;
  }, [visible, cuotasPendientes.length, prestamo.cadenaRenovaciones]);

  // Saldo anterior aplicado: depende solo de las cuotas pendientes y de la
  // config (no del monto nuevo), por lo que puede mostrarse desde el paso 1.
  const saldoAnterior = useMemo((): LiquidacionRenovacion | null => {
    if (!visible) return null;
    try {
      let incluirInteres: boolean | undefined;
      try {
        incluirInteres = getConfiguracion()?.incluirInteresEnRenovacion;
      } catch {
        // sin config cacheada: default del backend
      }
      const r = calcularRenovacionLocal(
        prestamo,
        { montoNuevo: 1, tasaInteres: 0, numeroCuotas: 1 },
        { incluirInteres },
        new Date(),
      );
      return r.liquidacion;
    } catch {
      return null;
    }
  }, [visible, prestamo]);

  // Total a cobrar en modo rápido (mismo solver que Nuevo Préstamo).
  const totalCobrarRapido = useMemo(() => {
    const montoVal = parseFloat(montoNuevo);
    const duracionVal = parseInt(duracion, 10);
    if (!(montoVal > 0) || !(duracionVal > 0)) return null;
    if (modoCalculo === "PAGO") {
      const pagoVal = parseFloat(pagoPorPeriodo);
      if (!(pagoVal > 0)) return null;
      return Math.round(pagoVal * duracionVal * 100) / 100;
    }
    const gananciaVal = parseFloat(gananciaDeseada);
    if (!(gananciaVal >= 0)) return null;
    return Math.round((montoVal + gananciaVal) * 100) / 100;
  }, [modoCalculo, montoNuevo, duracion, pagoPorPeriodo, gananciaDeseada]);

  // Pre-validación best-effort de fondos con el cache de caja activa
  // (advertencia, no bloqueo: el cache puede estar obsoleto y el servidor
  // re-valida con la fórmula exacta pagos-efectivo − desembolsos).
  const efectivoEstimado = useMemo(() => {
    if (!cajaActiva || cajaActiva.estado !== "ABIERTA") return null;
    return (
      Math.round(
        ((cajaActiva.montoInicial ?? 0) +
          (cajaActiva.totalIngresos ?? 0) -
          (cajaActiva.totalEgresos ?? 0)) *
          100,
      ) / 100
    );
  }, [cajaActiva]);

  // Preview vivo con la misma matemática que validará el backend.
  const preview = useMemo((): PreviewRenovacion | null => {
    if (!visible) return null;
    let incluirInteres: boolean | undefined;
    let pct: number | undefined;
    try {
      const config = getConfiguracion();
      incluirInteres = config?.incluirInteresEnRenovacion;
      pct = config?.porcentajeMaximoSaldoAplicado;
    } catch {
      // sin config cacheada: defaults del backend
    }

    if (modoRapido) {
      const montoNum = parseFloat(montoNuevo);
      const duracionNum = parseInt(duracion, 10);
      const totalCobrar = totalCobrarRapido;
      if (
        !(montoNum > 0) ||
        !(duracionNum > 0) ||
        totalCobrar == null ||
        !(totalCobrar > 0)
      ) {
        return null;
      }
      // La liquidación (capital/interés/mora/saldo aplicado) no depende del
      // plan nuevo: se reutiliza el cálculo local con un dto equivalente.
      let liquidacion: LiquidacionRenovacion;
      let desembolsoNeto: number;
      let errorBase: string | null;
      try {
        const base = calcularRenovacionLocal(
          prestamo,
          { montoNuevo: montoNum, tasaInteres: 0, numeroCuotas: duracionNum },
          { incluirInteres, porcentajeMaximoSaldoAplicado: pct },
          new Date(),
        );
        liquidacion = base.liquidacion;
        desembolsoNeto = base.desembolsoNeto;
        errorBase = base.error;
      } catch {
        return null;
      }
      const parcial = {
        liquidacion,
        desembolsoNeto,
        nuevaCuota: 0,
        montoTotal: totalCobrar,
        tasaInteres: 0,
        numeroCuotas: duracionNum,
        modoRapido: true,
      };
      if (errorBase) return { ...parcial, error: errorBase };
      if (totalCobrar <= montoNum) {
        return {
          ...parcial,
          error: "El total a cobrar debe ser mayor al monto del nuevo préstamo.",
        };
      }
      const tabla = calcularAmortizacionRapidaLocal(
        montoNum,
        duracionNum,
        totalCobrar,
        frecuenciaEfectiva,
        fechaInicio ? fechaInicio : new Date().toISOString(),
      );
      return { ...parcial, nuevaCuota: tabla.cuotaInicial, error: null };
    }

    const montoNum = parseFloat(montoNuevo);
    const tasaNum = parseFloat(tasa);
    const cuotasNum = parseInt(cuotas, 10);
    if (!(montoNum > 0) || !(tasaNum > 0) || !(cuotasNum > 0)) return null;
    try {
      const r = calcularRenovacionLocal(
        prestamo,
        {
          montoNuevo: montoNum,
          tasaInteres: tasaNum,
          numeroCuotas: cuotasNum,
          ...(frecuencia ? { frecuenciaPago: frecuencia } : {}),
          ...(fechaInicio ? { fechaInicio } : {}),
        },
        { incluirInteres, porcentajeMaximoSaldoAplicado: pct },
        new Date(),
      );
      return {
        liquidacion: r.liquidacion,
        desembolsoNeto: r.desembolsoNeto,
        nuevaCuota: r.nuevaCuota,
        montoTotal: r.tablaNueva.montoTotal,
        tasaInteres: tasaNum,
        numeroCuotas: cuotasNum,
        modoRapido: false,
        error: r.error,
      };
    } catch {
      return null;
    }
  }, [
    visible,
    modoRapido,
    modoCalculo,
    montoNuevo,
    tasa,
    cuotas,
    duracion,
    pagoPorPeriodo,
    gananciaDeseada,
    totalCobrarRapido,
    frecuencia,
    frecuenciaEfectiva,
    fechaInicio,
    prestamo,
  ]);

  // Misma condición que el backend: efectivo + saldo aplicado >= monto nuevo.
  const fondosInsuficientes =
    preview != null &&
    !preview.error &&
    efectivoEstimado != null &&
    efectivoEstimado + preview.liquidacion.total < parseFloat(montoNuevo);

  const inputsValidos = modoRapido
    ? !!parseFloat(montoNuevo) &&
      parseFloat(montoNuevo) > 0 &&
      !!parseInt(duracion, 10) &&
      parseInt(duracion, 10) > 0 &&
      parseInt(duracion, 10) <= 3650 &&
      !!totalCobrarRapido &&
      parseFloat(montoNuevo) < (totalCobrarRapido ?? 0)
    : !!parseFloat(montoNuevo) &&
      parseFloat(montoNuevo) > 0 &&
      !!parseFloat(tasa) &&
      parseFloat(tasa) >= 0.1 &&
      parseFloat(tasa) <= 100 &&
      !!parseInt(cuotas, 10) &&
      parseInt(cuotas, 10) > 0 &&
      parseInt(cuotas, 10) <= 3650;

  // Motivos visibles por los que Continuar está deshabilitado (los errores
  // de negocio como total<=monto o fondos ya tienen su propio aviso).
  const razonesValidacion = useMemo(() => {
    const razones: string[] = [];
    const montoNum = parseFloat(montoNuevo);
    if (!(montoNum > 0)) {
      razones.push("Ingresa el monto del nuevo préstamo.");
      return razones;
    }
    if (modoRapido) {
      const dVal = parseInt(duracion, 10);
      if (!(dVal > 0)) {
        razones.push("Ingresa la duración del nuevo préstamo.");
      } else if (dVal > 3650) {
        razones.push("La duración máxima es 3650 períodos.");
      }
      if (modoCalculo === "PAGO") {
        if (!(parseFloat(pagoPorPeriodo) > 0))
          razones.push("Ingresa el pago por período.");
      } else if (!(parseFloat(gananciaDeseada) >= 0)) {
        razones.push("Ingresa la ganancia deseada.");
      }
    } else {
      const tVal = parseFloat(tasa);
      const cVal = parseInt(cuotas, 10);
      if (!(tVal >= 0.1)) {
        razones.push("La tasa debe ser al menos 0.1%.");
      } else if (tVal > 100) {
        razones.push("La tasa máxima es 100%.");
      }
      if (!(cVal > 0)) {
        razones.push("Ingresa el número de cuotas.");
      } else if (cVal > 3650) {
        razones.push("El máximo de cuotas es 3650.");
      }
    }
    return razones;
  }, [
    modoRapido,
    modoCalculo,
    montoNuevo,
    duracion,
    tasa,
    cuotas,
    pagoPorPeriodo,
    gananciaDeseada,
  ]);

  const formularioTocado =
    montoNuevo !== "" ||
    duracion !== "" ||
    tasa !== "" ||
    cuotas !== "" ||
    pagoPorPeriodo !== "" ||
    gananciaDeseada !== "";

  const handleContinuar = useCallback(() => {
    if (bloqueoRegla) {
      showToast(bloqueoRegla, "error");
      return;
    }
    if (preview?.error) {
      showToast(preview.error, "error");
      return;
    }
    Haptics.selectionAsync().catch(() => {});
    setConfirmarPaso(true);
  }, [bloqueoRegla, preview, showToast]);

  const resetForm = useCallback(() => {
    setModoRapido(true);
    setModoCalculo("PAGO");
    setMontoNuevo("");
    setTasa("");
    setCuotas("");
    setPagoPorPeriodo("");
    setGananciaDeseada("");
    setDuracion("");
    setFrecuencia(undefined);
    setFechaInicio("");
    setMotivo("");
    setConfirmarPaso(false);
  }, []);

  const handleRenovar = useCallback(async () => {
    const montoNum = parseFloat(montoNuevo);
    const duracionNum = parseInt(duracion, 10);
    const cuotasNum = parseInt(cuotas, 10);
    const tasaNum = parseFloat(tasa);
    if (!montoNum) return;
    if (modoRapido && (!duracionNum || !totalCobrarRapido)) return;
    if (!modoRapido && (!tasaNum || !cuotasNum)) return;
    try {
      await renovarMutation.mutateAsync({
        id: prestamo.id,
        data: {
          montoNuevo: montoNum,
          ...(modoRapido
            ? {
                modoRapido: true,
                tasaInteres: 0,
                numeroCuotas: duracionNum,
                montoTotal: totalCobrarRapido!,
              }
            : {
                tasaInteres: tasaNum,
                numeroCuotas: cuotasNum,
              }),
          ...(frecuencia ? { frecuenciaPago: frecuencia } : {}),
          ...(fechaInicio ? { fechaInicio } : {}),
          ...(motivo.trim() ? { motivo: motivo.trim() } : {}),
        },
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
      showToast("Préstamo renovado exitosamente", "success");
      resetForm();
      onSuccess?.();
      onClose();
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => {},
      );
      showToast(err?.message || "Error al renovar el préstamo", "error");
    }
  }, [
    montoNuevo,
    modoRapido,
    duracion,
    totalCobrarRapido,
    tasa,
    cuotas,
    frecuencia,
    fechaInicio,
    motivo,
    prestamo.id,
    renovarMutation,
    onSuccess,
    onClose,
    showToast,
    resetForm,
  ]);

  const handleClose = useCallback(() => {
    setConfirmarPaso(false);
    onClose();
  }, [onClose]);

  const cambiarModoRapido = useCallback((rapido: boolean) => {
    Haptics.selectionAsync().catch(() => {});
    setModoRapido(rapido);
  }, []);

  const cambiarModoCalculo = useCallback((modo: "PAGO" | "GANANCIA") => {
    Haptics.selectionAsync().catch(() => {});
    setModoCalculo(modo);
  }, []);

  const liquidacion = preview?.liquidacion;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={[styles.overlay, { backgroundColor: colors.overlay }]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View
          style={[styles.card, { backgroundColor: colors.surfaceElevated }]}
        >
          <View style={[styles.headerBar, { backgroundColor: colors.primary }]}>
            <Ionicons name="refresh-circle" size={scale(22)} color="#FFFFFF" />
            <Text
              style={[styles.title, { color: "#FFFFFF" }]}
              accessibilityRole="header"
            >
              Renovar Préstamo
            </Text>
            <Pressable
              onPress={handleClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
              accessibilityHint="Cierra el modal sin renovar"
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
            {confirmarPaso && preview ? (
              <>
                {/* Hero: la cifra que importa al desembolsar */}
                <View
                  style={[
                    styles.heroBox,
                    {
                      backgroundColor: colors.primaryLight,
                      borderColor: colors.primary,
                    },
                  ]}
                >
                  <Text
                    style={[styles.heroLabel, { color: colors.textSecondary }]}
                  >
                    Desembolso neto en efectivo
                  </Text>
                  <Text style={[styles.heroValue, { color: colors.primary }]}>
                    {formatCurrency(preview.desembolsoNeto)}
                  </Text>
                  <Text
                    style={[styles.heroNote, { color: colors.textSecondary }]}
                  >
                    Requiere caja abierta con fondos disponibles
                  </Text>
                </View>

                <View
                  style={[
                    styles.rowsCard,
                    { backgroundColor: colors.surface },
                  ]}
                >
                  <ResumenRow
                    icon="arrow-down-circle-outline"
                    label="Saldo anterior aplicado"
                    value={formatCurrency(liquidacion!.total)}
                    sub={`Capital: ${formatCurrency(liquidacion!.capital)}${
                      preview.liquidacion.interes > 0
                        ? ` · Interés: ${formatCurrency(preview.liquidacion.interes)}`
                        : ""
                    }${
                      preview.liquidacion.mora > 0
                        ? ` · Mora: ${formatCurrency(preview.liquidacion.mora)}`
                        : ""
                    }`}
                    colors={colors}
                  />
                  <ResumenRow
                    icon="cash-outline"
                    label="Nuevo préstamo"
                    value={formatCurrency(parseFloat(montoNuevo))}
                    colors={colors}
                  />
                  <ResumenRow
                    icon="calendar-outline"
                    label={`Nueva cuota (${FREQ_LABEL[frecuenciaEfectiva] ?? frecuenciaEfectiva})`}
                    value={`${formatCurrency(preview.nuevaCuota)} × ${preview.numeroCuotas}`}
                    colors={colors}
                  />
                  {preview.modoRapido ? (
                    <ResumenRow
                      icon="calculator-outline"
                      label="Total a cobrar"
                      value={formatCurrency(preview.montoTotal)}
                      sub="Modo rápido: la tasa se calcula automáticamente"
                      colors={colors}
                    />
                  ) : (
                    <ResumenRow
                      icon="trending-up-outline"
                      label="Tasa de interés"
                      value={`${preview.tasaInteres}%`}
                      colors={colors}
                    />
                  )}
                  {efectivoEstimado != null && (
                    <ResumenRow
                      icon={fondosInsuficientes ? "alert-circle" : "wallet-outline"}
                      label="Efectivo estimado en caja"
                      value={formatCurrency(efectivoEstimado)}
                      warn={fondosInsuficientes}
                      isLast
                      colors={colors}
                    />
                  )}
                </View>

                {fondosInsuficientes && (
                  <View
                    style={[
                      styles.bloqueoBox,
                      { backgroundColor: colors.warning + "18" },
                    ]}
                  >
                    <Ionicons
                      name="warning"
                      size={scale(14)}
                      color={colors.warning}
                    />
                    <Text
                      style={[styles.bloqueoText, { color: colors.warning }]}
                    >
                      El efectivo en caja podría no alcanzar para cubrir el
                      desembolso neto.
                    </Text>
                  </View>
                )}

                <View style={styles.actions}>
                  <AppButton
                    title="Atrás"
                    onPress={() => setConfirmarPaso(false)}
                    variant="ghost"
                    style={{ flex: 1 }}
                  />
                  <AppButton
                    title="Confirmar renovación"
                    onPress={handleRenovar}
                    loading={renovarMutation.isPending}
                    style={{ flex: 1 }}
                  />
                </View>
              </>
            ) : (
              <>
                <View
                  style={[
                    styles.contextBox,
                    { backgroundColor: colors.surface },
                  ]}
                >
                  <Text
                    style={[
                      styles.contextText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Cuotas pendientes:{" "}
                    <Text
                      style={{
                        color: colors.text,
                        fontWeight: FontWeight.bold,
                      }}
                    >
                      {cuotasPendientes.length}
                    </Text>
                    {"  ·  "}Tasa actual:{" "}
                    <Text
                      style={{
                        color: colors.text,
                        fontWeight: FontWeight.bold,
                      }}
                    >
                      {prestamo.tasaInteres}%
                    </Text>
                  </Text>
                  {saldoAnterior && (
                    <Text
                      style={[
                        styles.contextText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Saldo anterior aplicado:{" "}
                      <Text
                        style={{
                          color: colors.text,
                          fontWeight: FontWeight.bold,
                        }}
                      >
                        {formatCurrency(saldoAnterior.total)}
                      </Text>
                    </Text>
                  )}
                  <Text
                    style={[
                      styles.contextText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    El saldo anterior se aplica como parte del pago y solo se
                    entrega la diferencia en efectivo.
                  </Text>
                </View>

                {!network.isOnline && (
                  <View
                    style={[
                      styles.bloqueoBox,
                      { backgroundColor: colors.warning + "18" },
                    ]}
                  >
                    <Ionicons
                      name="cloud-offline-outline"
                      size={scale(14)}
                      color={colors.warning}
                    />
                    <Text
                      style={[styles.bloqueoText, { color: colors.warning }]}
                    >
                      La renovación requiere conexión a internet. Conéctate
                      para continuar.
                    </Text>
                  </View>
                )}

                {bloqueoRegla && (
                  <View
                    style={[
                      styles.bloqueoBox,
                      { backgroundColor: colors.error + "18" },
                    ]}
                  >
                    <Ionicons
                      name="lock-closed"
                      size={scale(14)}
                      color={colors.error}
                    />
                    <Text style={[styles.bloqueoText, { color: colors.error }]}>
                      {bloqueoRegla}
                    </Text>
                  </View>
                )}

                <AppInput
                  label="Monto del nuevo préstamo"
                  placeholder="Ej: 10000"
                  keyboardType="decimal-pad"
                  value={montoNuevo}
                  onChangeText={(v) => setMontoNuevo(sanitizeDecimal(v))}
                  hint={`Debe ser mayor al saldo anterior aplicado${
                    saldoAnterior
                      ? ` (${formatCurrency(saldoAnterior.total)})`
                      : ""
                  }`}
                />

                {/* Selector de modo: Rápido por defecto */}
                <View
                  style={[
                    styles.modeToggle,
                    { backgroundColor: colors.surface },
                  ]}
                >
                  <Pressable
                    onPress={() => cambiarModoRapido(false)}
                    style={[
                      styles.modeBtn,
                      !modoRapido && { backgroundColor: colors.primary },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Modo de cálculo normal"
                    accessibilityState={{ selected: !modoRapido }}
                  >
                    <Text
                      style={[
                        styles.modeBtnText,
                        {
                          color: !modoRapido ? "#FFFFFF" : colors.textSecondary,
                        },
                      ]}
                    >
                      Normal
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => cambiarModoRapido(true)}
                    style={[
                      styles.modeBtn,
                      modoRapido && { backgroundColor: colors.primary },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Modo de cálculo rápido"
                    accessibilityState={{ selected: modoRapido }}
                  >
                    <Text
                      style={[
                        styles.modeBtnText,
                        {
                          color: modoRapido ? "#FFFFFF" : colors.textSecondary,
                        },
                      ]}
                    >
                      Rápido
                    </Text>
                  </Pressable>
                </View>
                <Text
                  style={[styles.modeHint, { color: colors.textTertiary }]}
                >
                  {modoRapido
                    ? "Defines el pago o la ganancia; la tasa se calcula sola."
                    : "Defines la tasa de interés y el número de cuotas."}
                </Text>

                {modoRapido ? (
                  <>
                    <View style={styles.subToggle}>
                      <Pressable
                        onPress={() => cambiarModoCalculo("PAGO")}
                        style={[
                          styles.subBtn,
                          { borderColor: colors.border },
                          modoCalculo === "PAGO" && {
                            backgroundColor: colors.primary,
                          },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel="Calcular desde pago por período"
                        accessibilityState={{ selected: modoCalculo === "PAGO" }}
                      >
                        <Text
                          style={[
                            styles.subBtnText,
                            {
                              color:
                                modoCalculo === "PAGO"
                                  ? "#FFFFFF"
                                  : colors.textSecondary,
                            },
                          ]}
                        >
                          Pago por período
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => cambiarModoCalculo("GANANCIA")}
                        style={[
                          styles.subBtn,
                          { borderColor: colors.border },
                          modoCalculo === "GANANCIA" && {
                            backgroundColor: colors.primary,
                          },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel="Calcular desde ganancia deseada"
                        accessibilityState={{
                          selected: modoCalculo === "GANANCIA",
                        }}
                      >
                        <Text
                          style={[
                            styles.subBtnText,
                            {
                              color:
                                modoCalculo === "GANANCIA"
                                  ? "#FFFFFF"
                                  : colors.textSecondary,
                            },
                          ]}
                        >
                          Ganancia deseada
                        </Text>
                      </Pressable>
                    </View>

                    {modoCalculo === "PAGO" ? (
                      <AppInput
                        label={`Pago ${DURACION_LABEL[frecuenciaEfectiva]}`}
                        placeholder="Ej: 500"
                        keyboardType="decimal-pad"
                        value={pagoPorPeriodo}
                        onChangeText={(v) =>
                          setPagoPorPeriodo(sanitizeDecimal(v))
                        }
                      />
                    ) : (
                      <>
                        <AppInput
                          label="Ganancia deseada"
                          placeholder="Ej: 2000"
                          keyboardType="decimal-pad"
                          value={gananciaDeseada}
                          onChangeText={(v) =>
                            setGananciaDeseada(sanitizeDecimal(v))
                          }
                        />
                        {preview && !preview.error && (
                          <View
                            style={[
                              styles.calcDisplay,
                              {
                                backgroundColor: colors.infoLight,
                                borderColor: colors.info,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.calcLabel,
                                { color: colors.info },
                              ]}
                            >
                              Pago calculado
                            </Text>
                            <Text
                              style={[styles.calcValue, { color: colors.info }]}
                            >
                              {formatCurrency(preview.nuevaCuota)}
                            </Text>
                          </View>
                        )}
                      </>
                    )}
                    <AppInput
                      label={`Duración (${DURACION_LABEL[frecuenciaEfectiva]})`}
                      placeholder="Ej: 12"
                      keyboardType="numeric"
                      value={duracion}
                      onChangeText={(v) => setDuracion(sanitizeInteger(v))}
                      hint="Máximo 3650 períodos"
                    />
                  </>
                ) : (
                  <>
                    <AppInput
                      label="Tasa de interés (%)"
                      placeholder="Ej: 3.5"
                      keyboardType="decimal-pad"
                      value={tasa}
                      onChangeText={(v) => setTasa(sanitizeDecimal(v))}
                      hint="Entre 0.1 y 100"
                    />
                    <AppInput
                      label="Número de cuotas"
                      placeholder="Ej: 12"
                      keyboardType="numeric"
                      value={cuotas}
                      onChangeText={(v) => setCuotas(sanitizeInteger(v))}
                      hint="Máximo 3650 cuotas"
                    />
                  </>
                )}
                <PickerField
                  label="Frecuencia de pago (opcional)"
                  value={frecuencia}
                  options={FRECUENCIAS}
                  onSelect={(v) => setFrecuencia(v as FrecuenciaPago)}
                  hint={`Actual: ${
                    FREQ_LABEL[prestamo.frecuenciaPago] ??
                    prestamo.frecuenciaPago
                  }`}
                />
                <DatePickerField
                  label="Fecha de inicio (opcional)"
                  value={fechaInicio}
                  onChange={setFechaInicio}
                />
                <AppInput
                  label="Motivo (opcional)"
                  placeholder="Ej: Cliente pide capital adicional"
                  value={motivo}
                  onChangeText={setMotivo}
                  multiline
                  numberOfLines={2}
                />

                {preview && !preview.error && liquidacion && (
                  <View
                    style={[
                      styles.previewBox,
                      { backgroundColor: colors.surface },
                    ]}
                  >
                    <Text
                      style={[
                        styles.previewTitle,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Resumen de la renovación
                    </Text>
                    <Text style={[styles.previewText, { color: colors.text }]}>
                      Saldo anterior aplicado:{" "}
                      <Text style={{ fontWeight: FontWeight.bold }}>
                        {formatCurrency(liquidacion.total)}
                      </Text>
                    </Text>
                    <Text
                      style={[
                        styles.previewText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Capital: {formatCurrency(liquidacion.capital)}
                      {liquidacion.interes > 0
                        ? ` · Interés: ${formatCurrency(liquidacion.interes)}`
                        : ""}
                      {liquidacion.mora > 0
                        ? ` · Mora: ${formatCurrency(liquidacion.mora)}`
                        : ""}
                    </Text>
                    <Text style={[styles.previewText, { color: colors.text }]}>
                      Desembolso neto:{" "}
                      <Text
                        style={{
                          fontWeight: FontWeight.bold,
                          color: colors.primary,
                        }}
                      >
                        {formatCurrency(preview.desembolsoNeto)}
                      </Text>
                      {"  ·  "}Nueva cuota:{" "}
                      <Text style={{ fontWeight: FontWeight.bold }}>
                        {formatCurrency(preview.nuevaCuota)}
                      </Text>
                    </Text>
                    {preview.modoRapido && (
                      <Text
                        style={[
                          styles.previewText,
                          { color: colors.textSecondary },
                        ]}
                      >
                        Total a cobrar:{" "}
                        <Text style={{ fontWeight: FontWeight.bold }}>
                          {formatCurrency(preview.montoTotal)}
                        </Text>{" "}
                        · Modo rápido
                      </Text>
                    )}
                  </View>
                )}
                {preview?.error && (
                  <View
                    style={[
                      styles.bloqueoBox,
                      { backgroundColor: colors.error + "18" },
                    ]}
                  >
                    <Ionicons
                      name="warning"
                      size={scale(14)}
                      color={colors.error}
                    />
                    <Text style={[styles.bloqueoText, { color: colors.error }]}>
                      {preview.error}
                    </Text>
                  </View>
                )}
                {fondosInsuficientes && (
                  <View
                    style={[
                      styles.bloqueoBox,
                      { backgroundColor: colors.warning + "18" },
                    ]}
                  >
                    <Ionicons
                      name="cash-outline"
                      size={scale(14)}
                      color={colors.warning}
                    />
                    <Text
                      style={[styles.bloqueoText, { color: colors.warning }]}
                    >
                      Efectivo estimado en caja:{" "}
                      {formatCurrency(efectivoEstimado!)}. Podría no alcanzar
                      para cubrir el desembolso neto.
                    </Text>
                  </View>
                )}

                {formularioTocado &&
                  razonesValidacion.length > 0 &&
                  !bloqueoRegla && (
                    <View
                      style={[
                        styles.bloqueoBox,
                        { backgroundColor: colors.infoLight },
                      ]}
                    >
                      <Ionicons
                        name="information-circle"
                        size={scale(14)}
                        color={colors.info}
                      />
                      <View style={styles.bloqueoMultiText}>
                        {razonesValidacion.map((razon) => (
                          <Text
                            key={razon}
                            style={[
                              styles.bloqueoText,
                              { color: colors.info },
                            ]}
                          >
                            • {razon}
                          </Text>
                        ))}
                      </View>
                    </View>
                  )}

                <View style={styles.actions}>
                  <AppButton
                    title="Cancelar"
                    onPress={handleClose}
                    variant="ghost"
                    style={{ flex: 1 }}
                  />
                  <AppButton
                    title="Continuar"
                    onPress={handleContinuar}
                    disabled={
                      !network.isOnline ||
                      !inputsValidos ||
                      !!bloqueoRegla ||
                      !!preview?.error ||
                      !preview
                    }
                    style={{ flex: 1 }}
                  />
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    maxHeight: "90%",
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  title: { fontSize: FontSize.md, fontWeight: FontWeight.bold, flex: 1 },
  closeButton: {
    marginLeft: "auto",
  },
  body: { padding: Spacing.md },
  modeToggle: {
    flexDirection: "row",
    borderRadius: BorderRadius.md,
    padding: scale(2),
    marginBottom: Spacing.xs,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
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
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  subBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    alignItems: "center",
  },
  subBtnText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  calcDisplay: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
    flexDirection: "row",
    alignItems: "center",
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
  heroBox: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  heroLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  heroValue: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    marginTop: scale(2),
  },
  heroNote: { fontSize: FontSize.xs, marginTop: scale(2) },
  rowsCard: {
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  resumenRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  resumenRowText: {
    flex: 1,
  },
  resumenRowLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  resumenRowSub: {
    fontSize: FontSize.xs,
    marginTop: scale(1),
  },
  resumenRowValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    textAlign: "right",
  },
  actions: { flexDirection: "row", gap: Spacing.sm, flexShrink: 0 },
});

export default RenovarModal;
