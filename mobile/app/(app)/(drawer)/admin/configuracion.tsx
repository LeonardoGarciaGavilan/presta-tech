import { useCallback, useMemo } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';

import { Colors,
  FontSize,
  FontWeight,
  Spacing,
  BorderRadius,
  Shadows, scale} from '@/constants/theme';
import { useAuthStore } from '@/store/auth.store';
import { useConfiguracion,
  useGuardarConfiguracion } from '@/hooks/use-configuracion';
import { configuracionSchema, type ConfiguracionFormData } from '@/schemas/configuracion.schema';
import { AppInput } from '@/components/ui/app-input';
import { AppButton } from '@/components/ui/app-button';
import { SkeletonCard } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { useTheme } from '@/components/ui/theme-provider';
import { SectionCard } from '@/components/ui/section-card';

function ToggleSwitch({
  value,
  onValueChange,
  disabled,
  colors,
}: {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  colors: typeof Colors.light;
}) {
  return (
    <TouchableOpacity
      onPress={() => !disabled && onValueChange(!value)}
      activeOpacity={disabled ? 1 : 0.7}
      style={[
        styles.toggleContainer,
        {
          backgroundColor: value ? colors.successLight : colors.surfaceElevated,
          borderColor: value ? colors.success : colors.border,
        },
      ]}
    >
      <View
        style={[
          styles.toggleDot,
          {
            backgroundColor: value ? colors.success : colors.textTertiary,
            alignSelf: value ? 'flex-end' : 'flex-start',
          },
        ]}
      />
      <Text
        style={[
          styles.toggleLabel,
          { color: value ? colors.success : colors.textTertiary },
        ]}
      >
        {value ? 'Permitido' : 'No permitido'}
      </Text>
    </TouchableOpacity>
  );
}

export default function ConfiguracionScreen() {
  const { colorScheme, colors } = useTheme();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.rol === 'ADMIN' || user?.rol === 'SUPERADMIN';
  const { showToast } = useToast();

  const { data: config, isLoading, isError } = useConfiguracion();
  const guardarMutation = useGuardarConfiguracion();

  const defaultValues = useMemo(() => ({
    tasaInteresBase: config?.tasaInteresBase ?? 0,
    moraPorcentajeMensual: config?.moraPorcentajeMensual ?? 0,
    diasGracia: config?.diasGracia ?? 5,
    permitirAbonoCapital: config?.permitirAbonoCapital ?? true,
    montoMinimoPrestamo: config?.montoMinimoPrestamo ?? 500,
    montoMaximoPrestamo: config?.montoMaximoPrestamo ?? null,
    montoMaximoPago: config?.montoMaximoPago ?? null,
  }), [config]);

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<ConfiguracionFormData>({
    resolver: zodResolver(configuracionSchema),
    defaultValues,
    values: defaultValues,
  });

  const onSubmit = useCallback(async (data: ConfiguracionFormData) => {
    try {
      await guardarMutation.mutateAsync({
        tasaInteresBase: data.tasaInteresBase,
        moraPorcentajeMensual: data.moraPorcentajeMensual,
        diasGracia: data.diasGracia,
        permitirAbonoCapital: data.permitirAbonoCapital,
        montoMinimoPrestamo: data.montoMinimoPrestamo,
        montoMaximoPrestamo: data.montoMaximoPrestamo ?? null,
        montoMaximoPago: data.montoMaximoPago ?? null,
      });
      showToast('Configuración guardada correctamente', 'success');
    } catch {
      showToast('Error al guardar la configuración', 'error');
    }
  }, [guardarMutation, showToast]);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <SkeletonCard lines={3} />
          <SkeletonCard lines={5} />
          <SkeletonCard lines={5} />
        </ScrollView>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centerContent}>
          <Ionicons name="alert-circle-outline" size={scale(48)} color={colors.error} />
          <Text style={[styles.errorTitle, { color: colors.text }]}>
            Error al cargar configuración
          </Text>
          <Text style={[styles.errorDesc, { color: colors.textTertiary }]}>
            Verifica tu conexión e intenta de nuevo
          </Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        {!isAdmin && (
          <View
            style={[
              styles.readOnlyBanner,
              { backgroundColor: colors.infoLight, borderColor: colors.info },
            ]}
          >
            <Ionicons name="lock-closed" size={scale(16)} color={colors.info} />
            <Text style={[styles.readOnlyText, { color: colors.info }]}>
              Solo el administrador puede modificar la configuración
            </Text>
          </View>
        )}

        <View
          style={[
            styles.summaryCard,
            { backgroundColor: colors.primary, ...Shadows.md },
          ]}
        >
          <Text style={styles.summaryTitle}>Resumen de configuración</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>
                {defaultValues.tasaInteresBase}%
              </Text>
              <Text style={styles.summaryLabel}>Tasa base</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>
                {defaultValues.moraPorcentajeMensual}%
              </Text>
              <Text style={styles.summaryLabel}>Mora</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>
                {defaultValues.diasGracia}
              </Text>
              <Text style={styles.summaryLabel}>Días gracia</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>
                {defaultValues.permitirAbonoCapital ? 'Sí' : 'No'}
              </Text>
              <Text style={styles.summaryLabel}>Abono capital</Text>
            </View>
          </View>
        </View>

        <SectionCard
          icon="📊"
          title="Tasas e intereses"
          description="Define las tasas aplicadas a los préstamos"
          colors={colors}
        >
          <Controller
            control={control}
            name="tasaInteresBase"
            render={({ field: { onChange, value, onBlur } }) => (
              <AppInput
                label="Tasa de interés base"
                placeholder="0.00"
                value={value?.toString() ?? ''}
                onChangeText={(v) => onChange(v ? parseFloat(v) : 0)}
                onBlur={onBlur}
                keyboardType="decimal-pad"
                editable={isAdmin}
                error={errors.tasaInteresBase?.message}
                hint="Se usa como sugerencia al crear un préstamo"
              />
            )}
          />
          <Controller
            control={control}
            name="moraPorcentajeMensual"
            render={({ field: { onChange, value, onBlur } }) => (
              <AppInput
                label="Porcentaje de mora mensual"
                placeholder="0.00"
                value={value?.toString() ?? ''}
                onChangeText={(v) => onChange(v ? parseFloat(v) : 0)}
                onBlur={onBlur}
                keyboardType="decimal-pad"
                editable={isAdmin}
                error={errors.moraPorcentajeMensual?.message}
                hint="Se aplica una sola vez tras los días de gracia"
              />
            )}
          />
        </SectionCard>

        <SectionCard
          icon="⏱️"
          title="Reglas de mora"
          description="Configura los plazos y reglas de mora"
          colors={colors}
        >
          <Controller
            control={control}
            name="diasGracia"
            render={({ field: { onChange, value, onBlur } }) => (
              <AppInput
                label="Días de gracia"
                placeholder="0"
                value={value?.toString() ?? ''}
                onChangeText={(v) => onChange(v ? parseInt(v, 10) : 0)}
                onBlur={onBlur}
                keyboardType="number-pad"
                editable={isAdmin}
                error={errors.diasGracia?.message}
                hint="Días después del vencimiento antes de aplicar mora"
              />
            )}
          />
          <Controller
            control={control}
            name="permitirAbonoCapital"
            render={({ field: { onChange, value } }) => (
              <View style={styles.fieldContainer}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                  Abono a capital
                </Text>
                <ToggleSwitch
                  value={value}
                  onValueChange={onChange}
                  disabled={!isAdmin}
                  colors={colors}
                />
              </View>
            )}
          />
        </SectionCard>

        <SectionCard
          icon="💰"
          title="Límites financieros"
          description="Define montos mínimos y máximos para préstamos y pagos"
          colors={colors}
        >
          <Controller
            control={control}
            name="montoMinimoPrestamo"
            render={({ field: { onChange, value, onBlur } }) => (
              <AppInput
                label="Monto mínimo de préstamo"
                placeholder="500"
                prefix="RD$"
                value={value?.toString() ?? ''}
                onChangeText={(v) => onChange(v ? parseFloat(v) : undefined)}
                onBlur={onBlur}
                keyboardType="decimal-pad"
                editable={isAdmin}
                error={errors.montoMinimoPrestamo?.message}
                hint="Dejar vacío = RD$500 por defecto"
              />
            )}
          />
          <Controller
            control={control}
            name="montoMaximoPrestamo"
            render={({ field: { onChange, value, onBlur } }) => (
              <AppInput
                label="Monto máximo de préstamo"
                placeholder="Sin límite"
                prefix="RD$"
                value={value?.toString() ?? ''}
                onChangeText={(v) => onChange(v ? parseFloat(v) : null)}
                onBlur={onBlur}
                keyboardType="decimal-pad"
                editable={isAdmin}
                error={errors.montoMaximoPrestamo?.message}
                hint="Dejar vacío para no establecer límite"
              />
            )}
          />
          <Controller
            control={control}
            name="montoMaximoPago"
            render={({ field: { onChange, value, onBlur } }) => (
              <AppInput
                label="Monto máximo por pago"
                placeholder="Sin límite"
                prefix="RD$"
                value={value?.toString() ?? ''}
                onChangeText={(v) => onChange(v ? parseFloat(v) : null)}
                onBlur={onBlur}
                keyboardType="decimal-pad"
                editable={isAdmin}
                error={errors.montoMaximoPago?.message}
                hint="Límite por transacción de pago"
              />
            )}
          />
        </SectionCard>

        {isAdmin && (
          <AppButton
            title="Guardar configuración"
            onPress={handleSubmit(onSubmit)}
            loading={guardarMutation.isPending}
            disabled={!isDirty}
            icon="save-outline"
          />
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  errorTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    marginTop: Spacing.md,
  },
  errorDesc: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  readOnlyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  readOnlyText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    flex: 1,
  },
  summaryCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  summaryTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: 'rgba(255,255,255,0.8)',
    textTransform: 'uppercase',
    letterSpacing: scale(1),
    marginBottom: Spacing.md,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryValue: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
  },
  summaryLabel: {
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.7)',
    marginTop: scale(2),
  },
  fieldContainer: {
    marginBottom: Spacing.md,
  },
  fieldLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    marginBottom: Spacing.xs,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: scale(48),
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  toggleDot: {
    width: scale(16),
    height: scale(16),
    borderRadius: 8,
  },
  toggleLabel: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  bottomSpacer: {
    height: Spacing.xxl,
  },
});
