import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { obtenerCajaActiva,
  abrirCaja,
  cerrarCaja,
  obtenerHistorialCajas,
  obtenerResumenCaja,
  obtenerAuditoriaCaja,
  obtenerCajas } from '@/api/caja.api';
import type { AbrirCajaDto, CerrarCajaDto } from '@/types/caja.types';
import { useNetworkContext } from '@/components/providers/network-provider';

export function useCajaActiva(fecha?: string) {
  return useQuery({
    queryKey: ['caja', 'activa', fecha],
    queryFn: () => obtenerCajaActiva(fecha),
  });
}

export function useAbrirCaja() {
  const queryClient = useQueryClient();
  const { network, addToOfflineQueue } = useNetworkContext();
  return useMutation({
    mutationFn: async (dto: AbrirCajaDto) => {
      if (!network.isOnline) {
        const tempId = `caja_temp_${Date.now()}`;
        await addToOfflineQueue({
          endpoint: '/caja/abrir',
          method: 'POST',
          data: dto,
          queryKeys: [['caja', 'activa'], ['caja', 'historial'], ['caja', 'lista'], ['caja', 'resumen']],
          tempId,
          tempDisplay: {
            montoInicial: dto.montoInicial,
            fecha: dto.fecha || new Date().toISOString(),
            estado: 'ABIERTA',
          },
        });
        const cajaData = {
          id: tempId,
          montoInicial: dto.montoInicial,
          estado: 'ABIERTA',
          fecha: dto.fecha || new Date().toISOString(),
          horaApertura: new Date().toISOString(),
          totalIngresos: 0,
          totalEgresos: 0,
          cantidadMovimientos: 0,
          usuarioId: '',
          empresaId: '',
          resumen: {
            totalIngresos: 0,
            totalEgresos: 0,
            cantidadMovimientos: 0,
            porMetodo: {},
            pagos: [],
            desembolsos: [],
          },
          esOffline: true,
        };
        queryClient.setQueriesData(
          { queryKey: ['caja', 'activa'] },
          cajaData,
        );
        return {
          id: tempId,
          montoInicial: dto.montoInicial,
          estado: 'ABIERTA',
          fecha: dto.fecha || new Date().toISOString(),
          horaApertura: cajaData.horaApertura,
          totalIngresos: 0,
          totalEgresos: 0,
          cantidadMovimientos: 0,
          usuarioId: '',
          empresaId: '',
        };
      }
      return abrirCaja(dto);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caja', 'activa'] });
      queryClient.invalidateQueries({ queryKey: ['caja', 'historial'] });
      queryClient.invalidateQueries({ queryKey: ['caja', 'lista'] });
      queryClient.invalidateQueries({ queryKey: ['caja', 'resumen'] });
    },
  });
}

export function useCerrarCaja() {
  const queryClient = useQueryClient();
  const { network, addToOfflineQueue } = useNetworkContext();
  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: CerrarCajaDto }) => {
      if (!network.isOnline) {
        if (id.startsWith('caja_temp_')) {
          throw new Error('CAJA_TEMP_OFFLINE');
        }
        await addToOfflineQueue({
          endpoint: `/caja/${id}/cerrar`,
          method: 'PATCH',
          data: dto,
          queryKeys: [['caja', 'activa'], ['caja', 'historial'], ['caja', 'lista'], ['caja', 'resumen'], ['prestamos']],
          tempId: `cerrar_temp_${Date.now()}`,
          tempDisplay: {
            cajaId: id,
            montoCierre: dto.montoCierre,
            observaciones: dto.observaciones,
          },
        });
        queryClient.setQueriesData(
          { queryKey: ['caja', 'activa'] },
          null,
        );
        return {
          cajaId: id,
          esperado: 0,
          montoCierre: dto.montoCierre,
          diferencia: 0,
          estado: 'CERRADA',
          esOffline: true,
        };
      }
      return cerrarCaja(id, dto);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caja', 'activa'] });
      queryClient.invalidateQueries({ queryKey: ['caja', 'historial'] });
      queryClient.invalidateQueries({ queryKey: ['caja', 'lista'] });
      queryClient.invalidateQueries({ queryKey: ['caja', 'resumen'] });
      queryClient.invalidateQueries({ queryKey: ['prestamos'] });
    },
  });
}

export function useHistorialCajas() {
  return useQuery({
    queryKey: ['caja', 'historial'],
    queryFn: () => obtenerHistorialCajas(),
  });
}

export function useResumenCaja(fecha?: string, cajaId?: string) {
  return useQuery({
    queryKey: ['caja', 'resumen', fecha, cajaId],
    queryFn: () => obtenerResumenCaja(fecha, cajaId),
  });
}

export function useAuditoriaCaja(id?: string) {
  return useQuery({
    queryKey: ['caja', 'auditoria', id],
    queryFn: () => obtenerAuditoriaCaja(id!),
    enabled: !!id,
  });
}

export function useCajas(estado?: string) {
  return useQuery({
    queryKey: ['caja', 'lista', estado],
    queryFn: () => obtenerCajas(estado),
  });
}
