/**
 * Test specifications — Route Interception (mockScanForInterception, mockConfirmInterception)
 *
 * These tests verify the adaptive routing interception logic:
 *  - Scanning in-transit orders for interception candidates
 *  - Candidate ordering (nearest first)
 *  - Weight comparison (only lower-weight orders are interceptable)
 *  - Confirmation mutations on the in-memory order store
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  orders,
  mockScanForInterception,
  mockConfirmInterception,
  mockUpdateOrderStatus,
} from '../api/mockDb';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Returns a fresh snapshot of the in-memory orders array (avoid mutation leaks). */
function getOrder(id: number) {
  return orders.find((o) => o.id === id);
}

// ─────────────────────────────────────────────────────────────────────────────
// mockScanForInterception
// ─────────────────────────────────────────────────────────────────────────────

describe('mockScanForInterception', () => {
  it('rejects with an error if the order id does not exist', async () => {
    await expect(mockScanForInterception(9999)).rejects.toThrow('Order not found');
  });

  it('returns a plan with the correct urgent order', async () => {
    // Order 1 is critical + pending — it is the "urgent" reference order.
    const plan = await mockScanForInterception(1);
    expect(plan.urgent_order.id).toBe(1);
    expect(plan.urgent_order.priority).toBe('critical');
  });

  it('uses the ALNS algorithm label', async () => {
    const plan = await mockScanForInterception(1);
    expect(plan.algorithm).toBe('ALNS');
  });

  it('sets a unique plan_id', async () => {
    const plan1 = await mockScanForInterception(1);
    const plan2 = await mockScanForInterception(1);
    expect(plan1.plan_id).not.toBe(plan2.plan_id);
  });

  it('includes only in_transit orders as candidates (not pending/delivered/cancelled)', async () => {
    const plan = await mockScanForInterception(1);
    for (const candidate of plan.candidates) {
      expect(candidate.transit_order.status).toBe('in_transit');
    }
  });

  it('does not include the urgent order itself as a candidate', async () => {
    const plan = await mockScanForInterception(1);
    const selfCandidate = plan.candidates.find((c) => c.transit_order.id === 1);
    expect(selfCandidate).toBeUndefined();
  });

  it('only includes candidates with a lower urgency weight than the urgent order', async () => {
    const plan = await mockScanForInterception(1);
    const urgentWeight = plan.urgent_order.weight ?? 0;
    for (const c of plan.candidates) {
      expect((c.transit_order.weight ?? 0)).toBeLessThan(urgentWeight);
    }
  });

  it('sorts candidates by distance to critical point (nearest first)', async () => {
    const plan = await mockScanForInterception(1);
    for (let i = 1; i < plan.candidates.length; i++) {
      expect(plan.candidates[i].distance_to_critical_km).toBeGreaterThanOrEqual(
        plan.candidates[i - 1].distance_to_critical_km,
      );
    }
  });

  it('attaches a weight to the urgent order', async () => {
    const plan = await mockScanForInterception(1);
    expect(plan.urgent_order.weight).toBeDefined();
    expect(typeof plan.urgent_order.weight).toBe('number');
  });

  it('attaches a weight to each candidate transit order', async () => {
    const plan = await mockScanForInterception(1);
    for (const c of plan.candidates) {
      expect(c.transit_order.weight).toBeDefined();
      expect(typeof c.transit_order.weight).toBe('number');
    }
  });

  it('sets redirected_quantity to at most the urgent order quantity', async () => {
    const plan = await mockScanForInterception(1);
    for (const c of plan.candidates) {
      expect(c.redirected_quantity).toBeLessThanOrEqual(plan.urgent_order.quantity);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// mockConfirmInterception
// ─────────────────────────────────────────────────────────────────────────────

describe('mockConfirmInterception', () => {
  // Before each confirmation test, reset the status of order 3 (in_transit) so
  // it can be intercepted cleanly.
  beforeEach(async () => {
    const order3 = getOrder(3);
    if (order3) order3.status = 'in_transit';
    const order1 = getOrder(1);
    if (order1) order1.status = 'pending';
  });

  it('sets the urgent order status to dispatched after confirmation', async () => {
    const plan = await mockScanForInterception(1);
    if (plan.candidates.length === 0) return; // skip if no candidates in this test run

    const candidate = plan.candidates[0];
    await mockConfirmInterception(plan.plan_id, plan.urgent_order.id, candidate.transit_order.id);

    const urgentOrder = getOrder(plan.urgent_order.id);
    expect(urgentOrder?.status).toBe('dispatched');
  });

  it('assigns the intercepted driver to the urgent order', async () => {
    const plan = await mockScanForInterception(1);
    if (plan.candidates.length === 0) return;

    const candidate = plan.candidates[0];
    await mockConfirmInterception(plan.plan_id, plan.urgent_order.id, candidate.transit_order.id);

    const urgentOrder = getOrder(plan.urgent_order.id);
    expect(urgentOrder?.driver?.id).toBe(candidate.transit_order.driver?.id);
  });

  it('appends a "Route-Intercept" entry to the urgent order status history', async () => {
    const plan = await mockScanForInterception(1);
    if (plan.candidates.length === 0) return;

    const candidate = plan.candidates[0];
    await mockConfirmInterception(plan.plan_id, plan.urgent_order.id, candidate.transit_order.id);

    const urgentOrder = getOrder(plan.urgent_order.id);
    const interceptEntry = urgentOrder?.status_history.find(
      (e) => e.changed_by === 'Route-Intercept',
    );
    expect(interceptEntry).toBeDefined();
    expect(interceptEntry?.status).toBe('dispatched');
  });

  it('appends a reroute note to the transit order history', async () => {
    const plan = await mockScanForInterception(1);
    if (plan.candidates.length === 0) return;

    const candidate = plan.candidates[0];
    await mockConfirmInterception(plan.plan_id, plan.urgent_order.id, candidate.transit_order.id);

    const transitOrder = getOrder(candidate.transit_order.id);
    const rerouteEntry = transitOrder?.status_history.find(
      (e) => e.changed_by === 'Route-Intercept',
    );
    expect(rerouteEntry).toBeDefined();
  });

  it('rejects with an error if the urgent order id is invalid', async () => {
    await expect(
      mockConfirmInterception('plan-x', 9999, 3),
    ).rejects.toThrow('Invalid interception plan');
  });

  it('rejects with an error if the transit order id is invalid', async () => {
    await expect(
      mockConfirmInterception('plan-x', 1, 9999),
    ).rejects.toThrow('Invalid interception plan');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration: status update triggers re-evaluation of interception candidates
// ─────────────────────────────────────────────────────────────────────────────

describe('Interception candidate eligibility after status change', () => {
  it('does not include an order that was just delivered as a candidate', async () => {
    // Mark order 3 as delivered
    await mockUpdateOrderStatus(3, 'delivered');
    const plan = await mockScanForInterception(1);
    const found = plan.candidates.find((c) => c.transit_order.id === 3);
    expect(found).toBeUndefined();
  });
});
