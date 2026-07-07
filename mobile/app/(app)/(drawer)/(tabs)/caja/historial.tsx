import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ui/screen-container';
import LoadingScreen from '@/components/ui/loading-screen';
import EmptyState from '@/components/ui/empty-state';
import DetalleSesionModal from '@/components/caja/detalle-sesion-modal';
import { useHistorialCajas } from '@/hooks/use-caja';
import { FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { useTheme } from '@/components/ui/theme-provider';

export default function HistorialScreen() {
  const { colorScheme, colors } = useTheme();

  const { data: historial, isLoading, refetch } = useHistorialCajas();
  const [selectedCaja, setSelectedCaja] = useState<any>(null);

  const handleSelectSesion = useCallback((sesion: any) => {
    setSelectedCaja(sesion);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedCaja(null);
  }, []);

  function getEstadoColor(estado: string) {
    return estado === 'ABIERTA' ? '#16A34A' : colors.textTertiary;
  }
  function getEstadoBg(estado: string) {
    return estado === 'ABIERTA' ? '#F0FDF4' : colors.borderLight;
  }

  function formatHour(iso: string) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' });
  }

  const renderSesionCard = useCallback(
    ({ item }: { item: any }) => {
      const isOpen = item.estado === 'ABIERTA';
      const dif = item.diferencia;
      const difColor =
        dif == null
          ? colors.textTertiary
          : dif === 0
            ? '#16A34A'
            : dif > 0
              ? '#D97706'
              : '#DC2626';
      const difLabel =
        dif == null
          ? '—'
          : dif === 0
            ? 'Cuadrada'
            : dif > 0
              ? `Sobrante ${formatCurrency(dif)}`
              : `Faltante ${formatCurrency(Math.abs(dif))}`;

      return (
        <Pressable
          onPress={() => handleSelectSesion(item)}
          style={[
            styles.sesionCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.sesionHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sesionDate, { color: colors.text }]}>
                {formatDate(item.fecha)}
              </Text>
              <Text style={[styles.sesionSub, { color: colors.textTertiary }]}>
                {item.usuario?.nombre || '—'} · {formatHour(item.createdAt)}
                {item.fechaCierre && ` — ${formatHour(item.fechaCierre)}`}
              </Text>
            </View>
            <View style={[styles.estadoBadge, { backgroundColor: getEstadoBg(item.estado) }]}>
              <Text style={[styles.estadoText, { color: getEstadoColor(item.estado) }]}>
                {isOpen ? 'Abierta' : 'Cerrada'}
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

          <View style={styles.sesionAmounts}>
            <View style={styles.amountItem}>
              <Text style={[styles.amountLabel, { color: colors.textTertiary }]}>Inicial</Text>
              <Text style={[styles.amountValue, { color: colors.text }]}>
                {formatCurrency(item.montoInicial)}
              </Text>
            </View>
            <View style={styles.amountItem}>
              <Text style={[styles.amountLabel, { color: colors.textTertiary }]}>Ingresos</Text>
              <Text style={[styles.amountValue, { color: colors.primary }]}>
                {formatCurrency(item.totalIngresos || 0)}
              </Text>
            </View>
            <View style={styles.amountItem}>
              <Text style={[styles.amountLabel, { color: colors.textTertiary }]}>Egresos</Text>
              <Text style={[styles.amountValue, { color: colors.error }]}>
                {formatCurrency(item.totalEgresos || 0)}
              </Text>
            </View>
          </View>

          {!isOpen && (
            <View style={[styles.diferenciaRow, { borderTopColor: colors.borderLight }]}>
              <Text style={[styles.diferenciaLabel, { color: difColor }]}>
                <Ionicons
                  name={
                    dif === 0
                      ? 'checkmark-circle'
                      : dif && dif > 0
                        ? 'arrow-up-circle'
                        : 'alert-circle'
                  }
                  size={14}
                  color={difColor}
                />{' '}
                {difLabel}
              </Text>
            </View>
          )}
        </Pressable>
      );
    },
    [colors, handleSelectSesion],
  );

  return (
    <ScreenContainer style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Historial de Caja',
          headerTintColor: colors.primary,
          headerStyle: { backgroundColor: colors.background },
        }}
      />

      <FlatList
        data={historial || []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: Spacing.md,
          paddingBottom: Spacing.xxl,
          paddingTop: Spacing.md,
        }}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          isLoading ? (
            <LoadingScreen message="Cargando historial..." />
          ) : (
            <EmptyState
              icon="time-outline"
              title="Sin historial"
              subtitle="No hay sesiones de caja registradas aún"
            />
          )
        }
        renderItem={renderSesionCard}
      />

      <DetalleSesionModal
        visible={!!selectedCaja}
        cajaId={selectedCaja?.id}
        caja={selectedCaja}
        onClose={handleCloseModal}
      />
    </ScreenContainer>
  );
}

const styles = {
  sesionCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  } as any,
  sesionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  } as any,
  sesionDate: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  sesionSub: { fontSize: FontSize.xs, marginTop: 1 },
  estadoBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  } as any,
  estadoText: { fontSize: 10, fontWeight: FontWeight.bold },
  divider: { height: 1, marginVertical: Spacing.sm } as any,
  sesionAmounts: {
    flexDirection: 'row',
    gap: Spacing.sm,
  } as any,
  amountItem: { flex: 1, alignItems: 'center' } as any,
  amountLabel: { fontSize: 9 },
  amountValue: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, marginTop: 1 },
  diferenciaRow: {
    borderTopWidth: 1,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    alignItems: 'center',
  } as any,
  diferenciaLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
} as const;
