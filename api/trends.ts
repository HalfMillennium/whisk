/// <reference types="node" />
// Server-side Google Trends proxy. The trending RSS feed is public (no key) but
// is NOT CORS-accessible from the browser, so we fetch it here and hand the
// client a clean JSON list. Mirrors the shape of api/ai.ts: a pure runTrends()
// used both by the Vercel Serverless entrypoint and by the dev middleware in
// vite.config.ts, so `npm run dev` behaves identically to production.

export interface RawTrend {
  title: string;
  trafficLabel?: string;
  publishedAt?: string;
  newsTitles: string[];
}

export interface TrendsPayload {
  updatedAt: string;
  source: 'google-trends-rss';
  items: RawTrend[];
}

export type TrendsResult = { status: number; json: unknown };

const MAX_TRENDS = 8;
const PARSE_LIMIT = 24; // parse extra so the safety filter can trim without starving MAX_TRENDS.
const TTL_MS = 1000 * 60 * 60 * 3; // 3h — matches the client cache + s-maxage.

// Deterministic safety-cleaning layer — see src/lib/safety.ts. We drop any
// trend whose title OR associated news headlines match the blocklist, server-
// side, before the client ever sees the feed. Re-exported here so existing
// consumers (tests) keep their import path.
import { isSafeTrend, cleanTrends } from '../src/lib/safety.ts';
export { isSafeTrend, cleanTrends };

// Module-scoped in-memory cache. Serverless instances are ephemeral, so the
// HTTP Cache-Control header below is the real cross-request cache; this just
// spares a warm instance from refetching on back-to-back hits.
let memo: { at: number; data: TrendsPayload } | null = null;

// Caching is prod-only by default so local dev always fetches fresh trends.
// Override with TRENDS_CACHE=true|false. (Vite dev sets NODE_ENV=development;
// Vercel prod sets production.)
function cacheEnabled(): boolean {
  const flag = process.env.TRENDS_CACHE;
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  return process.env.NODE_ENV === 'production';
}

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstTag(block: string, tag: string): string | undefined {
  // Escape the ':' in namespaced tags (e.g. ht:approx_traffic) for the regex.
  const re = new RegExp(`<${tag.replace(':', '\\:')}[^>]*>([\\s\\S]*?)</${tag.replace(':', '\\:')}>`, 'i');
  const m = block.match(re);
  return m ? decodeEntities(m[1]) : undefined;
}

function allTags(block: string, tag: string): string[] {
  const re = new RegExp(`<${tag.replace(':', '\\:')}[^>]*>([\\s\\S]*?)</${tag.replace(':', '\\:')}>`, 'gi');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) out.push(decodeEntities(m[1]));
  return out;
}

// Small, dependency-free RSS parser. The Google Trends feed is compact and
// well-formed; we walk each <item> block rather than pull in an XML library.
export function parseTrendsRss(xml: string): RawTrend[] {
  const items: RawTrend[] = [];
  const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) && items.length < PARSE_LIMIT) {
    const block = m[1];
    const title = firstTag(block, 'title');
    if (!title) continue;
    items.push({
      title,
      trafficLabel: firstTag(block, 'ht:approx_traffic'),
      publishedAt: firstTag(block, 'pubDate'),
      newsTitles: allTags(block, 'ht:news_item_title').slice(0, 3),
    });
  }
  return items;
}

export async function runTrends(geo?: string): Promise<TrendsResult> {
  const region = (geo || process.env.TRENDS_GEO || 'US').toUpperCase();

  if (cacheEnabled() && memo && Date.now() - memo.at < TTL_MS) {
    return { status: 200, json: memo.data };
  }

  try {
    const res = await fetch(`https://trends.google.com/trending/rss?geo=${encodeURIComponent(region)}`, {
      headers: {
        'User-Agent': 'whisk/0.1 (trending rabbit holes)',
        Accept: 'application/rss+xml, application/xml, text/xml',
      },
    });
    if (!res.ok) {
      // Serve stale on upstream error if we have anything cached.
      if (memo) return { status: 200, json: memo.data };
      return { status: 502, json: { error: 'upstream', status: res.status } };
    }
    const xml = await res.text();
    // Deterministic safety filter runs before caching, so flagged trends never
    // reach the client — and before the MAX_TRENDS cap, so we don't starve the
    // list when several are dropped.
    const items = cleanTrends(parseTrendsRss(xml)).slice(0, MAX_TRENDS);
    const data: TrendsPayload = {
      updatedAt: new Date().toISOString(),
      source: 'google-trends-rss',
      items,
    };
    memo = { at: Date.now(), data };
    return { status: 200, json: data };
  } catch (err) {
    if (memo) return { status: 200, json: memo.data };
    return { status: 502, json: { error: 'fetch_failed', detail: String(err) } };
  }
}

// Vercel Node serverless entrypoint. Typed loosely to avoid a hard dependency
// on @vercel/node; the runtime provides Node-style req/res.
export default async function handler(
  req: { method?: string; query?: Record<string, string | string[]> },
  res: {
    status: (code: number) => { json: (data: unknown) => void };
    setHeader: (name: string, value: string) => void;
  },
): Promise<void> {
  if (req.method && req.method !== 'GET') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }
  const geoParam = req.query?.geo;
  const geo = Array.isArray(geoParam) ? geoParam[0] : geoParam;
  const { status, json } = await runTrends(geo);
  // Browser 10m, CDN 3h, then serve stale for a day while revalidating.
  res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=10800, stale-while-revalidate=86400');
  res.status(status).json(json);
}
