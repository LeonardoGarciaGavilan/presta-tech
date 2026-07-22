import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import PickerField from '@/components/ui/picker-field';
import { clienteSchema, type ClienteFormData } from '@/schemas/cliente.schema';
import { FontSize, FontWeight, Spacing, scale} from '@/constants/theme';
import { unformatIngresosInput } from '@/utils/formatters';
import { useCedulaSignedUrl } from '@/hooks/use-clientes';
import { useQueryClient } from '@tanstack/react-query';
import { listarRutas, type Ruta } from '@/api/rutas.api';
import CascadingPicker from './cascading-picker';
import AppMapView from './map-view';
import CedulaUploadSection from './cedula-upload-section';
import { useTheme } from '@/components/ui/theme-provider';

interface ClienteFormProps {
  initialData?: Partial<ClienteFormData>;
  onSubmit: (data: ClienteFormData) => Promise<void>;
  isSubmitting?: boolean;
  submitLabel?: string;
  initialRutaId?: string | null;
  onRutaChange?: (rutaId: string | null) => void;
  clienteId?: string;
  onPendingUpload?: (tipo: 'cedula-frontal' | 'cedula-trasera', uri: string | null) => void;
  onUploadComplete?: () => void;
  hasFrontalDoc?: boolean;
  hasTraseraDoc?: boolean;
  initialLatitud?: number | null;
  initialLongitud?: number | null;
}

export default function ClienteForm({
  initialData,
  onSubmit,
  isSubmitting = false,
  submitLabel = 'Guardar',
  initialRutaId,
  onRutaChange,
  clienteId,
  onPendingUpload,
  onUploadComplete,
  hasFrontalDoc,
  hasTraseraDoc,
  initialLatitud,
  initialLongitud,
}: ClienteFormProps) {
  const { colorScheme, colors } = useTheme();
  const queryClient = useQueryClient();

  const [frontalUri, setFrontalUri] = useState<string | null>(null);
  const [traseraUri, setTraseraUri] = useState<string | null>(null);

  const frontalSignedUrl = useCedulaSignedUrl(
    clienteId,
    clienteId && hasFrontalDoc ? 'cedula-frontal' : null,
  );
  const traseraSignedUrl = useCedulaSignedUrl(
    clienteId,
    clienteId && hasTraseraDoc ? 'cedula-trasera' : null,
  );

  const handleFrontalChange = useCallback(
    (uri: string | null) => {
      setFrontalUri(uri);
      onPendingUpload?.('cedula-frontal', uri);
    },
    [onPendingUpload],
  );

  const handleTraseraChange = useCallback(
    (uri: string | null) => {
      setTraseraUri(uri);
      onPendingUpload?.('cedula-trasera', uri);
    },
    [onPendingUpload],
  );

  const handleUploadComplete = useCallback(() => {
    if (clienteId) {
      queryClient.invalidateQueries({
        queryKey: ['cedula-signed-url', clienteId, 'cedula-frontal'],
      });
      queryClient.invalidateQueries({
        queryKey: ['cedula-signed-url', clienteId, 'cedula-trasera'],
      });
      queryClient.invalidateQueries({ queryKey: ['clientes', clienteId] });
    }
    onUploadComplete?.();
  }, [clienteId, queryClient, onUploadComplete]);
  const [latitud, setLatitud] = useState<number | null>(() => {
    if (initialLatitud != null) return Number(initialLatitud);
    return null;
  });
  const [longitud, setLongitud] = useState<number | null>(() => {
    if (initialLongitud != null) return Number(initialLongitud);
    return null;
  });
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [rutaId, setRutaId] = useState<string | null | undefined>(initialRutaId);

  useEffect(() => {
    listarRutas()
      .then(setRutas)
      .catch(() => {});
  }, []);

  const handleRutaSelect = useCallback(
    (nombre: string) => {
      const ruta = rutas.find((r) => r.nombre === nombre);
      const id = ruta?.id ?? null;
      setRutaId(id);
      onRutaChange?.(id);
    },
    [rutas, onRutaChange],
  );

  const rutaNombre = rutas.find((r) => r.id === rutaId)?.nombre;

  const {
    control,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ClienteFormData>({
    resolver: zodResolver(clienteSchema) as any,
    defaultValues: {
      nombre: '',
      cedula: '',
      apellido: '',
      telefono: '',
      celular: '',
      email: '',
      provincia: '',
      municipio: '',
      sector: '',
      direccion: '',
      ocupacion: '',
      empresaLaboral: '',
      ingresos: undefined,
      observaciones: '',
      ...initialData,
    },
  });

  const provincia = watch('provincia');
  const municipio = watch('municipio');

  const handleProvinciaChange = useCallback(
    (value: string) => {
      setValue('provincia', value);
      setValue('municipio', '');
      setValue('sector', '');
    },
    [setValue],
  );

  const handleMunicipioChange = useCallback(
    (value: string) => {
      setValue('municipio', value);
      setValue('sector', '');
    },
    [setValue],
  );

  const handleSectorChange = useCallback(
    (value: string) => {
      setValue('sector', value);
    },
    [setValue],
  );

  const handleLocationChange = useCallback(
    (lat: number | null, lng: number | null) => {
      setLatitud(lat);
      setLongitud(lng);
    },
    [],
  );

  const onSubmitHandler = useCallback(
    async (data: ClienteFormData) => {
      try {
        const payload: any = { ...data };
        Object.keys(payload).forEach((key) => {
          if (payload[key] === '' || payload[key] === undefined) {
            delete payload[key];
          }
        });
        if (latitud != null && longitud != null) {
          payload.latitud = latitud;
          payload.longitud = longitud;
          payload.coordsAproximadas = true;
        }
        await onSubmit(payload);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Error al guardar';
        setError('root', { message });
      }
    },
    [onSubmit, setError, latitud, longitud],
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.surface }]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Información General
        </Text>

        <Controller
          control={control}
          name="nombre"
          render={({ field: { onChange, onBlur, value } }) => (
            <AppInput
              label="Nombre *"
              placeholder="Nombre del cliente"
              autoCapitalize="words"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.nombre?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="apellido"
          render={({ field: { onChange, onBlur, value } }) => (
            <AppInput
              label="Apellido"
              placeholder="Apellido del cliente"
              autoCapitalize="words"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.apellido?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="cedula"
          render={({ field: { onChange, onBlur, value } }) => (
            <AppInput
              label="Cédula *"
              placeholder="000-0000000-0"
              autoCapitalize="none"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.cedula?.message}
              format="cedula"
              hint="Formato: 000-0000000-0"
            />
          )}
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Información de Contacto
        </Text>

        <Controller
          control={control}
          name="telefono"
          render={({ field: { onChange, onBlur, value } }) => (
            <AppInput
              label="Teléfono"
              placeholder="(809) 000-0000"
              keyboardType="phone-pad"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.telefono?.message}
              format="phone"
            />
          )}
        />

        <Controller
          control={control}
          name="celular"
          render={({ field: { onChange, onBlur, value } }) => (
            <AppInput
              label="Celular"
              placeholder="(829) 000-0000"
              keyboardType="phone-pad"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.celular?.message}
              format="phone"
            />
          )}
        />

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <AppInput
              label="Correo electrónico"
              placeholder="cliente@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.email?.message}
            />
          )}
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Dirección
        </Text>

        <CascadingPicker
          provincia={provincia}
          municipio={municipio}
          sector={watch('sector')}
          onProvinciaChange={handleProvinciaChange}
          onMunicipioChange={handleMunicipioChange}
          onSectorChange={handleSectorChange}
          errors={{
            provincia: errors.provincia?.message,
            municipio: errors.municipio?.message,
            sector: errors.sector?.message,
          }}
        />

        <Controller
          control={control}
          name="direccion"
          render={({ field: { onChange, onBlur, value } }) => (
            <AppInput
              label="Dirección exacta"
              placeholder="Calle, número, referencia…"
              autoCapitalize="words"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.direccion?.message}
            />
          )}
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Ubicación en mapa
        </Text>
        <AppMapView
          latitude={latitud}
          longitude={longitud}
          onCoordsChange={handleLocationChange}
          readOnly={false}
          height={220}
        />
      </View>

      <CedulaUploadSection
        clienteId={clienteId}
        frontalUri={frontalUri}
        traseraUri={traseraUri}
        existingFrontalUrl={frontalSignedUrl.data?.signedUrl}
        existingTraseraUrl={traseraSignedUrl.data?.signedUrl}
        onFrontalChange={handleFrontalChange}
        onTraseraChange={handleTraseraChange}
        onUploadComplete={handleUploadComplete}
      />

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Información Laboral
        </Text>

        <Controller
          control={control}
          name="ocupacion"
          render={({ field: { onChange, onBlur, value } }) => (
            <AppInput
              label="Ocupación"
              placeholder="Ocupación del cliente"
              autoCapitalize="words"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.ocupacion?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="empresaLaboral"
          render={({ field: { onChange, onBlur, value } }) => (
            <AppInput
              label="Empresa laboral"
              placeholder="Nombre de la empresa"
              autoCapitalize="words"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.empresaLaboral?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="ingresos"
          render={({ field: { onChange, onBlur, value } }) => (
            <AppInput
              label="Ingresos mensuales"
              placeholder="0.00"
              keyboardType="decimal-pad"
              prefix="RD$"
              format="currency"
              value={
                value !== undefined && value !== null ? String(value) : ''
              }
              onChangeText={(text) => onChange(unformatIngresosInput(text))}
              onBlur={onBlur}
              error={errors.ingresos?.message}
              hint="Ingresos mensuales en pesos dominicanos"
            />
          )}
        />

        {rutas.length > 0 && (
          <PickerField
            label="Asignar a ruta"
            placeholder="Selecciona una ruta"
            value={rutaNombre}
            options={rutas.map((r) => r.nombre)}
            onSelect={handleRutaSelect}
            searchable={rutas.length > 5}
            hint="Opcional — ruta de cobro del cliente"
          />
        )}
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Observaciones
        </Text>

        <Controller
          control={control}
          name="observaciones"
          render={({ field: { onChange, onBlur, value } }) => (
            <AppInput
              placeholder="Notas adicionales sobre el cliente"
              multiline
              numberOfLines={4}
              style={styles.textArea}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.observaciones?.message}
            />
          )}
        />
      </View>

      {errors.root && (
        <Text style={[styles.rootError, { color: colors.error }]}>
          {errors.root.message}
        </Text>
      )}

      <AppButton
        title={submitLabel}
        loading={isSubmitting}
        onPress={handleSubmit(onSubmitHandler)}
        icon="checkmark-circle-outline"
      />

      <View style={styles.spacer} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  rootError: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  textArea: {
    height: scale(120),
    textAlignVertical: 'top',
  },
  spacer: {
    height: Spacing.xxl,
  },
});
