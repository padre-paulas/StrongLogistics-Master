import apiClient from './client';
import type { User, Resource, DeliveryPoint, DemandLevel, DemandSetting } from '../types';

export async function fetchUsers(): Promise<User[]> {
  const { data } = await apiClient.get<User[]>('/api/admin/users/');
  return data;
}

export async function createUser(payload: Partial<User> & { password?: string }): Promise<User> {
  const { data } = await apiClient.post<User>('/api/admin/users/', payload);
  return data;
}

export async function updateUser(id: number, payload: Partial<User>): Promise<User> {
  const { data } = await apiClient.patch<User>(`/api/admin/users/${id}/`, payload);
  return data;
}

export async function deactivateUser(id: number): Promise<void> {
  await apiClient.patch(`/api/admin/users/${id}/`, { is_active: false });
}

export async function adminFetchResources(): Promise<Resource[]> {
  const { data } = await apiClient.get<Resource[]>('/api/admin/resources/');
  return data;
}

export async function adminCreateResource(payload: { name: string; unit: string; description?: string }): Promise<Resource> {
  const { data } = await apiClient.post<Resource>('/api/admin/resources/', payload);
  return data;
}

export async function adminDeleteResource(id: number): Promise<void> {
  await apiClient.delete(`/api/admin/resources/${id}/`);
}

export async function adminFetchPoints(): Promise<DeliveryPoint[]> {
  const { data } = await apiClient.get<DeliveryPoint[]>('/api/admin/points/');
  return data;
}

export async function adminCreatePoint(payload: Partial<DeliveryPoint>): Promise<DeliveryPoint> {
  const { data } = await apiClient.post<DeliveryPoint>('/api/admin/points/', payload);
  return data;
}

export async function adminUpdatePoint(id: number, payload: Partial<DeliveryPoint>): Promise<DeliveryPoint> {
  const { data } = await apiClient.patch<DeliveryPoint>(`/api/admin/points/${id}/`, payload);
  return data;
}

export async function adminDeletePoint(id: number): Promise<void> {
  await apiClient.delete(`/api/admin/points/${id}/`);
}

export async function adminGetDemandSettings(): Promise<DemandSetting[]> {
  const { data } = await apiClient.get<DemandSetting[]>('/api/admin/demand/');
  return data;
}

export async function adminSetDemand(
  pointId: number,
  resourceId: number,
  level: DemandLevel,
): Promise<{ demand: DemandSetting; reassignedCount: number }> {
  const { data } = await apiClient.post<{ demand: DemandSetting; reassignedCount: number }>(
    '/api/admin/demand/',
    { point_id: pointId, resource_id: resourceId, level },
  );
  return data;
}
