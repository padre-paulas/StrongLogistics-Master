import apiClient from './client';
import type { RouteBlockage } from '../types';

export async function getBlockedRoutes(): Promise<RouteBlockage[]> {
  const { data } = await apiClient.get<RouteBlockage[]>('/api/routes/blockages/');
  return data;
}

export async function blockRoute(pointId: number, reason: string): Promise<RouteBlockage> {
  const { data } = await apiClient.post<RouteBlockage>('/api/routes/blockages/', { point_id: pointId, reason });
  return data;
}

export async function unblockRoute(id: string): Promise<void> {
  await apiClient.delete(`/api/routes/blockages/${id}/`);
}

export async function isPointBlocked(pointId: number): Promise<boolean> {
  const { data } = await apiClient.get<{ blocked: boolean }>('/api/routes/is-blocked/', {
    params: { point_id: pointId },
  });
  return data.blocked;
}
