import apiClient from './client';
import type { DeliveryPoint, Order, NearbyPoint } from '../types';

export async function fetchPoints(): Promise<DeliveryPoint[]> {
  const { data } = await apiClient.get<DeliveryPoint[]>('/api/points/');
  return data;
}

export async function fetchPointOrders(pointId: number): Promise<Order[]> {
  const { data } = await apiClient.get<Order[]>(`/api/points/${pointId}/orders/`);
  return data;
}

export async function fetchNearbyPoints(pointId: number, resourceId: number, radiusKm?: number): Promise<NearbyPoint[]> {
  const { data } = await apiClient.get<NearbyPoint[]>('/api/points/nearby/', {
    params: { point_id: pointId, resource_id: resourceId, radius_km: radiusKm },
  });
  return data;
}
