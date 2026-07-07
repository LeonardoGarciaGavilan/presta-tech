import { useQuery } from '@tanstack/react-query';

import * as auditoriaApi from '@/api/auditoria.api';
import type { AuditoriaFilters } from '@/types/auditoria.types';

export function useAuditoria(filters: AuditoriaFilters) {
  return useQuery({
    queryKey: ['auditoria', filters],
    queryFn: () => auditoriaApi.getAuditoria(filters),
  });
}
