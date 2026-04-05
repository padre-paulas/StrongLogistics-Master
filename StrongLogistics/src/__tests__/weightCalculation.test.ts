/**
 * Test specifications — Weight Calculation
 *
 * Covers: calculateOrderWeight, getStockRemainingPct, weightLabel
 *
 * The urgency-weight formula is:
 *   weight = priorityBase + round((1 – stockPct / 100) × 20)
 *
 *   priorityBase: normal=20, elevated=50, critical=80
 *   Stock-urgency adds up to +20 when stock is empty, 0 when stock is full.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateOrderWeight,
  getStockRemainingPct,
  weightLabel,
  PRIORITY_BASE_WEIGHTS,
  NOMINAL_CAPACITIES,
} from '../utils/weightCalculation';

// ─────────────────────────────────────────────────────────────────────────────
// calculateOrderWeight
// ─────────────────────────────────────────────────────────────────────────────

describe('calculateOrderWeight', () => {
  it('returns the base weight for normal priority when stock is full (100%)', () => {
    expect(calculateOrderWeight('normal', 100)).toBe(PRIORITY_BASE_WEIGHTS.normal);
  });

  it('returns the base weight for elevated priority when stock is full', () => {
    expect(calculateOrderWeight('elevated', 100)).toBe(PRIORITY_BASE_WEIGHTS.elevated);
  });

  it('returns the base weight for critical priority when stock is full', () => {
    expect(calculateOrderWeight('critical', 100)).toBe(PRIORITY_BASE_WEIGHTS.critical);
  });

  it('adds full stock-urgency bonus (+20) when stock is 0%', () => {
    expect(calculateOrderWeight('normal', 0)).toBe(PRIORITY_BASE_WEIGHTS.normal + 20);
    expect(calculateOrderWeight('elevated', 0)).toBe(PRIORITY_BASE_WEIGHTS.elevated + 20);
    expect(calculateOrderWeight('critical', 0)).toBe(PRIORITY_BASE_WEIGHTS.critical + 20);
  });

  it('caps the maximum weight at 100', () => {
    // critical (80) + 20 stock urgency = 100
    expect(calculateOrderWeight('critical', 0)).toBe(100);
  });

  it('adds a partial stock-urgency bonus for 50% remaining stock', () => {
    // stockUrgency = round((1 - 50/100) * 20) = round(10) = 10
    expect(calculateOrderWeight('normal', 50)).toBe(PRIORITY_BASE_WEIGHTS.normal + 10);
    expect(calculateOrderWeight('elevated', 50)).toBe(PRIORITY_BASE_WEIGHTS.elevated + 10);
  });

  it('returns a higher weight for critical than elevated at the same stock level', () => {
    expect(calculateOrderWeight('critical', 50)).toBeGreaterThan(calculateOrderWeight('elevated', 50));
    expect(calculateOrderWeight('elevated', 50)).toBeGreaterThan(calculateOrderWeight('normal', 50));
  });

  it('returns a higher weight when stock is lower (more urgent)', () => {
    const highStock = calculateOrderWeight('elevated', 80);
    const lowStock = calculateOrderWeight('elevated', 20);
    expect(lowStock).toBeGreaterThan(highStock);
  });

  it('does not exceed 100 for any valid input', () => {
    const priorities = ['normal', 'elevated', 'critical'] as const;
    const stockLevels = [0, 25, 50, 75, 100];
    for (const p of priorities) {
      for (const s of stockLevels) {
        expect(calculateOrderWeight(p, s)).toBeLessThanOrEqual(100);
      }
    }
  });

  it('always returns a non-negative weight', () => {
    expect(calculateOrderWeight('normal', 100)).toBeGreaterThanOrEqual(0);
    expect(calculateOrderWeight('critical', 0)).toBeGreaterThanOrEqual(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getStockRemainingPct
// ─────────────────────────────────────────────────────────────────────────────

describe('getStockRemainingPct', () => {
  it('returns 0 when no matching resource is found in stock', () => {
    expect(getStockRemainingPct([], 1)).toBe(0);
  });

  it('returns 0 when stock quantity is 0', () => {
    const stock = [{ resource_id: 1, quantity: 0 }];
    expect(getStockRemainingPct(stock, 1)).toBe(0);
  });

  it('returns 100 when stock equals nominal capacity', () => {
    const stock = [{ resource_id: 1, quantity: NOMINAL_CAPACITIES[1] }];
    expect(getStockRemainingPct(stock, 1)).toBe(100);
  });

  it('caps at 100 when stock exceeds nominal capacity', () => {
    const stock = [{ resource_id: 1, quantity: NOMINAL_CAPACITIES[1] * 2 }];
    expect(getStockRemainingPct(stock, 1)).toBe(100);
  });

  it('returns proportional percentage for intermediate values', () => {
    // Fuel nominal = 2000; 1000 litres = 50%
    const stock = [{ resource_id: 1, quantity: 1000 }];
    expect(getStockRemainingPct(stock, 1)).toBe(50);
  });

  it('uses fallback nominal capacity of 500 for unknown resource IDs', () => {
    // Unknown resource ID 99 — fallback = 500; 250 units = 50%
    const stock = [{ resource_id: 99, quantity: 250 }];
    expect(getStockRemainingPct(stock, 99)).toBe(50);
  });

  it('picks the correct resource when multiple are present', () => {
    const stock = [
      { resource_id: 1, quantity: 2000 }, // 100%
      { resource_id: 2, quantity: 0 },     // 0%
    ];
    expect(getStockRemainingPct(stock, 1)).toBe(100);
    expect(getStockRemainingPct(stock, 2)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// weightLabel
// ─────────────────────────────────────────────────────────────────────────────

describe('weightLabel', () => {
  it('returns "Low" for weights below 40', () => {
    expect(weightLabel(0)).toBe('Low');
    expect(weightLabel(20)).toBe('Low');
    expect(weightLabel(39)).toBe('Low');
  });

  it('returns "Medium" for weights from 40 to 69', () => {
    expect(weightLabel(40)).toBe('Medium');
    expect(weightLabel(55)).toBe('Medium');
    expect(weightLabel(69)).toBe('Medium');
  });

  it('returns "High" for weights 70 and above', () => {
    expect(weightLabel(70)).toBe('High');
    expect(weightLabel(85)).toBe('High');
    expect(weightLabel(100)).toBe('High');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Priority ordering invariant
// ─────────────────────────────────────────────────────────────────────────────

describe('Priority ordering invariant', () => {
  it('critical always outweighs elevated, which always outweighs normal at equal stock levels', () => {
    const stockLevels = [0, 20, 50, 80, 100];
    for (const s of stockLevels) {
      const normal = calculateOrderWeight('normal', s);
      const elevated = calculateOrderWeight('elevated', s);
      const critical = calculateOrderWeight('critical', s);
      expect(critical).toBeGreaterThan(elevated);
      expect(elevated).toBeGreaterThan(normal);
    }
  });
});
