// "Trending rabbit holes" — resolves live Google search trends into whisk-native
// open-ended walks. The raw trends come from the server proxy at /api/trends
// (Google Trends RSS isn't CORS-accessible from the browser); we then resolve
// each to a Wikipedia article and enrich it for the card. Cached 3h, matching
// the feed's refresh cadence and the server's Cache-Control s-maxage.

import { cacheGet, cacheSet } from './wiki/cache';
import { fullTextSearch } from './wiki/search';
import { enrichTitles } from './wiki/page';
import { generalizeTrends } from './ai';
import type { RawTrend } from '../../api/trends';

export interface TrendingHole {
  /** Resolved Wikipedia article title — used as the walk's `from`. */
  title: string;
  /** Card label (the generalized/raw trend topic). */
  label: string;
  /** Raw Google Trends title (verbatim search term) — used by the "Try" pills. */
  trend: string;
  description?: string;
  thumbnail?: string;
  trafficLabel?: string;
}

const CACHE_KEY = 'trends:holes:v2';
const TTL = 1000 * 60 * 60 * 3; // 3h
const MAX_HOLES = 6;

// Caching is prod-only by default so `npm run dev` always fetches fresh trends
// (no stale 3h localStorage entry to fight while iterating). Override with
// VITE_TRENDS_CACHE=true|false.
const CACHE_FLAG = import.meta.env.VITE_TRENDS_CACHE as string | undefined;
const CACHE_ENABLED =
  CACHE_FLAG != null && CACHE_FLAG !== '' ? CACHE_FLAG === 'true' : import.meta.env.PROD;

async function fetchRawTrends(): Promise<RawTrend[]> {
  try {
    const resp = await fetch('/api/trends');
    if (!resp.ok) return [];
    const data = (await resp.json()) as { items?: RawTrend[] };
    return data.items ?? [];
  } catch {
    return [];
  }
}

async function buildTrendingHoles(): Promise<TrendingHole[]> {
  const trends = await fetchRawTrends();
  if (!trends.length) return [];

  // Optional AI: generalize newsy trend titles into evergreen topics. Falls back
  // to the raw trend title when AI is off or a given trend isn't mapped.
  const topics = await generalizeTrends(trends);
  const searches = trends.map((t) => ({ trend: t, topic: topics.get(t.title) || t.title }));

  // Resolve each topic to the top Wikipedia hit (deterministic, no key needed).
  // Per-item settle: a single failed search must not empty the whole set.
  const settled = await Promise.allSettled(
    searches.map(async (s) => {
      const hits = await fullTextSearch(s.topic, 1);
      const title = hits[0]?.title;
      return title ? { ...s, title } : null;
    }),
  );
  const resolved = settled.map((r) => (r.status === 'fulfilled' ? r.value : null));

  // Dedupe by resolved article, keeping the first (highest-ranked trend).
  const seen = new Set<string>();
  const picks = resolved
    .filter((r): r is NonNullable<typeof r> => !!r)
    .filter((r) => (seen.has(r.title) ? false : (seen.add(r.title), true)))
    .slice(0, MAX_HOLES);
  if (!picks.length) return [];

  // One batched enrich pass for description + thumbnail. Enrichment is
  // best-effort — if it fails we still return cards (just without blurbs).
  const pages = await enrichTitles(picks.map((p) => p.title)).catch(() => []);
  const byTitle = new Map(pages.map((p) => [p.title, p]));

  return picks.map((p) => {
    const page = byTitle.get(p.title);
    return {
      title: p.title,
      label: p.topic,
      trend: p.trend.title,
      description: page?.description ?? page?.extract,
      thumbnail: page?.thumbnail,
      trafficLabel: p.trend.trafficLabel,
    };
  });
}

/**
 * Trending rabbit holes, cached for 3h in memory + localStorage. We cache only
 * NON-EMPTY results: caching an empty array would pin the static fallback for
 * 3h whenever the feed/API had a transient hiccup. Errors also degrade to [].
 */
export async function getTrendingHoles(): Promise<TrendingHole[]> {
  if (CACHE_ENABLED) {
    const hit = cacheGet<TrendingHole[]>(CACHE_KEY);
    if (hit && hit.length) return hit;
  }
  let holes: TrendingHole[] = [];
  try {
    holes = await buildTrendingHoles();
  } catch {
    holes = [];
  }
  if (CACHE_ENABLED && holes.length) cacheSet(CACHE_KEY, holes, TTL);
  return holes;
}
