import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ScreenContainer } from "@/components/ui/screen-container";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  usePrestamo,
  useCancelarPrestamo,
  useDesembolsarPrestamo,
  useCambiarEstadoPrestamo,
} from "@/hooks/use-prestamos";
import { usePagosPendientesPrestamo } from "@/hooks/use-offline-queue";
import { useConfiguracion } from "@/hooks/use-configuracion";
import { AppButton } from "@/components/ui/app-button";
import ActionConfirmModal from "@/components/ui/action-confirm-modal";
import EmptyState from "@/components/ui/empty-state";
import LoadingScreen from "@/components/ui/loading-screen";
import { SkeletonCard, SkeletonKPIGrid } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useAuthStore } from "@/store/auth.store";
import { usePermisos } from "@/permisos/use-permisos";
import {
  FontSize,
  Fonts,
  FontWeight,
  IoniconsName,
  Spacing,
  BorderRadius,
  Shadows,
  scale,
} from "@/constants/theme";
import {
  ESTADO_CONFIG,
  ACCIONES_FLOW_CONFIG,
} from "@/constants/prestamos.constants";
import { formatCurrency, formatDate, formatDateTime } from "@/utils/formatters";
import type { ApiError } from "@/types/api.types";
import type {
  EstadoPrestamo,
  Cuota,
  Pago,
  FrecuenciaPago,
} from "@/types/prestamo.types";
import type { OfflineQueueItem } from "@/types/offline.types";
import { useTheme } from "@/components/ui/theme-provider";
import DesembolsoModal from "@/components/prestamos/desembolso-modal";
import RefinanciarModal from "@/components/prestamos/refinanciar-modal";
import RenovarModal from "@/components/prestamos/renovar-modal";
import HistorialRenovacion from "@/components/prestamos/historial-renovacion";
import HistorialRefinanciamiento from "@/components/prestamos/historial-refinanciamiento";

const FLOW_ACCION_CONFIG = ACCIONES_FLOW_CONFIG;

const InfoItemBase = ({ label, value }: { label: string; value: string }) => {
  const { colors } = useTheme();
  return (
    <View style={infoStyles.item}>
      <Text style={[infoStyles.label, { color: colors.textTertiary }]}>
        {label}
      </Text>
      <Text style={infoStyles.value} numberOfLines={2}>
        {value || "—"}
      </Text>
    </View>
  );
};

const InfoItem = memo(InfoItemBase);
InfoItem.displayName = "InfoItem";

const infoStyles = StyleSheet.create({
  item: { marginBottom: Spacing.xs },
  label: {
    fontSize: scale(10),
    fontWeight: FontWeight.medium,
    textTransform: "uppercase",
    letterSpacing: scale(0.5),
  },
  value: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    marginTop: scale(1),
  },
});

const CuotaBadgeBase = ({
  pagada,
  vencida,
}: {
  pagada: boolean;
  vencida: boolean;
}) => {
  const { colors } = useTheme();
  if (pagada) {
    return (
      <Text
        style={[
          badgeStyles.badge,
          {
            backgroundColor: colors.successLight,
            borderColor: colors.success,
            color: colors.success,
          },
        ]}
      >
        Pagada
      </Text>
    );
  }
  if (vencida) {
    return (
      <Text
        style={[
          badgeStyles.badge,
          {
            backgroundColor: colors.errorLight,
            borderColor: colors.error,
            color: colors.error,
          },
        ]}
      >
        Vencida
      </Text>
    );
  }
  return (
    <Text
      style={[
        badgeStyles.badge,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          color: colors.textTertiary,
        },
      ]}
    >
      Pendiente
    </Text>
  );
};

const CuotaBadge = memo(CuotaBadgeBase);
CuotaBadge.displayName = "CuotaBadge";

const badgeStyles = StyleSheet.create({
  badge: {
    fontSize: scale(10),
    fontWeight: FontWeight.bold,
    paddingHorizontal: Spacing.sm,
    paddingVertical: scale(2),
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    overflow: "hidden",
  },
});

const SyncPagoBanner = ({
  pendientes,
  fallidos,
}: {
  pendientes: OfflineQueueItem[];
  fallidos: OfflineQueueItem[];
}) => {
  const { colors } = useTheme();
  if (pendientes.length === 0 && fallidos.length === 0) return null;

  if (fallidos.length > 0) {
    const primerError = fallidos[0].lastError;
    return (
      <View
        style={[
          bannerStyles.banner,
          { backgroundColor: colors.error, borderColor: colors.error },
        ]}
        accessibilityRole="alert"
      >
        <Ionicons
          name="cloud-offline-outline"
          size={scale(14)}
          color="#FFFFFF"
        />
        <Text style={bannerStyles.text}>
          Pago no sincronizado
          {fallidos.length > 1 ? ` (${fallidos.length})` : ""}
          {primerError ? ` — ${primerError}` : ""}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        bannerStyles.banner,
        { backgroundColor: colors.warning, borderColor: colors.warning },
      ]}
      accessibilityRole="alert"
    >
      <Ionicons name="cloud-upload-outline" size={scale(14)} color="#FFFFFF" />
      <Text style={bannerStyles.text}>
        Pago pendiente de sincronización
        {pendientes.length > 1 ? ` (${pendientes.length})` : ""}
      </Text>
    </View>
  );
};

const bannerStyles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  text: {
    color: "#FFFFFF",
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    flex: 1,
  },
});

export default function PrestamoDetalleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colorScheme, colors } = useTheme();
  const user = useAuthStore((state) => state.user);
  const userId = user?.id;
  const { tienePermiso } = usePermisos();
  const { data: configuracion } = useConfiguracion();
  const puedeRevisar = tienePermiso("prestamos:revisar");
  const puedeAprobar = tienePermiso("prestamos:aprobar");
  const { showToast } = useToast();

  const {
    data: prestamo,
    isLoading,
    error: queryError,
    refetch,
  } = usePrestamo(id!);
  const { data: pagosPendientes } = usePagosPendientesPrestamo(id);
  const pagosPorSincronizar = (pagosPendientes ?? []).filter(
    (i) => i.status === "pending" || i.status === "syncing",
  );
  const pagosFallidos = (pagosPendientes ?? []).filter(
    (i) => i.status === "failed",
  );
  const { mutateAsync: cancelarMutation, isPending: isCancelando } =
    useCancelarPrestamo();
  const { mutateAsync: desembolsarMutation, isPending: isDesembolsando } =
    useDesembolsarPrestamo();
  const cambiarEstadoMutation = useCambiarEstadoPrestamo();

  const [tab, setTab] = useState<"cuotas" | "pagos">("cuotas");
  const [filtroCuotas, setFiltroCuotas] = useState<string>("todas");
  const [showDesembolsoModal, setShowDesembolsoModal] = useState(false);
  const [showCancelarConfirm, setShowCancelarConfirm] = useState(false);
  const [showRefinanciarModal, setShowRefinanciarModal] = useState(false);
  const [showRenovarModal, setShowRenovarModal] = useState(false);
  const [showFlowModal, setShowFlowModal] = useState(false);
  const [flowAccion, setFlowAccion] = useState<{
    accion: string;
    estado: string;
  } | null>(null);

  const cuotas = prestamo?.cuotas || [];
  const pagos = prestamo?.pagos || [];
  const cuotasPendientes = cuotas.filter((c) => !c.pagada);
  const cuotasPagadas = cuotas.filter((c) => c.pagada);
  const cuotasVencidas = cuotasPendientes.filter(
    (c) => new Date(c.fechaVencimiento) < new Date(),
  );
  const proximaCuota = [...cuotasPendientes].sort(
    (a, b) =>
      new Date(a.fechaVencimiento).getTime() -
      new Date(b.fechaVencimiento).getTime(),
  )[0];
  const progresoPorc =
    cuotas.length > 0
      ? Math.round((cuotasPagadas.length / cuotas.length) * 100)
      : 0;
  // Whitelist alineada con TRANSICIONES del backend: solo se puede cancelar
  // un préstamos con dinero ya desembolsado (ACTIVO/ATRASADO). Para descartar
  // solicitudes pre-desembolso existe Rechazar; PAGADO/RECHAZADO/RENOVADO/
  // CANCELADO son terminales y no muestran acciones.
  const puedeCancelar =
    prestamo &&
    ["ACTIVO", "ATRASADO"].includes(prestamo.estado) &&
    tienePermiso("prestamos:cancelar");
  // El switch maestro de refinanciamiento oculta el botón (decisión
  // empresa-wide); las reglas paramétricas se explican dentro del modal.
  // Sin config cacheada no se oculta: el servidor es la fuente de verdad.
  const puedeRefinanciar =
    prestamo &&
    ["ACTIVO", "ATRASADO"].includes(prestamo.estado) &&
    configuracion?.permitirRefinanciamiento !== false &&
    tienePermiso("prestamos:refinanciar");
  // El switch maestro de renovación oculta el botón (decisión empresa-wide);
  // las reglas paramétricas se explican dentro del modal. Sin config cacheada
  // no se oculta: el servidor es la fuente de verdad.
  const puedeRenovar =
    prestamo &&
    ["ACTIVO", "ATRASADO"].includes(prestamo.estado) &&
    configuracion?.permitirRenovacion !== false &&
    tienePermiso("prestamos:renovar");
  const puedePagar =
    prestamo &&
    ["ACTIVO", "ATRASADO"].includes(prestamo.estado) &&
    tienePermiso("pagos:registrar");
  const puedeDesembolsar =
    prestamo?.estado === "APROBADO" &&
    (tienePermiso("prestamos:desembolsar") ||
      prestamo.solicitadoPor === userId);

  const cuotasFiltradas = useMemo(() => {
    if (filtroCuotas === "pendientes") return cuotasPendientes;
    if (filtroCuotas === "vencidas") return cuotasVencidas;
    if (filtroCuotas === "pagadas") return cuotasPagadas;
    return cuotas;
  }, [filtroCuotas, cuotas, cuotasPendientes, cuotasVencidas, cuotasPagadas]);

  const FILTROS_CUOTAS = [
    { id: "todas", label: "Todas", count: cuotas.length },
    { id: "pendientes", label: "Pendientes", count: cuotasPendientes.length },
    {
      id: "vencidas",
      label: "Vencidas",
      count: cuotasVencidas.length,
      color: colors.error,
    },
    {
      id: "pagadas",
      label: "Pagadas",
      count: cuotasPagadas.length,
      color: colors.success,
    },
  ];

  const handleCancelar = useCallback(
    async (motivo?: string) => {
      if (!prestamo) return;
      try {
        await cancelarMutation({ id: prestamo.id, motivo: motivo ?? "" });
        setShowCancelarConfirm(false);
        showToast("Préstamo cancelado exitosamente", "success");
        refetch();
      } catch (err) {
        const { message } = err as ApiError;
        showToast(message || "Error al cancelar el préstamo", "error");
      }
    },
    [prestamo, cancelarMutation, showToast, refetch],
  );

  const handleDesembolsar = useCallback(async () => {
    if (!prestamo) return;
    try {
      await desembolsarMutation(prestamo.id);
      setShowDesembolsoModal(false);
      showToast("Préstamo desembolsado exitosamente", "success");
      refetch();
    } catch (err) {
      const { message } = err as ApiError;
      showToast(message || "Error al desembolsar", "error");
      setShowDesembolsoModal(false);
    }
  }, [prestamo, desembolsarMutation, showToast, refetch]);

  const ejecutarFlowAccion = useCallback(
    async (motivo?: string) => {
      if (!flowAccion || !prestamo) return;
      const { accion, estado } = flowAccion;
      try {
        await cambiarEstadoMutation.mutateAsync({
          id: prestamo.id,
          data: { estado: estado as EstadoPrestamo, motivo },
        });
        setShowFlowModal(false);
        setFlowAccion(null);
        showToast(`Estado actualizado a ${estado}`, "success");
        refetch();
      } catch (err: any) {
        setShowFlowModal(false);
        setFlowAccion(null);
        showToast(err?.message || "Error al cambiar estado", "error");
      }
    },
    [flowAccion, prestamo, cambiarEstadoMutation, showToast, refetch],
  );

  if (isLoading) {
    return (
      <ScreenContainer
        style={[styles.screen, { backgroundColor: colors.background }]}
      >
        <View style={styles.skeletonContainer}>
          <SkeletonCard lines={2} />
          <SkeletonCard lines={4} style={{ marginTop: scale(16) }} />
          <SkeletonCard lines={6} style={{ marginTop: scale(16) }} />
        </View>
      </ScreenContainer>
    );
  }

  if (queryError && !prestamo) {
    return (
      <ScreenContainer
        style={[styles.screen, { backgroundColor: colors.background }]}
      >
        <EmptyState
          icon="alert-circle-outline"
          title="Préstamo no encontrado"
          subtitle={
            queryError instanceof Error
              ? queryError.message
              : "Error al cargar el préstamo"
          }
          actionLabel="Volver"
          onAction={() => router.back()}
        />
      </ScreenContainer>
    );
  }

  if (!prestamo) return null;

  const cliente = prestamo.cliente;
  const estadoCfg = ESTADO_CONFIG[prestamo.estado] || ESTADO_CONFIG.ACTIVO;
  const flowCfg = flowAccion ? FLOW_ACCION_CONFIG[flowAccion.accion] : null;
  const cancelarCfg = FLOW_ACCION_CONFIG["CANCELADO"];

  return (
    <ScreenContainer
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={scale(24)} color={colors.text} />
        </Pressable>
        <View style={styles.headerInfo}>
          <Text
            style={[styles.headerTitle, { color: colors.text }]}
            numberOfLines={1}
          >
            Detalle del Préstamo
          </Text>
          <Text style={[styles.headerSub, { color: colors.textTertiary }]}>
            #{prestamo.id.slice(0, 8)}
          </Text>
        </View>
        <View style={styles.headerBadges}>
          {prestamo.refinanciado && (
            <View
              style={[
                styles.refinanciadoBadge,
                { backgroundColor: colors.infoLight ?? colors.borderLight },
              ]}
              accessibilityRole="text"
              accessibilityLabel={`Refinanciado ${prestamo.vecesRefinanciado} veces`}
            >
              <Ionicons
                name="git-branch"
                size={scale(12)}
                color={colors.info}
              />
              <Text
                style={[styles.refinanciadoBadgeText, { color: colors.info }]}
              >
                Refinanciado
                {prestamo.vecesRefinanciado > 1
                  ? ` ×${prestamo.vecesRefinanciado}`
                  : ""}
              </Text>
            </View>
          )}
          {prestamo.origen === "RENOVACION" && (
            <View
              style={[
                styles.refinanciadoBadge,
                { backgroundColor: colors.tealLight },
              ]}
              accessibilityRole="text"
              accessibilityLabel="Nació de una renovación"
            >
              <Ionicons
                name="refresh-circle"
                size={scale(12)}
                color={colors.teal}
              />
              <Text style={[styles.refinanciadoBadgeText, { color: colors.teal }]}>
                Renovación
                {(prestamo.cadenaRenovaciones ?? 0) > 1
                  ? ` ×${prestamo.cadenaRenovaciones}`
                  : ""}
              </Text>
            </View>
          )}
          <View
            style={[styles.estadoBadge, { backgroundColor: estadoCfg.bg }]}
            accessibilityRole="text"
            accessibilityLabel={`Estado: ${estadoCfg.label}`}
          >
            <Ionicons
              name={estadoCfg.icon as IoniconsName}
              size={scale(12)}
              color={estadoCfg.color}
            />
            <Text style={[styles.estadoBadgeText, { color: estadoCfg.color }]}>
              {estadoCfg.label}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <SyncPagoBanner
          pendientes={pagosPorSincronizar}
          fallidos={pagosFallidos}
        />
        {/* Action buttons */}
        <View style={styles.actionRow}>
          {/* Flow actions: Revisar / Aprobar / Rechazar */}
          {prestamo.estado === "SOLICITADO" && puedeRevisar && (
            <>
              <Pressable
                onPress={() => {
                  setFlowAccion({
                    accion: "EN_REVISION",
                    estado: "EN_REVISION",
                  });
                  setShowFlowModal(true);
                }}
                style={[styles.actionButton, { backgroundColor: colors.info }]}
                accessibilityRole="button"
                accessibilityLabel="Revisar préstamo"
              >
                <Ionicons
                  name="search-outline"
                  size={scale(16)}
                  color="#FFFFFF"
                />
                <Text style={styles.actionButtonText}>Revisar</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setFlowAccion({ accion: "RECHAZADO", estado: "RECHAZADO" });
                  setShowFlowModal(true);
                }}
                style={[styles.actionButton, { backgroundColor: colors.error }]}
                accessibilityRole="button"
                accessibilityLabel="Rechazar préstamo"
              >
                <Ionicons
                  name="close-circle-outline"
                  size={scale(16)}
                  color="#FFFFFF"
                />
                <Text style={styles.actionButtonText}>Rechazar</Text>
              </Pressable>
            </>
          )}
          {prestamo.estado === "EN_REVISION" &&
            (puedeRevisar || puedeAprobar) && (
              <>
                {puedeAprobar && (
                  <Pressable
                    onPress={() => {
                      setFlowAccion({ accion: "APROBADO", estado: "APROBADO" });
                      setShowFlowModal(true);
                    }}
                    style={[
                      styles.actionButton,
                      { backgroundColor: colors.success },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Aprobar préstamo"
                  >
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={scale(16)}
                      color="#FFFFFF"
                    />
                    <Text style={styles.actionButtonText}>Aprobar</Text>
                  </Pressable>
                )}
                {puedeRevisar && (
                  <Pressable
                    onPress={() => {
                      setFlowAccion({
                        accion: "RECHAZADO",
                        estado: "RECHAZADO",
                      });
                      setShowFlowModal(true);
                    }}
                    style={[
                      styles.actionButton,
                      { backgroundColor: colors.error },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Rechazar préstamo"
                  >
                    <Ionicons
                      name="close-circle-outline"
                      size={scale(16)}
                      color="#FFFFFF"
                    />
                    <Text style={styles.actionButtonText}>Rechazar</Text>
                  </Pressable>
                )}
              </>
            )}
          {prestamo.estado === "APROBADO" && puedeRevisar && (
            <>
              <Pressable
                onPress={() => {
                  setFlowAccion({ accion: "RECHAZADO", estado: "RECHAZADO" });
                  setShowFlowModal(true);
                }}
                style={[styles.actionButton, { backgroundColor: colors.error }]}
                accessibilityRole="button"
                accessibilityLabel="Rechazar préstamo"
              >
                <Ionicons
                  name="close-circle-outline"
                  size={scale(16)}
                  color="#FFFFFF"
                />
                <Text style={styles.actionButtonText}>Rechazar</Text>
              </Pressable>
            </>
          )}

          {/* Registrar Pago */}
          {puedePagar && (
            <Pressable
              onPress={() =>
                router.push(`/caja/pago?prestamoId=${prestamo.id}`)
              }
              style={[styles.actionButton, { backgroundColor: colors.success }]}
              accessibilityRole="button"
              accessibilityLabel="Cobrar préstamo"
            >
              <Ionicons name="cash" size={scale(16)} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Cobrar</Text>
            </Pressable>
          )}

          {/* Existing actions */}
          {puedeDesembolsar && (
            <Pressable
              onPress={() => setShowDesembolsoModal(true)}
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
              accessibilityRole="button"
              accessibilityLabel="Desembolsar préstamo"
            >
              <Ionicons name="cash" size={scale(16)} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Desembolsar</Text>
            </Pressable>
          )}
          {puedeRefinanciar && (
            <Pressable
              onPress={() => setShowRefinanciarModal(true)}
              style={[styles.actionButton, { backgroundColor: colors.info }]}
              accessibilityRole="button"
              accessibilityLabel="Refinanciar préstamo"
            >
              <Ionicons name="refresh" size={scale(16)} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Refinanciar</Text>
            </Pressable>
          )}
          {puedeRenovar && (
            <Pressable
              onPress={() => setShowRenovarModal(true)}
              style={[styles.actionButton, { backgroundColor: colors.teal }]}
              accessibilityRole="button"
              accessibilityLabel="Renovar préstamo"
            >
              <Ionicons
                name="refresh-circle"
                size={scale(16)}
                color="#FFFFFF"
              />
              <Text style={styles.actionButtonText}>Renovar</Text>
            </Pressable>
          )}
          {puedeCancelar && (
            <Pressable
              onPress={() => setShowCancelarConfirm(true)}
              disabled={isCancelando}
              style={[styles.actionButton, { backgroundColor: colors.error }]}
              accessibilityRole="button"
              accessibilityLabel="Cancelar préstamo"
            >
              <Ionicons name="close" size={scale(16)} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>
                {isCancelando ? "..." : "Cancelar"}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Info Grid */}
        <View style={styles.infoGrid}>
          {/* Cliente — pressable to profile */}
          {cliente && (
            <Pressable
              onPress={() =>
                router.push(`/clientes/${cliente.id}?from=prestamos`)
              }
              style={({ pressed }) => [
                styles.infoCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <View style={styles.infoCardHeader}>
                <Text
                  style={[styles.infoCardTitle, { color: colors.textTertiary }]}
                >
                  Cliente
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={scale(14)}
                  color={colors.textTertiary}
                />
              </View>
              <InfoItem
                label="Nombre"
                value={`${cliente.nombre} ${cliente.apellido || ""}`}
              />
              <InfoItem label="Cédula" value={cliente.cedula} />
              <InfoItem
                label="Teléfono"
                value={cliente.telefono || cliente.celular || "—"}
              />
            </Pressable>
          )}

          {/* Garante — pressable to profile */}
          {prestamo.garante && (
            <Pressable
              onPress={() =>
                router.push(`/clientes/${prestamo.garante!.id}?from=prestamos`)
              }
              style={({ pressed }) => [
                styles.infoCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.success,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <View style={styles.infoCardHeader}>
                <Text style={[styles.infoCardTitle, { color: colors.success }]}>
                  Garante
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={scale(14)}
                  color={colors.textTertiary}
                />
              </View>
              <InfoItem
                label="Nombre"
                value={`${prestamo.garante.nombre} ${prestamo.garante.apellido || ""}`}
              />
              <InfoItem label="Cédula" value={prestamo.garante.cedula} />
              <InfoItem
                label="Teléfono"
                value={
                  prestamo.garante.telefono || prestamo.garante.celular || "—"
                }
              />
            </Pressable>
          )}

          {/* Condiciones */}
          <View
            style={[
              styles.infoCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text
              style={[styles.infoCardTitle, { color: colors.textTertiary }]}
            >
              Condiciones
            </Text>
            <InfoItem
              label="Monto original"
              value={formatCurrency(prestamo.monto)}
            />
            <InfoItem
              label="Monto total"
              value={formatCurrency(prestamo.montoTotal)}
            />
            <InfoItem
              label="Tasa"
              value={
                prestamo.tasaInteres > 0
                  ? `${prestamo.tasaInteres}%`
                  : "Cuota fija"
              }
            />
            <InfoItem label="Plazo" value={`${prestamo.numeroCuotas} cuotas`} />
            <InfoItem label="Frecuencia" value={prestamo.frecuenciaPago} />
            <InfoItem label="Inicio" value={formatDate(prestamo.fechaInicio)} />
            <InfoItem
              label="Vencimiento"
              value={formatDate(prestamo.fechaVencimiento)}
            />
          </View>

          {/* Estado actual */}
          <View
            style={[
              styles.infoCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text
              style={[styles.infoCardTitle, { color: colors.textTertiary }]}
            >
              Estado actual
            </Text>
            <InfoItem
              label="Saldo pendiente"
              value={formatCurrency(prestamo.saldoPendiente)}
            />
            <InfoItem
              label="Mora acumulada"
              value={formatCurrency(prestamo.moraAcumulada)}
            />
            <InfoItem
              label="Próxima cuota"
              value={
                proximaCuota
                  ? `${formatCurrency(proximaCuota.monto + (proximaCuota.mora || 0))} — ${formatDate(proximaCuota.fechaVencimiento)}`
                  : "—"
              }
            />
            {/* Progress bar */}
            <View style={{ marginTop: Spacing.sm }}>
              <View style={styles.progressHeader}>
                <Text
                  style={{ fontSize: FontSize.xs, color: colors.textTertiary }}
                >
                  {cuotasPagadas.length} pagadas
                </Text>
                <Text
                  style={{
                    fontSize: FontSize.xs,
                    fontWeight: FontWeight.semibold,
                    color: colors.primary,
                  }}
                >
                  {progresoPorc}%
                </Text>
              </View>
              <View
                style={[
                  styles.progressBar,
                  { backgroundColor: colors.borderLight },
                ]}
              >
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${progresoPorc}%`,
                      backgroundColor: colors.primary,
                    },
                  ]}
                />
              </View>
              <View style={styles.progressFooter}>
                <Text
                  style={{ fontSize: scale(10), color: colors.textTertiary }}
                >
                  {cuotasPendientes.length} pendientes
                  {cuotasVencidas.length > 0 && (
                    <Text style={{ color: colors.error }}>
                      {" "}
                      ({cuotasVencidas.length} vencidas)
                    </Text>
                  )}
                </Text>
                <Text
                  style={{ fontSize: scale(10), color: colors.textTertiary }}
                >
                  {cuotas.length} total
                </Text>
              </View>
            </View>
          </View>

          {/* Historial de refinanciamientos */}
          <HistorialRefinanciamiento
            historial={prestamo.historialRefinanciamiento}
          />

          {/* Historial de renovaciones */}
          <HistorialRenovacion historial={prestamo.historialRenovacion} />
        </View>

        {/* Tabs: Cuotas / Pagos */}
        <View
          style={[
            styles.tabContainer,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View
            style={[styles.tabHeader, { borderBottomColor: colors.border }]}
          >
            {[
              { key: "cuotas", label: `Cuotas (${cuotas.length})` },
              { key: "pagos", label: `Pagos (${pagos.length})` },
            ].map(({ key, label }) => (
              <Pressable
                key={key}
                onPress={() => setTab(key as "cuotas" | "pagos")}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === key }}
                style={[
                  styles.tabBtn,
                  tab === key && {
                    borderBottomColor: colors.primary,
                    borderBottomWidth: 2,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabBtnText,
                    {
                      color: tab === key ? colors.primary : colors.textTertiary,
                    },
                    tab === key && { fontWeight: FontWeight.bold },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Cuotas tab */}
          {tab === "cuotas" && (
            <>
              <View
                style={[
                  styles.cuotaFilters,
                  { borderBottomColor: colors.borderLight },
                ]}
              >
                {FILTROS_CUOTAS.map((f) => (
                  <Pressable
                    key={f.id}
                    onPress={() => setFiltroCuotas(f.id)}
                    style={[
                      styles.cuotaFilterChip,
                      {
                        backgroundColor:
                          filtroCuotas === f.id
                            ? colors.primary
                            : colors.borderLight,
                        borderColor:
                          filtroCuotas === f.id
                            ? colors.primary
                            : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.cuotaFilterText,
                        {
                          color:
                            filtroCuotas === f.id
                              ? "#FFFFFF"
                              : colors.textSecondary,
                        },
                      ]}
                    >
                      {f.label} {f.count > 0 && `(${f.count})`}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {cuotasFiltradas.length === 0 ? (
                <View style={styles.tabEmpty}>
                  <Text
                    style={[
                      styles.tabEmptyText,
                      { color: colors.textTertiary },
                    ]}
                  >
                    Sin cuotas en esta categoría
                  </Text>
                </View>
              ) : (
                <View>
                  {cuotasFiltradas.map((c: Cuota) => {
                    const vencida =
                      !c.pagada && new Date(c.fechaVencimiento) < new Date();
                    return (
                      <View
                        key={c.id}
                        style={[
                          styles.cuotaCard,
                          {
                            backgroundColor: c.pagada
                              ? colors.borderLight
                              : vencida
                                ? colors.errorLight
                                : colors.surface,
                            borderColor: colors.borderLight,
                          },
                        ]}
                      >
                        <View style={styles.cuotaCardHeader}>
                          <View style={styles.cuotaCardNum}>
                            <Text
                              style={[
                                styles.cuotaCardNumText,
                                { color: colors.text },
                              ]}
                            >
                              #{c.numero}
                            </Text>
                            <Text
                              style={[
                                styles.cuotaCardDate,
                                { color: colors.textTertiary },
                              ]}
                            >
                              {formatDate(c.fechaVencimiento)}
                            </Text>
                          </View>
                          <CuotaBadge pagada={c.pagada} vencida={vencida} />
                        </View>
                        <View style={styles.cuotaCardAmounts}>
                          <View style={styles.cuotaCardAmt}>
                            <Text
                              style={[
                                styles.cuotaAmtLabel,
                                { color: colors.textTertiary },
                              ]}
                            >
                              Capital
                            </Text>
                            <Text
                              style={[
                                styles.cuotaAmtVal,
                                { color: colors.text },
                              ]}
                            >
                              {formatCurrency(c.capital)}
                            </Text>
                          </View>
                          <View style={styles.cuotaCardAmt}>
                            <Text
                              style={[
                                styles.cuotaAmtLabel,
                                { color: colors.textTertiary },
                              ]}
                            >
                              Interés
                            </Text>
                            <Text
                              style={[
                                styles.cuotaAmtVal,
                                { color: colors.warning },
                              ]}
                            >
                              {formatCurrency(c.interes)}
                            </Text>
                          </View>
                          <View style={styles.cuotaCardAmt}>
                            <Text
                              style={[
                                styles.cuotaAmtLabel,
                                { color: colors.textTertiary },
                              ]}
                            >
                              Mora
                            </Text>
                            <Text
                              style={[
                                styles.cuotaAmtVal,
                                {
                                  color:
                                    c.mora > 0
                                      ? colors.error
                                      : colors.textTertiary,
                                },
                              ]}
                            >
                              {c.mora > 0 ? formatCurrency(c.mora) : "—"}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.cuotaCardTotal}>
                          <Text
                            style={[
                              styles.cuotaAmtLabel,
                              { color: colors.textTertiary },
                            ]}
                          >
                            Total
                          </Text>
                          <Text
                            style={[
                              styles.cuotaAmtVal,
                              { fontWeight: FontWeight.bold },
                            ]}
                          >
                            {formatCurrency(c.monto + (c.mora || 0))}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </>
          )}

          {/* Pagos tab */}
          {tab === "pagos" && (
            <>
              <Pressable
                onPress={() => router.push(`/pagos/prestamo/${prestamo.id}`)}
                style={[
                  styles.viewAllLink,
                  {
                    backgroundColor: colors.borderLight,
                    borderColor: colors.border,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Ver todos los pagos"
              >
                <Text
                  style={[styles.viewAllLinkText, { color: colors.primary }]}
                >
                  Ver todos los pagos
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={scale(16)}
                  color={colors.primary}
                />
              </Pressable>
              {pagos.length === 0 ? (
                <View style={styles.tabEmpty}>
                  <Ionicons
                    name="cash-outline"
                    size={scale(40)}
                    color={colors.textTertiary}
                    style={{ opacity: 0.3 }}
                  />
                  <Text
                    style={[
                      styles.tabEmptyText,
                      { color: colors.textTertiary, marginTop: Spacing.sm },
                    ]}
                  >
                    Aún no hay pagos registrados
                  </Text>
                </View>
              ) : (
                <View>
                  {pagos.map((p: Pago) => (
                    <View
                      key={p.id}
                      style={[
                        styles.pagoCard,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.borderLight,
                        },
                      ]}
                    >
                      <View style={styles.pagoCardHeader}>
                        <Text style={[styles.pagoDate, { color: colors.text }]}>
                          {formatDateTime(p.createdAt)}
                        </Text>
                        <View
                          style={[
                            styles.pagoMetodo,
                            { backgroundColor: colors.primaryLight },
                          ]}
                        >
                          <Text
                            style={[
                              styles.pagoMetodoText,
                              { color: colors.primary },
                            ]}
                          >
                            {p.metodo}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.cuotaCardAmounts}>
                        <View style={styles.cuotaCardAmt}>
                          <Text
                            style={[
                              styles.cuotaAmtLabel,
                              { color: colors.textTertiary },
                            ]}
                          >
                            Capital
                          </Text>
                          <Text
                            style={[styles.cuotaAmtVal, { color: colors.text }]}
                          >
                            {formatCurrency(p.capital)}
                          </Text>
                        </View>
                        <View style={styles.cuotaCardAmt}>
                          <Text
                            style={[
                              styles.cuotaAmtLabel,
                              { color: colors.textTertiary },
                            ]}
                          >
                            Interés
                          </Text>
                          <Text
                            style={[
                              styles.cuotaAmtVal,
                              { color: colors.warning },
                            ]}
                          >
                            {formatCurrency(p.interes)}
                          </Text>
                        </View>
                        <View style={styles.cuotaCardAmt}>
                          <Text
                            style={[
                              styles.cuotaAmtLabel,
                              { color: colors.textTertiary },
                            ]}
                          >
                            Mora
                          </Text>
                          <Text
                            style={[
                              styles.cuotaAmtVal,
                              {
                                color:
                                  p.mora > 0
                                    ? colors.error
                                    : colors.textTertiary,
                              },
                            ]}
                          >
                            {p.mora > 0 ? formatCurrency(p.mora) : "—"}
                          </Text>
                        </View>
                      </View>
                      <View
                        style={[
                          styles.cuotaCardTotal,
                          {
                            borderTopWidth: 1,
                            borderTopColor: colors.borderLight,
                            marginTop: Spacing.xs,
                            paddingTop: Spacing.xs,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.cuotaAmtLabel,
                            { color: colors.textTertiary },
                          ]}
                        >
                          Total pagado
                        </Text>
                        <Text
                          style={[
                            styles.cuotaAmtVal,
                            {
                              fontWeight: FontWeight.bold,
                              fontSize: FontSize.md,
                            },
                          ]}
                        >
                          {formatCurrency(p.montoTotal)}
                        </Text>
                      </View>
                      {p.usuario && (
                        <Text
                          style={{
                            fontSize: scale(10),
                            color: colors.textTertiary,
                            marginTop: Spacing.xs,
                          }}
                        >
                          Registrado por: {p.usuario.nombre}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </View>

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>

      {/* Desembolso Modal */}
      <DesembolsoModal
        visible={showDesembolsoModal}
        onClose={() => setShowDesembolsoModal(false)}
        onConfirm={handleDesembolsar}
        loading={isDesembolsando}
        monto={prestamo.monto}
        numeroCuotas={prestamo.numeroCuotas}
        tasaInteres={prestamo.tasaInteres}
        frecuenciaPago={prestamo.frecuenciaPago}
      />

      {/* Confirmar Cancelación (con motivo obligatorio) */}
      <ActionConfirmModal
        visible={showCancelarConfirm}
        titulo={cancelarCfg.titulo}
        desc={cancelarCfg.desc}
        icon={cancelarCfg.icon}
        colorAccion={colors.error}
        pedirMotivo={true}
        motivoLabel="Motivo de la cancelación"
        prestamo={
          prestamo
            ? {
                monto: prestamo.monto,
                numeroCuotas: prestamo.numeroCuotas,
                frecuenciaPago: prestamo.frecuenciaPago,
              }
            : null
        }
        cliente={
          cliente
            ? { nombre: cliente.nombre, apellido: cliente.apellido }
            : null
        }
        loading={isCancelando}
        onConfirm={handleCancelar}
        onCancel={() => setShowCancelarConfirm(false)}
      />

      {/* Refinanciar Modal */}
      <RefinanciarModal
        visible={showRefinanciarModal}
        onClose={() => setShowRefinanciarModal(false)}
        prestamo={prestamo}
        onSuccess={() => {
          showToast("Préstamo refinanciado exitosamente", "success");
          refetch();
        }}
      />

      {/* Renovar Modal */}
      <RenovarModal
        visible={showRenovarModal}
        onClose={() => setShowRenovarModal(false)}
        prestamo={prestamo}
        onSuccess={() => {
          showToast("Préstamo renovado exitosamente", "success");
          refetch();
        }}
      />

      <ActionConfirmModal
        visible={showFlowModal}
        titulo={flowCfg?.titulo || ""}
        desc={flowCfg?.desc || ""}
        icon={flowCfg?.icon || ""}
        colorAccion={flowCfg?.color || ""}
        pedirMotivo={flowCfg?.pedirMotivo || false}
        prestamo={
          prestamo
            ? {
                monto: prestamo.monto,
                numeroCuotas: prestamo.numeroCuotas,
                frecuenciaPago: prestamo.frecuenciaPago,
              }
            : null
        }
        cliente={
          cliente
            ? { nombre: cliente.nombre, apellido: cliente.apellido }
            : null
        }
        loading={cambiarEstadoMutation.isPending}
        onConfirm={ejecutarFlowAccion}
        onCancel={() => {
          setShowFlowModal(false);
          setFlowAccion(null);
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  skeletonContainer: { padding: Spacing.md },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  headerInfo: { flex: 1, marginHorizontal: Spacing.sm },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  headerSub: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.mono,
    marginTop: scale(1),
  },
  estadoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(4),
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  estadoBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  headerBadges: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
    flexShrink: 0,
  },
  refinanciadoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(3),
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  refinanciadoBadgeText: { fontSize: scale(10), fontWeight: FontWeight.bold },
  scrollContent: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  actionRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    flexWrap: "wrap",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  infoGrid: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  infoCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
  },
  infoCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  infoCardTitle: {
    fontSize: scale(10),
    fontWeight: FontWeight.bold,
    textTransform: "uppercase",
    letterSpacing: scale(0.5),
    marginBottom: Spacing.sm,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  progressBar: {
    height: scale(8),
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  progressFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.xs,
  },
  tabContainer: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  tabHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    alignItems: "center",
  },
  tabBtnText: {
    fontSize: FontSize.sm,
  },
  cuotaFilters: {
    flexDirection: "row",
    gap: Spacing.xs,
    padding: Spacing.sm,
    borderBottomWidth: 1,
    flexWrap: "wrap",
  },
  cuotaFilterChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  cuotaFilterText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  tabEmpty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xl,
  },
  tabEmptyText: {
    fontSize: FontSize.sm,
  },
  cuotaCard: {
    padding: Spacing.sm,
    borderBottomWidth: 1,
  },
  cuotaCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  cuotaCardNum: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  cuotaCardNumText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  cuotaCardDate: {
    fontSize: FontSize.xs,
  },
  cuotaCardAmounts: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  cuotaCardAmt: {
    flex: 1,
    alignItems: "center",
  },
  cuotaAmtLabel: {
    fontSize: FontSize.xs,
  },
  cuotaAmtVal: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    marginTop: scale(1),
  },
  cuotaCardTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pagoCard: {
    padding: Spacing.sm,
    borderBottomWidth: 1,
  },
  pagoCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  pagoDate: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  pagoMetodo: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: scale(2),
    borderRadius: BorderRadius.sm,
  },
  pagoMetodoText: {
    fontSize: scale(10),
    fontWeight: FontWeight.semibold,
  },

  viewAllLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  viewAllLinkText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
});
