import { useQuery } from '@tanstack/react-query';
import type { OfflineQueueItem } from '@/types/offline.types';
import { getPagosPendientesDePrestamo } from '@/db/offline-queue-db';

export function usePagosPendientesPrestamo(prestamoId?: string) {
  return useQuery<OfflineQueueItem[]>({
    queryKey: ['offline-queue', 'pagos', prestamoId],
    queryFn: () => getPagosPendientesDePrestamo(prestamoId!),
    enabled: !!prestamoId,
  });
}
