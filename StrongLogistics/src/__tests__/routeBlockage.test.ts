/**
 * Test specifications — Route Blockage
 *
 * Covers: mockBlockRoute, mockUnblockRoute, mockGetBlockedRoutes, mockIsPointBlocked
 *
 * A "route blockage" marks a delivery point as temporarily unreachable
 * (e.g. road closure, access restriction).  The adaptive routing subsystem
 * uses this list to warn dispatchers and avoid blocked destinations.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  blockedRoutes,
  mockBlockRoute,
  mockUnblockRoute,
  mockGetBlockedRoutes,
  mockIsPointBlocked,
} from '../api/mockDb';

// ─────────────────────────────────────────────────────────────────────────────
// Test isolation — clear the shared blockedRoutes array before each test
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  blockedRoutes.splice(0);
});

// ─────────────────────────────────────────────────────────────────────────────
// mockBlockRoute
// ─────────────────────────────────────────────────────────────────────────────

describe('mockBlockRoute', () => {
  it('creates a blockage entry and returns it', async () => {
    const blockage = await mockBlockRoute(1, 'Road flooded');
    expect(blockage.point_id).toBe(1);
    expect(blockage.reason).toBe('Road flooded');
    expect(typeof blockage.id).toBe('string');
    expect(blockage.id.length).toBeGreaterThan(0);
  });

  it('adds the blockage to the shared store', async () => {
    await mockBlockRoute(2, 'Bridge closed');
    expect(blockedRoutes).toHaveLength(1);
    expect(blockedRoutes[0].point_id).toBe(2);
  });

  it('does not create a duplicate blockage for the same point', async () => {
    await mockBlockRoute(3, 'Reason A');
    const second = await mockBlockRoute(3, 'Reason B');
    // Should return the existing blockage, not create another entry
    expect(blockedRoutes).toHaveLength(1);
    expect(second.reason).toBe('Reason A');
  });

  it('sets created_at to a valid ISO timestamp', async () => {
    const blockage = await mockBlockRoute(1, 'test');
    expect(() => new Date(blockage.created_at)).not.toThrow();
    expect(new Date(blockage.created_at).toISOString()).toBe(blockage.created_at);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// mockUnblockRoute
// ─────────────────────────────────────────────────────────────────────────────

describe('mockUnblockRoute', () => {
  it('removes an existing blockage by id', async () => {
    const blockage = await mockBlockRoute(1, 'test');
    await mockUnblockRoute(blockage.id);
    expect(blockedRoutes).toHaveLength(0);
  });

  it('does nothing when the blockage id does not exist', async () => {
    await mockBlockRoute(1, 'test');
    await mockUnblockRoute('nonexistent-id');
    // The existing blockage should still be present
    expect(blockedRoutes).toHaveLength(1);
  });

  it('only removes the targeted blockage when multiple exist', async () => {
    const b1 = await mockBlockRoute(1, 'first');
    await mockBlockRoute(2, 'second');
    await mockUnblockRoute(b1.id);
    expect(blockedRoutes).toHaveLength(1);
    expect(blockedRoutes[0].point_id).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// mockGetBlockedRoutes
// ─────────────────────────────────────────────────────────────────────────────

describe('mockGetBlockedRoutes', () => {
  it('returns an empty array when no routes are blocked', async () => {
    const result = await mockGetBlockedRoutes();
    expect(result).toEqual([]);
  });

  it('returns all current blockages', async () => {
    await mockBlockRoute(1, 'A');
    await mockBlockRoute(2, 'B');
    const result = await mockGetBlockedRoutes();
    expect(result).toHaveLength(2);
    expect(result.map((b) => b.point_id).sort()).toEqual([1, 2]);
  });

  it('returns a shallow copy (not the original array reference)', async () => {
    const result = await mockGetBlockedRoutes();
    expect(result).not.toBe(blockedRoutes);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// mockIsPointBlocked
// ─────────────────────────────────────────────────────────────────────────────

describe('mockIsPointBlocked', () => {
  it('returns false when no routes are blocked', () => {
    expect(mockIsPointBlocked(1)).toBe(false);
  });

  it('returns true after blocking a point', async () => {
    await mockBlockRoute(1, 'test');
    expect(mockIsPointBlocked(1)).toBe(true);
  });

  it('returns false for a different point id', async () => {
    await mockBlockRoute(1, 'test');
    expect(mockIsPointBlocked(2)).toBe(false);
  });

  it('returns false after the blockage is removed', async () => {
    const b = await mockBlockRoute(1, 'test');
    await mockUnblockRoute(b.id);
    expect(mockIsPointBlocked(1)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Full round-trip
// ─────────────────────────────────────────────────────────────────────────────

describe('Route blockage round-trip', () => {
  it('block → verify → unblock → verify lifecycle', async () => {
    // Initially unblocked
    expect(mockIsPointBlocked(4)).toBe(false);

    // Block
    const b = await mockBlockRoute(4, 'Road under repair');
    expect(mockIsPointBlocked(4)).toBe(true);
    const all = await mockGetBlockedRoutes();
    expect(all.some((r) => r.point_id === 4)).toBe(true);

    // Unblock
    await mockUnblockRoute(b.id);
    expect(mockIsPointBlocked(4)).toBe(false);
    const allAfter = await mockGetBlockedRoutes();
    expect(allAfter.some((r) => r.point_id === 4)).toBe(false);
  });
});
