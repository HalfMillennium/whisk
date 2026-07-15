// Low-level Wikimedia HTTP client: anonymous CORS, concurrency limiting,
// 429-aware backoff, and Action-API continuation handling.

export const WIKI_LANG = 'en';
export const WIKI_HOST = `https://${WIKI_LANG}.wikipedia.org`;
const ACTION_API = `${WIKI_HOST}/w/api.php`;
const REST = `${WIKI_HOST}/api/rest_v1`;
const ANALYTICS = 'https://wikimedia.org/api/rest_v1';

// --- polite concurrency gate -------------------------------------------------
const MAX_CONCURRENT = 4;
let active = 0;
const queue: Array<() => void> = [];

function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active++;
    return Promise.resolve();
  }
  return new Promise((resolve) => queue.push(resolve));
}
function release() {
  active--;
  const next = queue.shift();
  if (next) {
    active++;
    next();
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function politeFetch(url: string, attempt = 0): Promise<Response> {
  await acquire();
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (res.status === 429 && attempt < 3) {
      const retry = Number(res.headers.get('retry-after')) || 1;
      await sleep(retry * 1000 + attempt * 400);
      release();
      return politeFetch(url, attempt + 1);
    }
    return res;
  } finally {
    release();
  }
}

export class WikiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'WikiError';
    this.status = status;
  }
}

async function getJSON<T>(url: string): Promise<T> {
  const res = await politeFetch(url);
  if (!res.ok) {
    throw new WikiError(`Wikimedia request failed (${res.status})`, res.status);
  }
  return (await res.json()) as T;
}

// --- Action API --------------------------------------------------------------
export interface ActionParams {
  [k: string]: string | number | undefined;
}

/** Single Action API request (origin=* for anonymous CORS). */
export function actionQuery<T>(params: ActionParams): Promise<T> {
  const usp = new URLSearchParams({
    format: 'json',
    formatversion: '2',
    origin: '*',
  });
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) usp.set(k, String(v));
  }
  return getJSON<T>(`${ACTION_API}?${usp.toString()}`);
}

/**
 * Action API request that follows `continue` tokens, merging `query` pages.
 * Bounded by `maxRounds` so a huge page can't spin forever.
 */
export async function actionQueryAll(
  params: ActionParams,
  maxRounds = 6,
): Promise<any[]> {
  const pages: Record<number, any> = {};
  let cont: Record<string, string> = {};
  for (let round = 0; round < maxRounds; round++) {
    const data = await actionQuery<any>({ ...params, ...cont });
    const got = data?.query?.pages ?? [];
    for (const p of got) {
      const id = p.pageid ?? p.title;
      pages[id] = mergePage(pages[id], p);
    }
    if (data.continue) cont = data.continue;
    else break;
  }
  return Object.values(pages);
}

function mergePage(a: any, b: any): any {
  if (!a) return b;
  const out = { ...a, ...b };
  for (const key of ['links', 'categories', 'linkshere']) {
    if (a[key] || b[key]) out[key] = [...(a[key] ?? []), ...(b[key] ?? [])];
  }
  return out;
}

// --- REST v1 -----------------------------------------------------------------
export function restSummary<T>(title: string): Promise<T> {
  return getJSON<T>(`${REST}/page/summary/${encodeURIComponent(title)}`);
}

export function restRelated<T>(title: string): Promise<T> {
  return getJSON<T>(`${REST}/page/related/${encodeURIComponent(title)}`);
}

export type OnThisDayType = 'selected' | 'events' | 'births' | 'deaths' | 'holidays';

/** Wikipedia's daily anniversary feed (CORS-enabled, keyless). mm/dd zero-padded. */
export function restOnThisDay<T>(type: OnThisDayType, mm: string, dd: string): Promise<T> {
  return getJSON<T>(`${REST}/feed/onthisday/${type}/${mm}/${dd}`);
}

// --- Analytics / Pageviews ---------------------------------------------------
export async function pageviews(title: string, days = 30): Promise<number | undefined> {
  const end = new Date();
  const start = new Date(end.getTime() - days * 864e5);
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(
      d.getUTCDate(),
    ).padStart(2, '0')}`;
  const article = encodeURIComponent(title.replace(/ /g, '_'));
  const url = `${ANALYTICS}/metrics/pageviews/per-article/${WIKI_LANG}.wikipedia/all-access/user/${article}/daily/${fmt(
    start,
  )}/${fmt(end)}`;
  try {
    const data = await getJSON<{ items?: Array<{ views: number }> }>(url);
    if (!data.items?.length) return undefined;
    return data.items.reduce((sum, it) => sum + (it.views ?? 0), 0);
  } catch {
    // Analytics API can rate-limit or block; treat as "unknown", never fatal.
    return undefined;
  }
}

export const wikiPageUrl = (title: string) =>
  `${WIKI_HOST}/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
