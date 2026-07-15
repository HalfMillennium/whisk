// Daily challenge results — localStorage persistence, on-device only (same
// philosophy as collections). Keyed by UTC date so history accumulates and
// streaks can be computed without a backend.

import type { DailyResult } from '../lib/daily';

const KEY = 'whisk:daily:v1';

export function allResults(): Record<string, DailyResult> {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Record<string, DailyResult>;
  } catch {
    /* ignore */
  }
  return {};
}

export function getResult(dateKey: string): DailyResult | undefined {
  return allResults()[dateKey];
}

export function saveResult(r: DailyResult): void {
  try {
    const all = allResults();
    all[r.dateKey] = r;
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage full/blocked — session state still holds */
  }
}

/**
 * Consecutive days WON, walking back from today. Today counts if already won;
 * otherwise the streak starts from yesterday (playing later today can extend
 * it). A missed day or a gave-up breaks the chain.
 */
export function computeStreak(results: Record<string, DailyResult>, todayKey: string): number {
  let streak = 0;
  let cursor = Date.parse(`${todayKey}T00:00:00Z`);
  if (results[todayKey]?.status !== 'won') cursor -= 86_400_000;
  for (;;) {
    const key = new Date(cursor).toISOString().slice(0, 10);
    if (results[key]?.status !== 'won') break;
    streak++;
    cursor -= 86_400_000;
  }
  return streak;
}
