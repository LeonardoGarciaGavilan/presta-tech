import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '@/components/ui/screen-container';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';

import { useCrearCliente } from '@/hooks/use-clientes';
import { uploadCedula } from '@/api/clientes.api';
import ClienteForm from '@/components/clientes/cliente-form';
import { useToast } from '@/components/ui/toast';
import { asignarRuta } from '@/api/rutas.api';
import type { ClienteFormData } from '@/schemas/cliente.schema';
import type { ApiError } from '@/types/api.types';
import { FontSize, FontWeight, Spacing, scale} from '@/constants/theme';
import { useTheme } from '@/components/ui/theme-provider';

export default function CrearClienteScreen() {
  const { colorScheme, colors } = useTheme();
  const { mutateAsync, isPending } = useCrearCliente();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [rutaId, setRutaId] = useState<string | null | undefined>(undefined);
  const pendingUploadsRef = useRef<Array<{ tipo: 'cedula-frontal' | 'cedula-trasera'; uri: string }>>([]);

  const handlePendingUpload = useCallback(
    (tipo: 'cedula-frontal' | 'cedula-trasera', uri: string | null) => {
      if (uri) {
        pendingUploadsRef.current = [
          ...pendingUploadsRef.current.filter((u) => u.tipo !== tipo),
          { tipo, uri },
        ];
      } else {
        pendingUploadsRef.current = pendingUploadsRef.current.filter(
          (u) => u.tipo !== tipo,
        );
      }
    },
    [],
  );

  const handleSubmit = useCallback(
    async (data: ClienteFormData) => {
      try {
        const cliente = await mutateAsync(data);
        if (rutaId) {
          await asignarRuta(cliente.id, rutaId).catch(() => showToast('No se pudo asignar la ruta', 'error'));
        }
        const uploadResults = await Promise.allSettled(
          pendingUploadsRef.current.map((pending) =>
            uploadCedula(cliente.id, pending.tipo, pending.uri),
          ),
        );
        const failedUploads = uploadResults.filter(
          (r) => r.status === 'rejected',
        );
        if (failedUploads.length > 0) {
          showToast(
            `No se pudieron subir ${failedUploads.length} documento(s)`,
            'error',
          );
        } else if (uploadResults.length > 0) {
          showToast('Documentos subidos correctamente', 'success');
        }
        showToast('Cliente creado exitosamente', 'success');
        await queryClient.invalidateQueries({ queryKey: ['clientes'] });
        setTimeout(() => router.replace('/clientes'), 500);
      } catch (error) {
        const { message } = error as ApiError;
        throw new Error(message || 'No fue posible crear el cliente.');
      }
    },
    [mutateAsync, showToast, queryClient, rutaId],
  );

  return (
    <ScreenContainer style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={scale(24)} color={colors.text} />
        </Pressable>
        <View style={styles.headerInfo}>
          <Text style={[styles.title, { color: colors.text }]}>
            Nuevo Cliente
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Complete la información del cliente
          </Text>
        </View>
      </View>
      <ClienteForm
        onSubmit={handleSubmit}
        isSubmitting={isPending}
        submitLabel="Crear cliente"
        initialRutaId={rutaId}
        onRutaChange={setRutaId}
        onPendingUpload={handlePendingUpload}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
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
    marginTop: scale(2),
  },
});
