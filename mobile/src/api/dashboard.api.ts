import client from './client';
import type { DashboardMobileData } from '@/types/dashboard.types';

const ENDPOINT = '/dashboard/mobile';

export async function getDashboardMobile(): Promise<DashboardMobileData> {
  const response = await client.get<DashboardMobileData>(ENDPOINT);
  return response.data;
}
