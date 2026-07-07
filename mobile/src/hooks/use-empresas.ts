import { useQuery } from '@tanstack/react-query';

import * as empresasApi from '@/api/empresas.api';

export function useEmpresas() {
  return useQuery({
    queryKey: ['empresas'],
    queryFn: empresasApi.getEmpresas,
    staleTime: 5 * 60 * 1000,
  });
}
