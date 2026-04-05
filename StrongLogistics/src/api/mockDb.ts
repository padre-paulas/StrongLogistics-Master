/**
 * Mock in-memory database — retained for unit tests only.
 * All production API calls now use the real Django REST backend via apiClient.
 * Do NOT import from this file in application code; use the api/ modules instead.
 */

import type {
  User,
  Resource,
  DeliveryPoint,
  Order,
  Driver,
  AutoAssignPlan,
  DashboardStats,
  PaginatedResponse,
  RouteInfo,
  NearbyPoint,
  RouteBlockage,
  InterceptionCandidate,
  InterceptionPlan,
  DemandLevel,
  DemandSetting,
} from '../types';
import {
  calculateOrderWeight,
  getStockRemainingPct,
} from '../utils/weightCalculation';

// ─── Static lookup data ───────────────────────────────────────────────────────

export const resources: Resource[] = [
  { id: 1, name: 'Fuel', unit: 'litres', description: 'Diesel fuel for vehicles' },
  { id: 2, name: 'Water', unit: 'litres', description: 'Potable water supply' },
  { id: 3, name: 'Medical Supplies', unit: 'kits', description: 'First-aid and emergency kits' },
  { id: 4, name: 'Food Rations', unit: 'boxes', description: 'Standard food ration boxes' },
  { id: 5, name: 'Spare Parts', unit: 'units', description: 'Vehicle spare parts and tools' },
];

export const deliveryPoints: DeliveryPoint[] = [
  {
    id: 1, name: 'Lisbon Depot', address: 'Av. da Liberdade 110, Lisbon',
    latitude: 38.7169, longitude: -9.1399,
    stock: [
      { resource_id: 1, resource_name: 'Fuel', quantity: 2000 },
      { resource_id: 2, resource_name: 'Water', quantity: 500 },
    ],
  },
  {
    id: 2, name: 'Porto Hub', address: 'Rua de Santa Catarina 20, Porto',
    latitude: 41.1496, longitude: -8.6110,
    stock: [
      { resource_id: 3, resource_name: 'Medical Supplies', quantity: 80 },
      { resource_id: 4, resource_name: 'Food Rations', quantity: 300 },
    ],
  },
  {
    id: 3, name: 'Faro Station', address: 'Rua de Santo António 15, Faro',
    latitude: 37.0194, longitude: -7.9304,
    stock: [
      { resource_id: 1, resource_name: 'Fuel', quantity: 800 },
      { resource_id: 5, resource_name: 'Spare Parts', quantity: 40 },
    ],
  },
  {
    id: 4, name: 'Coimbra Point', address: 'Rua Ferreira Borges 50, Coimbra',
    latitude: 40.2033, longitude: -8.4103,
    stock: [
      { resource_id: 2, resource_name: 'Water', quantity: 1200 },
      { resource_id: 4, resource_name: 'Food Rations', quantity: 150 },
    ],
  },
  {
    id: 5, name: 'Braga Warehouse', address: 'Av. da Liberdade 5, Braga',
    latitude: 41.5454, longitude: -8.4265,
    stock: [
      { resource_id: 1, resource_name: 'Fuel', quantity: 600 },
      { resource_id: 3, resource_name: 'Medical Supplies', quantity: 30 },
    ],
  },
  {
    id: 6, name: 'Évora Centre', address: 'Praça do Giraldo, Évora',
    latitude: 38.5714, longitude: -7.9130,
    stock: [
      { resource_id: 4, resource_name: 'Food Rations', quantity: 250 },
    ],
  },
];

export const users: User[] = [
  { id: 1, email: 'admin@stronglogistics.com', full_name: 'Admin User', role: 'admin', is_active: true },
  { id: 2, email: 'dispatcher@stronglogistics.com', full_name: 'Maria Costa', role: 'dispatcher', is_active: true },
  { id: 3, email: 'driver1@stronglogistics.com', full_name: 'João Silva', role: 'driver', is_active: true },
  { id: 4, email: 'driver2@stronglogistics.com', full_name: 'Ana Pereira', role: 'driver', is_active: true },
  { id: 5, email: 'driver3@stronglogistics.com', full_name: 'Carlos Santos', role: 'driver', is_active: false },
];

const drivers: Driver[] = [
  { id: 3, full_name: 'João Silva', email: 'driver1@stronglogistics.com', is_available: true, vehicle_plate: '34-AB-56' },
  { id: 4, full_name: 'Ana Pereira', email: 'driver2@stronglogistics.com', is_available: true, vehicle_plate: '78-CD-90' },
];

// ─── Mutable orders store ─────────────────────────────────────────────────────

let _nextOrderSeq = 9;

function makeOrderId(): string {
  return `ORD-${String(_nextOrderSeq++).padStart(4, '0')}`;
}

export const orders: Order[] = [
  {
    id: 1, order_id: 'ORD-0001',
    delivery_point: deliveryPoints[1], resource: resources[0], quantity: 500,
    priority: 'critical', status: 'pending',
    driver: undefined,
    created_at: '2026-04-01T08:00:00Z', updated_at: '2026-04-01T08:00:00Z',
    status_history: [
      { status: 'pending', timestamp: '2026-04-01T08:00:00Z', changed_by: 'Admin User' },
    ],
  },
  {
    id: 2, order_id: 'ORD-0002',
    delivery_point: deliveryPoints[2], resource: resources[1], quantity: 200,
    priority: 'elevated', status: 'dispatched',
    driver: drivers[0],
    created_at: '2026-04-01T09:30:00Z', updated_at: '2026-04-01T10:00:00Z',
    status_history: [
      { status: 'pending', timestamp: '2026-04-01T09:30:00Z', changed_by: 'Maria Costa' },
      { status: 'dispatched', timestamp: '2026-04-01T10:00:00Z', changed_by: 'Maria Costa' },
    ],
  },
  {
    id: 3, order_id: 'ORD-0003',
    delivery_point: deliveryPoints[0], resource: resources[2], quantity: 30,
    priority: 'normal', status: 'in_transit',
    driver: drivers[1],
    created_at: '2026-04-02T07:15:00Z', updated_at: '2026-04-02T08:00:00Z',
    status_history: [
      { status: 'pending', timestamp: '2026-04-02T07:15:00Z', changed_by: 'Admin User' },
      { status: 'dispatched', timestamp: '2026-04-02T07:45:00Z', changed_by: 'Maria Costa' },
      { status: 'in_transit', timestamp: '2026-04-02T08:00:00Z', changed_by: 'João Silva' },
    ],
  },
  {
    id: 4, order_id: 'ORD-0004',
    delivery_point: deliveryPoints[3], resource: resources[3], quantity: 100,
    priority: 'normal', status: 'delivered',
    driver: drivers[0],
    created_at: '2026-04-02T11:00:00Z', updated_at: '2026-04-02T15:30:00Z',
    status_history: [
      { status: 'pending', timestamp: '2026-04-02T11:00:00Z', changed_by: 'Maria Costa' },
      { status: 'dispatched', timestamp: '2026-04-02T11:30:00Z', changed_by: 'Maria Costa' },
      { status: 'in_transit', timestamp: '2026-04-02T12:00:00Z', changed_by: 'João Silva' },
      { status: 'delivered', timestamp: '2026-04-02T15:30:00Z', changed_by: 'João Silva' },
    ],
  },
  {
    id: 5, order_id: 'ORD-0005',
    delivery_point: deliveryPoints[4], resource: resources[0], quantity: 400,
    priority: 'critical', status: 'pending',
    driver: undefined,
    created_at: '2026-04-03T06:00:00Z', updated_at: '2026-04-03T06:00:00Z',
    status_history: [
      { status: 'pending', timestamp: '2026-04-03T06:00:00Z', changed_by: 'Admin User' },
    ],
  },
  {
    id: 6, order_id: 'ORD-0006',
    delivery_point: deliveryPoints[5], resource: resources[4], quantity: 15,
    priority: 'elevated', status: 'dispatched',
    driver: drivers[1],
    notes: 'Urgent — vehicle breakdown on-site',
    created_at: '2026-04-03T09:00:00Z', updated_at: '2026-04-03T09:45:00Z',
    status_history: [
      { status: 'pending', timestamp: '2026-04-03T09:00:00Z', changed_by: 'Maria Costa' },
      { status: 'dispatched', timestamp: '2026-04-03T09:45:00Z', changed_by: 'Maria Costa' },
    ],
  },
  {
    id: 7, order_id: 'ORD-0007',
    delivery_point: deliveryPoints[2], resource: resources[3], quantity: 60,
    priority: 'normal', status: 'cancelled',
    driver: undefined,
    notes: 'Cancelled by client',
    created_at: '2026-04-03T14:00:00Z', updated_at: '2026-04-03T14:30:00Z',
    status_history: [
      { status: 'pending', timestamp: '2026-04-03T14:00:00Z', changed_by: 'Maria Costa' },
      { status: 'cancelled', timestamp: '2026-04-03T14:30:00Z', changed_by: 'Maria Costa' },
    ],
  },
  {
    id: 8, order_id: 'ORD-0008',
    delivery_point: deliveryPoints[1], resource: resources[2], quantity: 20,
    priority: 'critical', status: 'pending',
    driver: undefined,
    created_at: '2026-04-04T07:00:00Z', updated_at: '2026-04-04T07:00:00Z',
    status_history: [
      { status: 'pending', timestamp: '2026-04-04T07:00:00Z', changed_by: 'Admin User' },
    ],
  },
];

// ─── Blocked routes (unreachable delivery points) ─────────────────────────────

export let blockedRoutes: RouteBlockage[] = [];

// ─── Admin-set demand settings ────────────────────────────────────────────────

export let demandSettings: DemandSetting[] = [];

// ─── Helper: simulate async delay ────────────────────────────────────────────

function delay<T>(value: T, ms?: number): Promise<T>;
function delay(value: void, ms?: number): Promise<void>;
function delay<T>(value: T, ms = 300): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Attaches a computed urgency weight to an order (non-mutating). */
function withWeight(order: Order): Order {
  const stockPct = getStockRemainingPct(
    order.delivery_point.stock,
    order.resource.id,
  );
  const demandSetting = demandSettings.find(
    (d) => d.point_id === order.delivery_point.id && d.resource_id === order.resource.id,
  );
  return { ...order, weight: calculateOrderWeight(order.priority, stockPct, demandSetting?.level) };
}

// ─── API implementations ──────────────────────────────────────────────────────

export function mockFetchDashboardStats(): Promise<DashboardStats> {
  const activeOrders = orders.filter((o) => !['delivered', 'cancelled'].includes(o.status));
  const stats: DashboardStats = {
    total_active_orders: activeOrders.length,
    critical_priority: orders.filter((o) => o.priority === 'critical' && o.status === 'pending').length,
    pending_dispatch: orders.filter((o) => o.status === 'pending').length,
    available_drivers: drivers.filter((d) => d.is_available).length,
    recent_orders: [...orders]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 5)
      .map(withWeight),
  };
  return delay(stats);
}

export function mockFetchOrders(params?: Record<string, string | number>): Promise<PaginatedResponse<Order>> {
  let results = [...orders];
  if (params?.status) results = results.filter((o) => o.status === params.status);
  if (params?.priority) results = results.filter((o) => o.priority === params.priority);
  results.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return delay({ count: results.length, next: null, previous: null, results: results.map(withWeight) });
}

export function mockFetchOrder(id: number): Promise<Order> {
  const order = orders.find((o) => o.id === id);
  if (!order) return Promise.reject(new Error('Order not found'));
  return delay(withWeight(order));
}

export function mockUpdateOrderStatus(id: number, status: string): Promise<Order> {
  const order = orders.find((o) => o.id === id);
  if (!order) return Promise.reject(new Error('Order not found'));
  order.status = status as Order['status'];
  order.updated_at = new Date().toISOString();
  order.status_history.push({
    status: status as Order['status'],
    timestamp: new Date().toISOString(),
    changed_by: 'Current User',
  });
  return delay(withWeight({ ...order }));
}

let _nextId = orders.length + 1;

export function mockCreateOrder(payload: {
  delivery_point: number;
  resource: number;
  quantity: number;
  priority: string;
  notes?: string;
}): Promise<Order> {
  const point = deliveryPoints.find((p) => p.id === payload.delivery_point);
  const resource = resources.find((r) => r.id === payload.resource);
  if (!point || !resource) return Promise.reject(new Error('Invalid delivery point or resource'));
  const now = new Date().toISOString();
  const newOrder: Order = {
    id: _nextId++,
    order_id: makeOrderId(),
    delivery_point: point,
    resource,
    quantity: payload.quantity,
    priority: payload.priority as Order['priority'],
    status: 'pending',
    driver: undefined,
    notes: payload.notes,
    created_at: now,
    updated_at: now,
    status_history: [{ status: 'pending', timestamp: now, changed_by: 'Current User' }],
  };
  orders.unshift(newOrder);
  return delay(withWeight({ ...newOrder }));
}

let _planIdCounter = 1;

export function mockAutoAssignOrders(): Promise<AutoAssignPlan> {
  // Sort pending orders by weight descending so highest-urgency orders are
  // assigned first (simulating an ALNS-style priority-aware assignment).
  const pending = [...orders.filter((o) => o.status === 'pending')].sort(
    (a, b) => (withWeight(b).weight ?? 0) - (withWeight(a).weight ?? 0),
  );
  const assignments = drivers.map((driver, i) => {
    const slice = pending.filter((_, idx) => idx % drivers.length === i);
    return {
      driver,
      orders: slice.map(withWeight),
      total_distance_km: Math.round(50 + Math.random() * 100),
      estimated_time_minutes: Math.round(60 + Math.random() * 120),
    };
  });
  const plan: AutoAssignPlan = {
    plan_id: `plan-${_planIdCounter++}`,
    assignments,
    total_distance_km: assignments.reduce((s, a) => s + a.total_distance_km, 0),
    estimated_time_minutes: Math.max(...assignments.map((a) => a.estimated_time_minutes)),
  };
  return delay(plan, 800);
}

export function mockConfirmAutoAssign(_planId: string): Promise<void> {
  const pending = orders.filter((o) => o.status === 'pending');
  pending.forEach((order, i) => {
    order.status = 'dispatched';
    order.driver = drivers[i % drivers.length];
    const now = new Date().toISOString();
    order.updated_at = now;
    order.status_history.push({ status: 'dispatched', timestamp: now, changed_by: 'Auto-assign' });
  });
  return delay(undefined as void, 500);
}

export function mockFetchPoints(): Promise<DeliveryPoint[]> {
  return delay([...deliveryPoints]);
}

export function mockFetchPointOrders(pointId: number): Promise<Order[]> {
  const result = orders
    .filter((o) => o.delivery_point.id === pointId && !['delivered', 'cancelled'].includes(o.status))
    .map(withWeight);
  return delay(result);
}

export function mockFetchNearbyPoints(pointId: number, resourceId: number): Promise<NearbyPoint[]> {
  const origin = deliveryPoints.find((p) => p.id === pointId);
  if (!origin) return delay([]);
  const nearby: NearbyPoint[] = deliveryPoints
    .filter((p) => p.id !== pointId && p.stock.some((s) => s.resource_id === resourceId))
    .map((p) => {
      const latDiff = p.latitude - origin.latitude;
      const lngDiff = p.longitude - origin.longitude;
      const distance_km = Math.round(Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111);
      const stock = p.stock.find((s) => s.resource_id === resourceId);
      return { point: p, distance_km, available_quantity: stock?.quantity ?? 0 };
    })
    .sort((a, b) => a.distance_km - b.distance_km);
  return delay(nearby);
}

export function mockFetchResources(): Promise<Resource[]> {
  return delay([...resources]);
}

export function mockFetchUsers(): Promise<User[]> {
  return delay([...users]);
}

export function mockDeactivateUser(id: number): Promise<void> {
  const user = users.find((u) => u.id === id);
  if (user) user.is_active = false;
  return delay(undefined as void);
}

export function mockAdminDeleteResource(id: number): Promise<void> {
  const idx = resources.findIndex((r) => r.id === id);
  if (idx !== -1) resources.splice(idx, 1);
  return delay(undefined as void);
}

let _resourceIdCounter = Math.max(...resources.map((r) => r.id)) + 1;

export function mockAdminCreateResource(payload: {
  name: string;
  unit: string;
  description?: string;
}): Promise<Resource> {
  const newResource: Resource = {
    id: _resourceIdCounter++,
    name: payload.name,
    unit: payload.unit,
    description: payload.description,
  };
  resources.push(newResource);
  return delay({ ...newResource });
}

export function mockAdminDeletePoint(id: number): Promise<void> {
  const idx = deliveryPoints.findIndex((p) => p.id === id);
  if (idx !== -1) deliveryPoints.splice(idx, 1);
  return delay(undefined as void);
}

export function mockFetchRouteInfo(_pointId: number): Promise<RouteInfo> {
  return delay({
    distance_km: Math.round(50 + Math.random() * 200),
    estimated_time_minutes: Math.round(45 + Math.random() * 180),
  });
}

// ─── Route blockage (unreachable delivery points) ─────────────────────────────

let _blockageIdCounter = 1;

export function mockGetBlockedRoutes(): Promise<RouteBlockage[]> {
  return delay([...blockedRoutes]);
}

export function mockBlockRoute(pointId: number, reason: string): Promise<RouteBlockage> {
  const existing = blockedRoutes.find((b) => b.point_id === pointId);
  if (existing) return delay(existing);
  const blockage: RouteBlockage = {
    id: `block-${_blockageIdCounter++}`,
    point_id: pointId,
    reason,
    created_at: new Date().toISOString(),
  };
  blockedRoutes.push(blockage);
  return delay(blockage);
}

export function mockUnblockRoute(id: string): Promise<void> {
  const idx = blockedRoutes.findIndex((b) => b.id === id);
  if (idx !== -1) blockedRoutes.splice(idx, 1);
  return delay(undefined as void);
}

export function mockIsPointBlocked(pointId: number): boolean {
  return blockedRoutes.some((b) => b.point_id === pointId);
}

// ─── Route interception (ALNS / ACO adaptive routing) ────────────────────────

let _interceptPlanCounter = 1;

/**
 * Scans vehicles currently "In Transit" and identifies candidates that can be
 * intercepted and redirected to serve the supplied urgent (critical) order.
 *
 * Algorithm label: ALNS (Adaptive Large Neighbourhood Search) — chosen because
 * it handles dynamic changes (route disappearance, urgent insertions) through
 * iterative destroy-and-repair cycles.  A real integration would use Google
 * OR-Tools which ships hybrid ALNS/ACO solvers.
 */
export function mockScanForInterception(urgentOrderId: number): Promise<InterceptionPlan> {
  const urgentOrder = orders.find((o) => o.id === urgentOrderId);
  if (!urgentOrder) return Promise.reject(new Error('Order not found'));

  const urgentWeight = withWeight(urgentOrder).weight ?? 0;
  const criticalPoint = urgentOrder.delivery_point;

  // Find in_transit orders whose destination has a lower urgency weight.
  const candidates: InterceptionCandidate[] = orders
    .filter((o) => o.status === 'in_transit' && o.id !== urgentOrderId)
    .filter((o) => (withWeight(o).weight ?? 0) < urgentWeight)
    .map((transitOrder) => {
      const origin = transitOrder.delivery_point;
      const latDiff = criticalPoint.latitude - origin.latitude;
      const lngDiff = criticalPoint.longitude - origin.longitude;
      // Euclidean approximation (×111 km per degree)
      const distanceToCritical = Math.round(Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111);
      return {
        transit_order: withWeight(transitOrder),
        redirected_quantity: Math.min(transitOrder.quantity, urgentOrder.quantity),
        distance_to_critical_km: distanceToCritical,
        distance_saved_km: Math.max(5, Math.round(distanceToCritical * 0.3)),
      } satisfies InterceptionCandidate;
    })
    .sort((a, b) => a.distance_to_critical_km - b.distance_to_critical_km);

  const plan: InterceptionPlan = {
    plan_id: `intercept-${_interceptPlanCounter++}`,
    urgent_order: withWeight(urgentOrder),
    candidates,
    algorithm: 'ALNS',
  };
  return delay(plan, 500);
}

/**
 * Confirms a route interception: the selected transit order is redirected to
 * serve the urgent order first (partial cargo transfer), then continues to its
 * original destination.
 */
export function mockConfirmInterception(
  planId: string,
  urgentOrderId: number,
  transitOrderId: number,
): Promise<void> {
  const urgentOrder = orders.find((o) => o.id === urgentOrderId);
  const transitOrder = orders.find((o) => o.id === transitOrderId);
  if (!urgentOrder || !transitOrder || !transitOrder.driver) {
    return Promise.reject(new Error('Invalid interception plan'));
  }

  const now = new Date().toISOString();
  const note = `Route intercepted — redirected from ${transitOrder.delivery_point.name} (plan ${planId})`;

  // The urgent order is now being served by the intercepted vehicle.
  urgentOrder.status = 'dispatched';
  urgentOrder.driver = transitOrder.driver;
  urgentOrder.updated_at = now;
  urgentOrder.notes = (urgentOrder.notes ? urgentOrder.notes + ' | ' : '') + note;
  urgentOrder.status_history.push({
    status: 'dispatched',
    timestamp: now,
    changed_by: 'Route-Intercept',
  });

  // Mark the transit order as rerouted via a note in its history.
  transitOrder.notes =
    (transitOrder.notes ? transitOrder.notes + ' | ' : '') +
    `Rerouted to serve critical order #${urgentOrder.order_id} first`;
  transitOrder.updated_at = now;
  transitOrder.status_history.push({
    status: 'in_transit',
    timestamp: now,
    changed_by: 'Route-Intercept',
    notes: `Rerouted → ${urgentOrder.delivery_point.name}`,
  });

  return delay(undefined as void, 300);
}

// ─── Demand settings (admin-controlled) ──────────────────────────────────────

let _demandIdCounter = 1;

export function mockGetDemandSettings(): Promise<DemandSetting[]> {
  return delay([...demandSettings]);
}

/**
 * Sets the demand level for a resource at a delivery point.
 * After updating the demand, all pending orders are automatically re-assigned
 * to drivers in priority order (highest urgency weight first), so that
 * increases or decreases in demand are immediately reflected in routing.
 */
export function mockSetDemand(
  pointId: number,
  resourceId: number,
  level: DemandLevel,
): Promise<{ demand: DemandSetting; reassignedCount: number }> {
  const now = new Date().toISOString();
  const existing = demandSettings.find(
    (d) => d.point_id === pointId && d.resource_id === resourceId,
  );
  let demand: DemandSetting;
  if (existing) {
    existing.level = level;
    existing.updated_at = now;
    demand = { ...existing };
  } else {
    demand = {
      id: `demand-${_demandIdCounter++}`,
      point_id: pointId,
      resource_id: resourceId,
      level,
      updated_at: now,
    };
    demandSettings.push(demand);
  }

  // Re-assign all pending orders, sorted by updated urgency weights
  // (which now incorporate the new demand level).
  const pending = [...orders.filter((o) => o.status === 'pending')].sort(
    (a, b) => (withWeight(b).weight ?? 0) - (withWeight(a).weight ?? 0),
  );
  pending.forEach((order, i) => {
    order.status = 'dispatched';
    order.driver = drivers[i % drivers.length];
    order.updated_at = now;
    order.status_history.push({
      status: 'dispatched',
      timestamp: now,
      changed_by: 'Auto-reassign (demand change)',
    });
  });

  return delay({ demand, reassignedCount: pending.length }, 600);
}
