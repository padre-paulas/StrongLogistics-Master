/**
 * Order-weight (urgency score) calculation.
 *
 * The system automatically determines the weight of every request based on
 * three factors:
 *   1. Demand level — Normal (1), Elevated (2), Critical / Urgent (3)
 *   2. Current resource-remainder percentage at the delivery point
 *   3. Admin-set demand level for the resource at that point
 *
 * Formula
 * ───────
 *   weight = priorityBase + round((1 – stockPct / 100) × 20) + demandBonus
 *
 * priorityBase values: Normal = 20, Elevated = 50, Critical = 80
 * The stock-urgency term adds up to +20 when stock is fully depleted,
 * so the theoretical maximum is 100.
 * demandBonus: Low = −10, Normal = 0, High = +10, Surge = +20
 *
 * Range overview (no demand override)
 * ──────────────
 *   Normal   + full stock → 20   │ Normal   + empty stock → 40
 *   Elevated + full stock → 50   │ Elevated + empty stock → 70
 *   Critical + full stock → 80   │ Critical + empty stock → 100
 */

import type { Priority, DemandLevel } from '../types';

export const PRIORITY_BASE_WEIGHTS: Record<Priority, number> = {
  normal: 20,
  elevated: 50,
  critical: 80,
};

/** Weight bonus applied based on the admin-set demand level. */
export const DEMAND_BONUS: Record<DemandLevel, number> = {
  low: -10,
  normal: 0,
  high: 10,
  surge: 20,
};

/**
 * Nominal storage capacity per resource ID.
 * Used to convert an absolute stock quantity into a 0-100 % figure.
 * Falls back to 500 for unknown resource IDs.
 */
export const NOMINAL_CAPACITIES: Record<number, number> = {
  1: 2000, // Fuel (litres)
  2: 1000, // Water (litres)
  3: 100,  // Medical Supplies (kits)
  4: 500,  // Food Rations (boxes)
  5: 50,   // Spare Parts (units)
};

/**
 * Returns the stock-remaining percentage (0 – 100) for a given resource
 * at a delivery point's stock array.
 */
export function getStockRemainingPct(
  stock: Array<{ resource_id: number; quantity: number }>,
  resourceId: number,
): number {
  const item = stock.find((s) => s.resource_id === resourceId);
  const qty = item?.quantity ?? 0;
  const nominal = NOMINAL_CAPACITIES[resourceId] ?? 500;
  return Math.min(100, Math.round((qty / nominal) * 100));
}

/**
 * Calculates the urgency weight (0 – 100) for a single order request.
 *
 * @param priority        Order priority level.
 * @param stockRemainingPct  Percentage of stock remaining at the destination
 *                           (0 = empty, 100 = at/above nominal capacity).
 * @param demandLevel     Optional admin-set demand level for this resource at
 *                        this delivery point; defaults to 'normal' (no bonus).
 */
export function calculateOrderWeight(
  priority: Priority,
  stockRemainingPct: number,
  demandLevel?: DemandLevel,
): number {
  const base = PRIORITY_BASE_WEIGHTS[priority];
  const stockUrgency = Math.round((1 - stockRemainingPct / 100) * 20);
  const demandBonus = demandLevel ? DEMAND_BONUS[demandLevel] : 0;
  return Math.min(100, Math.max(0, base + stockUrgency + demandBonus));
}

/** Human-readable label for a weight score. */
export function weightLabel(weight: number): 'Low' | 'Medium' | 'High' {
  if (weight >= 70) return 'High';
  if (weight >= 40) return 'Medium';
  return 'Low';
}
