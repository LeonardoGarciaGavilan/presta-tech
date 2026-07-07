import { useQuery } from '@tanstack/react-query';

import { getDashboardMobile } from '@/api/dashboard.api';

export function useDashboardMobile() {
  return useQuery({
    queryKey: ['dashboard', 'mobile'],
    queryFn: getDashboardMobile,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
