import { memo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/components/ui/theme-provider";
import { formatCurrency, formatDateTime } from "@/utils/formatters";
import {
  BorderRadius,
  FontSize,
  FontWeight,
  Spacing,
  scale,
} from "@/constants/theme";

export interface RegistroRenovacion {
  fecha?: string;
  usuarioId?: string;
  motivo?: string | null;
  prestamoAnteriorId?: string;
  cuotasPendientesAntes?: number;
  cuotasLiquidadas?: Record<string, any>[];
  capitalAplicado?: number;
  interesAplicado?: number;
  moraAplicada?: number;
  saldoAplicado?: number;
  montoNuevo?: number;
  tasaInteres?: number;
  nuevasCuotas?: number;
  frecuenciaPago?: string;
  desembolsoNeto?: number;
  nuevaCuota?: number;
  nuevoMontoTotal?: number;
}

interface HistorialRenovacionProps {
  historial: any | null | undefined;
}

function esArrayHistorial(h: any): h is RegistroRenovacion[] {
  return Array.isArray(h) && h.length > 0;
}

const HistorialRenovacionBase = ({ historial }: HistorialRenovacionProps) => {
  const { colors } = useTheme();
  const [expandido, setExpandido] = useState(false);

  if (!esArrayHistorial(historial)) return null;

  const registros = [...historial].reverse(); // más reciente primero

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Pressable
        onPress={() => setExpandido((v) => !v)}
        style={styles.header}
        accessibilityRole="button"
        accessibilityLabel="Historial de renovaciones"
      >
        <Ionicons
          name="refresh-circle-outline"
          size={scale(16)}
          color={colors.teal}
        />
        <Text style={[styles.title, { color: colors.text }]}>
          Historial de renovaciones ({historial.length})
        </Text>
        <Ionicons
          name={expandido ? "chevron-up" : "chevron-down"}
          size={scale(16)}
          color={colors.textTertiary}
        />
      </Pressable>

      {expandido &&
        registros.map((r, idx) => (
          <View
            key={`${r.fecha ?? "ren"}-${idx}`}
            style={[styles.registro, { borderBottomColor: colors.borderLight }]}
          >
            <View style={styles.registroHeader}>
              <Text style={[styles.fecha, { color: colors.textTertiary }]}>
                {formatDateTime(r.fecha ?? null)}
              </Text>
              <Text style={[styles.saldo, { color: colors.text }]}>
                Aplicado: {formatCurrency(r.saldoAplicado ?? 0)}
              </Text>
            </View>
            <Text style={[styles.linea, { color: colors.textSecondary }]}>
              Liquidación: capital {formatCurrency(r.capitalAplicado ?? 0)}
              {(r.interesAplicado ?? 0) > 0
                ? ` · interés ${formatCurrency(r.interesAplicado ?? 0)}`
                : ""}
              {(r.moraAplicada ?? 0) > 0
                ? ` · mora ${formatCurrency(r.moraAplicada ?? 0)}`
                : ""}
            </Text>
            <Text style={[styles.linea, { color: colors.textSecondary }]}>
              Nuevo préstamo: {formatCurrency(r.montoNuevo ?? 0)} en{" "}
              {r.nuevasCuotas ?? "—"} cuota(s)
              {(r.tasaInteres ?? 1) === 0 ? " · Modo rápido" : ""}
              {" · "}neto entregado {formatCurrency(r.desembolsoNeto ?? 0)}
            </Text>
            {(r.tasaInteres ?? 1) === 0 && r.nuevoMontoTotal != null && (
              <Text style={[styles.linea, { color: colors.textSecondary }]}>
                Total a cobrar:{" "}
                <Text style={{ fontWeight: FontWeight.bold }}>
                  {formatCurrency(r.nuevoMontoTotal)}
                </Text>
              </Text>
            )}
            {!!r.cuotasLiquidadas?.length && (
              <Text style={[styles.linea, { color: colors.textTertiary }]}>
                {r.cuotasLiquidadas.length} cuota(s) liquidada(s) del préstamo
                anterior
              </Text>
            )}
            {r.motivo ? (
              <Text
                style={[styles.linea, { color: colors.textSecondary }]}
                numberOfLines={2}
              >
                Motivo: {r.motivo}
              </Text>
            ) : null}
          </View>
        ))}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  title: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, flex: 1 },
  registro: {
    paddingTop: Spacing.sm,
    marginTop: Spacing.xs,
    borderTopWidth: 1,
    gap: 2,
  },
  registroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  fecha: { fontSize: scale(10) },
  saldo: { fontSize: scale(10), fontWeight: FontWeight.bold },
  linea: { fontSize: scale(10) },
});

export default memo(HistorialRenovacionBase);
