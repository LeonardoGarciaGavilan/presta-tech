import { useCallback, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRenovarPrestamo } from "@/hooks/use-prestamos";
import { AppButton } from "@/components/ui/app-button";
import { AppInput } from "@/components/ui/app-input";
import PickerField from "@/components/ui/picker-field";
import DatePickerField from "@/components/ui/date-picker-field";
import { useTheme } from "@/components/ui/theme-provider";
import { useToast } from "@/components/ui/toast";
import { getConfiguracion } from "@/db/config-db";
import { calcularRenovacionLocal } from "@/utils/amortizacion";
import { formatCurrency } from "@/utils/formatters";
import type { FrecuenciaPago, Prestamo } from "@/types/prestamo.types";
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

const RenovarModal = ({
  visible,
  onClose,
  prestamo,
  onSuccess,
}: RenovarModalProps) => {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const renovarMutation = useRenovarPrestamo();
  const [montoNuevo, setMontoNuevo] = useState("");
  const [tasa, setTasa] = useState("");
  const [cuotas, setCuotas] = useState("");
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

  // Preview vivo con la misma matemática que validará el backend.
  const preview = useMemo(() => {
    if (!visible) return null;
    const montoNum = parseFloat(montoNuevo);
    const tasaNum = parseFloat(tasa);
    const cuotasNum = parseInt(cuotas, 10);
    let incluirInteres: boolean | undefined;
    let pct: number | undefined;
    try {
      const config = getConfiguracion();
      incluirInteres = config?.incluirInteresEnRenovacion;
      pct = config?.porcentajeMaximoSaldoAplicado;
    } catch {
      // sin config cacheada: defaults del backend
    }
    if (!(montoNum > 0) || !(tasaNum > 0) || !(cuotasNum > 0)) return null;
    try {
      return calcularRenovacionLocal(
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
    } catch {
      return null;
    }
  }, [visible, montoNuevo, tasa, cuotas, frecuencia, fechaInicio, prestamo]);

  const inputsValidos =
    !!parseFloat(montoNuevo) &&
    parseFloat(montoNuevo) > 0 &&
    !!parseFloat(tasa) &&
    parseFloat(tasa) >= 0.1 &&
    parseFloat(tasa) <= 100 &&
    !!parseInt(cuotas, 10) &&
    parseInt(cuotas, 10) > 0;

  const handleContinuar = useCallback(() => {
    if (bloqueoRegla) {
      showToast(bloqueoRegla, "error");
      return;
    }
    if (preview?.error) {
      showToast(preview.error, "error");
      return;
    }
    setConfirmarPaso(true);
  }, [bloqueoRegla, preview, showToast]);

  const handleRenovar = useCallback(async () => {
    const montoNum = parseFloat(montoNuevo);
    const tasaNum = parseFloat(tasa);
    const cuotasNum = parseInt(cuotas, 10);
    if (!montoNum || !tasaNum || !cuotasNum) return;
    try {
      await renovarMutation.mutateAsync({
        id: prestamo.id,
        data: {
          montoNuevo: montoNum,
          tasaInteres: tasaNum,
          numeroCuotas: cuotasNum,
          ...(frecuencia ? { frecuenciaPago: frecuencia } : {}),
          ...(fechaInicio ? { fechaInicio } : {}),
          ...(motivo.trim() ? { motivo: motivo.trim() } : {}),
        },
      });
      showToast("Préstamo renovado exitosamente", "success");
      onSuccess?.();
      onClose();
    } catch (err: any) {
      showToast(err?.message || "Error al renovar el préstamo", "error");
    }
  }, [
    montoNuevo,
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
  ]);

  const handleClose = useCallback(() => {
    setConfirmarPaso(false);
    onClose();
  }, [onClose]);

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
            <Text style={[styles.title, { color: "#FFFFFF" }]}>
              Renovar Préstamo
            </Text>
          </View>
          <ScrollView
            style={styles.body}
            keyboardShouldPersistTaps="handled"
            bounces={false}
            contentContainerStyle={{ paddingBottom: Spacing.sm }}
          >
            {confirmarPaso && preview ? (
              <>
                <View
                  style={[
                    styles.contextBox,
                    { backgroundColor: colors.surface },
                  ]}
                >
                  <Text
                    style={[
                      styles.previewTitle,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Confirmación de renovación
                  </Text>
                  <Text
                    style={[
                      styles.contextText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Se liquida el préstamo actual aplicando su saldo al nuevo:
                  </Text>
                  <Text style={[styles.previewText, { color: colors.text }]}>
                    Saldo anterior aplicado:{" "}
                    <Text style={{ fontWeight: FontWeight.bold }}>
                      {formatCurrency(liquidacion!.total)}
                    </Text>
                    {"  ·  "}Capital: {formatCurrency(liquidacion!.capital)}
                    {preview.liquidacion.interes > 0
                      ? `  ·  Interés: ${formatCurrency(preview.liquidacion.interes)}`
                      : ""}
                    {preview.liquidacion.mora > 0
                      ? `  ·  Mora: ${formatCurrency(preview.liquidacion.mora)}`
                      : ""}
                  </Text>
                  <Text
                    style={[
                      styles.previewText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Desembolso neto en efectivo:{" "}
                    <Text
                      style={{
                        fontWeight: FontWeight.bold,
                        color: colors.primary,
                      }}
                    >
                      {formatCurrency(preview.desembolsoNeto)}
                    </Text>{" "}
                    (requiere caja abierta)
                  </Text>
                  <Text
                    style={[
                      styles.contextText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Nuevo préstamo: {formatCurrency(parseFloat(montoNuevo))} ·{" "}
                    {parseInt(cuotas, 10)} cuota(s) de{" "}
                    {formatCurrency(preview.nuevaCuota)} · Tasa{" "}
                    {parseFloat(tasa)}%
                  </Text>
                </View>
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
                  onChangeText={setMontoNuevo}
                  hint="Debe ser mayor al saldo anterior aplicado"
                />
                <AppInput
                  label="Tasa de interés (%)"
                  placeholder="Ej: 3.5"
                  keyboardType="decimal-pad"
                  value={tasa}
                  onChangeText={setTasa}
                  hint="Entre 0.1 y 100"
                />
                <AppInput
                  label="Número de cuotas"
                  placeholder="Ej: 12"
                  keyboardType="numeric"
                  value={cuotas}
                  onChangeText={setCuotas}
                />
                <PickerField
                  label="Frecuencia de pago (opcional)"
                  value={frecuencia}
                  options={FRECUENCIAS}
                  onSelect={(v) => setFrecuencia(v as FrecuenciaPago)}
                  hint={`Actual: ${prestamo.frecuenciaPago}`}
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
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  title: { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  body: { maxHeight: 480, padding: Spacing.md },
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
  previewBox: {
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
    gap: 2,
  },
  previewTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  previewText: { fontSize: FontSize.xs },
  actions: { flexDirection: "row", gap: Spacing.sm, flexShrink: 0 },
});

export default RenovarModal;
