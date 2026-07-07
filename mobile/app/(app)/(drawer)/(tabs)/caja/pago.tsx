import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import PaymentForm from '@/components/pagos/payment-form';
import { ScreenContainer } from '@/components/ui/screen-container';
import { AppButton } from '@/components/ui/app-button';
import LoadingScreen from '@/components/ui/loading-screen';
import EmptyState from '@/components/ui/empty-state';
import { usePrestamos, usePrestamo } from '@/hooks/use-prestamos';
import { useCajaActiva } from '@/hooks/use-caja';
import { FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { formatCurrency, formatCedula } from '@/utils/formatters';
import type { Prestamo } from '@/types/prestamo.types';
import { useTheme } from '@/components/ui/theme-provider';

export default function CajaPagoScreen() {
  const { prestamoId } = useLocalSearchParams<{ prestamoId?: string }>();
  const { colorScheme, colors } = useTheme();

  // ── Modo directo (viene de detalle de préstamo) ──
  if (prestamoId) {
    return <DirectPaymentMode prestamoId={prestamoId} />;
  }

  // ── Modo búsqueda (navegación normal desde Caja) ──
  return <SearchPaymentMode />;
}

function DirectPaymentMode({ prestamoId }: { prestamoId: string }) {
  const { colorScheme, colors } = useTheme();

  const { data: prestamo, isLoading, refetch } = usePrestamo(prestamoId);
  const { data: cajaActiva, isLoading: loadingCaja } = useCajaActiva();

  if (isLoading || loadingCaja) {
    return <LoadingScreen message="Cargando..." />;
  }

  if (!prestamo) {
    return (
      <ScreenContainer style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={[styles.centerTitle, { color: colors.text }]}>Préstamo no encontrado</Text>
          <AppButton title="Volver" onPress={() => router.back()} variant="ghost" />
        </View>
      </ScreenContainer>
    );
  }

  if (!cajaActiva || cajaActiva.estado !== 'ABIERTA') {
    return (
      <ScreenContainer style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={styles.centerContainer}>
          <Ionicons name="lock-closed-outline" size={48} color={colors.warning} />
          <Text style={[styles.centerTitle, { color: colors.text }]}>Caja cerrada</Text>
          <Text style={[styles.centerSubtitle, { color: colors.textTertiary }]}>
            Debes abrir la caja antes de registrar un pago
          </Text>
          <AppButton
            title="Ir a Caja"
            onPress={() => router.back()}
            icon="wallet-outline"
          />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <PaymentForm
      prestamo={prestamo}
      onBack={() => router.back()}
      afterPayment={refetch}
      reciboCloseLabel="Cerrar"
    />
  );
}

function SearchPaymentMode() {
  const { colorScheme, colors } = useTheme();

  // Search state
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback((text: string) => {
    setSearch(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(text), 400);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Loans query
  const { data: prestamosData, isLoading: loadingPrestamos } = usePrestamos(
    debouncedSearch ? { search: debouncedSearch, limit: 20 } : undefined,
  );
  const prestamos = useMemo(() => {
    if (!prestamosData?.data) return [];
    return prestamosData.data.filter(
      (p: any) => p.estado === 'ACTIVO' || p.estado === 'ATRASADO',
    );
  }, [prestamosData]);

  // Selected prestamo for payment
  const [selectedPrestamo, setSelectedPrestamo] = useState<Prestamo | null>(null);

  const handleBack = useCallback(() => {
    setSelectedPrestamo(null);
  }, []);

  const renderClienteItem = useCallback(
    ({ item }: { item: any }) => {
      const cliente = item.cliente;
      return (
        <Pressable
          onPress={() => setSelectedPrestamo(item)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.sm,
            borderRadius: BorderRadius.md,
            borderWidth: 1,
            borderColor: colors.borderLight,
            backgroundColor: colors.surface,
            padding: Spacing.md,
            marginBottom: Spacing.sm,
          }}
        >
          <View style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: '#E0F2FE',
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            <Ionicons name="person" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: colors.text }}>
              {cliente?.nombre} {cliente?.apellido || ''}
            </Text>
            <Text style={{ fontSize: FontSize.xs, color: colors.textTertiary }}>
              {cliente?.cedula ? formatCedula(cliente.cedula) : '—'} · {formatCurrency(item.monto)} · {item.numeroCuotas} cuotas
            </Text>
            <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: 2 }}>
              <Text style={{ fontSize: 10, color: colors.primary, fontWeight: FontWeight.bold }}>
                Saldo: {formatCurrency(item.saldoPendiente)}
              </Text>
              {item.moraAcumulada > 0 && (
                <Text style={{ fontSize: 10, color: colors.error, fontWeight: FontWeight.bold }}>
                  Mora: {formatCurrency(item.moraAcumulada)}
                </Text>
              )}
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
        </Pressable>
      );
    },
    [colors],
  );

  // Payment form after selecting loan
  if (selectedPrestamo) {
    return (
      <PaymentForm
        key={selectedPrestamo.id}
        prestamo={selectedPrestamo}
        onBack={handleBack}
        showConfirmStep
        showCancelButton
        saldarCuotaThreshold={1}
        reciboCloseLabel="Nuevo Pago"
      />
    );
  }

  // Search screen
  return (
    <ScreenContainer style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Nuevo Pago',
          headerTintColor: colors.primary,
          headerStyle: { backgroundColor: colors.background },
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
      <FlatList
        data={prestamos}
        keyExtractor={(item: any) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: Spacing.md, paddingBottom: Spacing.xxl }}
        ListHeaderComponent={
          <View style={{ marginBottom: Spacing.md }}>
            <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: colors.text, marginBottom: Spacing.sm }}>
              Buscar cliente
            </Text>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: Spacing.sm,
              borderRadius: BorderRadius.md,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surfaceElevated,
              paddingHorizontal: Spacing.md,
            }}>
              <Ionicons name="search" size={18} color={colors.textTertiary} />
              <TextInput
                value={search}
                onChangeText={handleSearch}
                placeholder="Nombre o cédula del cliente..."
                placeholderTextColor={colors.textTertiary}
                style={{ flex: 1, fontSize: FontSize.md, color: colors.text, paddingVertical: Spacing.sm }}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {search ? (
                <Pressable onPress={() => { setSearch(''); setDebouncedSearch(''); }} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                </Pressable>
              ) : null}
            </View>
          </View>
        }
        ListEmptyComponent={
          loadingPrestamos ? (
            <LoadingScreen message="Buscando..." />
          ) : debouncedSearch ? (
            <EmptyState icon="search-outline" title="Sin resultados" subtitle="No se encontraron préstamos activos para este cliente" />
          ) : (
            <EmptyState icon="search-outline" title="Busca un cliente" subtitle="Ingresa nombre o cédula para buscar préstamos activos" />
          )
        }
        renderItem={renderClienteItem}
      />
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = {
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  } as any,
  centerTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
  } as any,
  centerSubtitle: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginBottom: Spacing.md,
  } as any,
};
