import apiClient from './client';
import type { Order, PaginatedResponse, AutoAssignPlan, InterceptionPlan } from '../types';

export async function fetchOrders(params?: Record<string, string | number>): Promise<PaginatedResponse<Order>> {
  const { data } = await apiClient.get<PaginatedResponse<Order>>('/api/orders/', { params });
  return data;
}

export async function fetchOrder(id: number): Promise<Order> {
  const { data } = await apiClient.get<Order>(`/api/orders/${id}/`);
  return data;
}

export async function updateOrderStatus(id: number, status: string): Promise<Order> {
  const { data } = await apiClient.patch<Order>(`/api/orders/${id}/`, { status });
  return data;
}

export async function createOrder(payload: {
  delivery_point: number;
  resource: number;
  quantity: number;
  priority: string;
  notes?: string;
}): Promise<Order> {
  const { data } = await apiClient.post<Order>('/api/orders/', payload);
  return data;
}

export async function autoAssignOrders(): Promise<AutoAssignPlan> {
  const { data } = await apiClient.post<AutoAssignPlan>('/api/orders/auto-assign/');
  return data;
}

export async function confirmAutoAssign(planId: string): Promise<void> {
  await apiClient.post('/api/orders/auto-assign/confirm/', { plan_id: planId });
}

/**
 * Scans in-transit orders and returns an interception plan for the specified
 * urgent order.  Uses an ALNS-based adaptive routing strategy.
 */
export async function scanForInterception(urgentOrderId: number): Promise<InterceptionPlan> {
  const { data } = await apiClient.post<InterceptionPlan>('/api/orders/scan-interception/', {
    urgent_order_id: urgentOrderId,
  });
  return data;
}

/**
 * Confirms a route interception, redirecting the selected transit vehicle to
 * serve the urgent order first.
 */
export async function confirmInterception(
  planId: string,
  urgentOrderId: number,
  transitOrderId: number,
): Promise<void> {
  await apiClient.post('/api/orders/confirm-interception/', {
    plan_id: planId,
    urgent_order_id: urgentOrderId,
    transit_order_id: transitOrderId,
  });
}

