import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '@/components/ui/screen-container';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useCrearCliente } from '@/hooks/use-clientes';
import { uploadCedula } from '@/api/clientes.api';
import ClienteForm from '@/components/clientes/cliente-form';
import { useToast } from '@/components/ui/toast';
import { asignarRuta } from '@/api/rutas.api';
import { useNetworkContext } from '@/components/providers/network-provider';
import type { ClienteFormData } from '@/schemas/cliente.schema';
import type { ApiError } from '@/types/api.types';
import { FontSize, FontWeight, Spacing, scale} from '@/constants/theme';
import { useTheme } from '@/components/ui/theme-provider';

export default function CrearClienteScreen() {
  const { colorScheme, colors } = useTheme();
  const { mutateAsync, isPending } = useCrearCliente();
  const { showToast } = useToast();
  const { network, addToOfflineQueue } = useNetworkContext();
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
        const clienteId = cliente.id;

        showToast('Cliente creado exitosamente', 'success');
        router.replace('/clientes');

        const offlineOps: Promise<any>[] = [];

        if (rutaId) {
          if (!network.isOnline) {
            offlineOps.push(
              addToOfflineQueue({
                endpoint: `/rutas/cliente/${clienteId}/asignar`,
                method: 'PATCH',
                data: { rutaId },
                queryKeys: [['clientes', clienteId], ['clientes'], ['rutas']],
                tempId: `asignar_ruta_temp_${Date.now()}`,
                tempDisplay: { clienteId, rutaId },
              }),
            );
          } else {
            offlineOps.push(
              asignarRuta(clienteId, rutaId).catch(() =>
                showToast('No se pudo asignar la ruta', 'error'),
              ),
            );
          }
        }

        for (const pending of pendingUploadsRef.current) {
          if (!network.isOnline) {
            offlineOps.push(
              addToOfflineQueue({
                endpoint: `/clientes/${clienteId}/cedula`,
                method: 'POST',
                data: { tipo: pending.tipo, uri: pending.uri },
                queryKeys: [['clientes', clienteId]],
                tempId: `upload_cedula_temp_${Date.now()}`,
                tempDisplay: { clienteId, tipo: pending.tipo },
              }),
            );
          } else {
            offlineOps.push(uploadCedula(clienteId, pending.tipo, pending.uri));
          }
        }

        if (offlineOps.length > 0) {
          const results = await Promise.allSettled(offlineOps);
          const failed = results.filter((r) => r.status === 'rejected');
          if (failed.length > 0) {
            showToast(`${failed.length} operación(es) pendiente(s) de sincronización`, 'info');
          }
        }
      } catch (error) {
        const { message } = error as ApiError;
        throw new Error(message || 'No fue posible crear el cliente.');
      }
    },
    [mutateAsync, showToast, rutaId, network.isOnline, addToOfflineQueue],
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
