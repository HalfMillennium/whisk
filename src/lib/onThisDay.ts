// "On this day" — Wikipedia's curated anniversary feed for the landing page.
// Uses the `selected` type (editor-picked highlights, not the raw deaths list)
// and runs everything through the same deterministic safety filter as trends,
// so the landing page never leads with violence or disaster.

import { restOnThisDay } from './wiki/client';
import { cacheGet, cacheSet } from './wiki/cache';
import { isSafeTrend } from './safety';
import { msUntilNextUtcMidnight, utcDateKey } from './daily';

export interface OnThisDayLink {
  title: string;
  description?: string;
  thumbnail?: string;
}

export interface OnThisDayItem {
  year?: number;
  text: string;
  pages: OnThisDayLink[];
}

export interface RawFeedPage {
  titles: { normalized: string };
  description?: string;
  thumbnail?: { source: string };
  extract?: string;
}

export interface RawFeedEvent {
  text: string;
  year?: number;
  pages?: RawFeedPage[];
}

const MAX_PAGES_PER_EVENT = 2;

/** Pure mapper: raw feed events → safe, render-ready items. */
export function mapFeedEvents(raw: RawFeedEvent[], limit: number): OnThisDayItem[] {
  return raw
    .filter((e) => e.text && e.pages?.length)
    .filter((e) => isSafeTrend({ title: e.text, newsTitles: [] }))
    .slice(0, limit)
    .map((e) => ({
      year: e.year,
      text: e.text,
      pages: e.pages!.slice(0, MAX_PAGES_PER_EVENT).map((p) => ({
        title: p.titles.normalized,
        description: p.description,
        thumbnail: p.thumbnail?.source,
      })),
    }));
}

/**
 * Today's (UTC) anniversary highlights, cached until the next UTC midnight so
 * the section flips with the daily puzzle. Degrades to [] — never throws.
 */
export async function getOnThisDay(limit = 5): Promise<OnThisDayItem[]> {
  const [, mm, dd] = utcDateKey().split('-');
  const key = `otd:selected:${mm}-${dd}:v1`;
  const hit = cacheGet<OnThisDayItem[]>(key);
  if (hit) return hit;
  try {
    const data = await restOnThisDay<{ selected?: RawFeedEvent[] }>('selected', mm, dd);
    const items = mapFeedEvents(data.selected ?? [], limit);
    if (items.length) cacheSet(key, items, msUntilNextUtcMidnight());
    return items;
  } catch {
    return [];
  }
}
