// Optional OpenAI enrichment. Every function has a deterministic fallback, so
// whisk is fully functional with no key. AI only expands and explains — it
// never replaces Wikipedia content, and everything still links to the source.
//
// SECURITY: the OpenAI key is NOT in the client. All calls go through the
// server-side proxy at /api/ai (api/ai.ts), which holds OPENAI_API_KEY in
// server env only. VITE_AI_ENABLED is a non-secret UI flag. See README.md.

import type { Page } from './types';

// Non-secret build-time flag: set VITE_AI_ENABLED=true wherever the server-side
// OPENAI_API_KEY is configured, so the UI reflects AI and we skip pointless
// requests when it is off.
export const AI_ENABLED = import.meta.env.VITE_AI_ENABLED === 'true';

async function chatJSON<T>(system: string, user: string): Promise<T | null> {
  if (!AI_ENABLED) return null;
  try {
    const resp = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ system, user }),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as { content?: string | null };
    if (!data.content) return null;
    return JSON.parse(data.content) as T;
  } catch (err) {
    console.warn('[whisk] AI call failed, using fallback:', err);
    return null;
  }
}

const stripHtml = (s: string) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------- query expand
/** Widen a natural-language query into extra search terms. */
export async function expandQuery(query: string): Promise<string[]> {
  const out = await chatJSON<{ terms: string[] }>(
    'You expand a curious search query into 3-5 concrete Wikipedia-friendly search phrases that surface obscure, specific, connected pages. Return JSON {"terms": string[]}. No explanations.',
    `Query: ${query}`,
  );
  return out?.terms?.slice(0, 5) ?? [];
}

// ---------------------------------------------------------- trend generalization
/**
 * Turn raw, often newsy Google Trends titles into evergreen, Wikipedia-friendly
 * topic phrases for "trending rabbit holes". Returns a map keyed by the original
 * trend title. With no AI, callers fall back to the raw trend title itself.
 */
export async function generalizeTrends(
  trends: Array<{ title: string; newsTitles?: string[] }>,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!AI_ENABLED || !trends.length) return map;

  const compact = trends.slice(0, 12).map((t) => ({
    t: t.title,
    n: (t.newsTitles ?? []).slice(0, 3),
  }));
  const out = await chatJSON<{ topics: Record<string, string> }>(
    'You map live Google search trends to a single evergreen, encyclopedic topic each — the kind of thing that has a rich Wikipedia article worth falling down a rabbit hole from. Use the trend only as a clue: prefer the person\'s body of work, the historical/cultural/scientific context, the sport/discipline, the place, the movement, or the era. Avoid breaking-news phrasing, allegations, deaths, disasters, and scores. Keep it concise (1-4 words, no punctuation). Return JSON {"topics": {trendTitle: topicPhrase}} with trendTitle copied verbatim.',
    `Trends: ${JSON.stringify(compact)}`,
  );
  if (out?.topics) {
    for (const [title, topic] of Object.entries(out.topics)) {
      if (topic?.trim()) map.set(title, topic.trim());
    }
  }
  return map;
}

// --------------------------------------------------------------- why it matched
export function fallbackMatchReason(query: string, page: Page): string {
  const bits: string[] = [];
  if (page.description) bits.push(cap(page.description));
  else if (page.instanceOf[0]) bits.push(cap(page.instanceOf[0]));
  const cats = page.categories.slice(0, 2).map(shortCat).filter(Boolean);
  if (cats.length) bits.push(`themes of ${cats.join(' & ')}`);
  if (page.timePeriod) bits.push(page.timePeriod);
  return bits.length ? bits.join(' · ') : `Related to “${query}”.`;
}

/** One batched call returns a short "why this matched" per page. */
export async function explainMatches(
  query: string,
  pages: Page[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const p of pages) map.set(p.title, fallbackMatchReason(query, p));
  if (!AI_ENABLED || !pages.length) return map;

  const compact = pages.slice(0, 24).map((p) => ({
    t: p.title,
    d: p.description ?? '',
    c: p.categories.slice(0, 4),
  }));
  const out = await chatJSON<{ reasons: Record<string, string> }>(
    'For each Wikipedia page, write ONE ≤14-word phrase explaining why it is an interesting match for the user\'s curious query. Concrete, no filler, no "This page". Return JSON {"reasons": {title: phrase}}.',
    `Query: ${query}\nPages: ${JSON.stringify(compact)}`,
  );
  if (out?.reasons) {
    for (const [title, reason] of Object.entries(out.reasons)) {
      if (reason?.trim()) map.set(title, reason.trim());
    }
  }
  return map;
}

// --------------------------------------------------------------- path narration
export function fallbackJumpReason(from: Page, to: Page): string {
  const shared = from.categories.filter((c) => to.categories.includes(c));
  if (shared.length) return `both touch ${shortCat(shared[0])}`;
  if (to.timePeriod && to.timePeriod === from.timePeriod)
    return `same era (${to.timePeriod})`;
  if (to.cluster === from.cluster) return `another ${clusterWord(to.cluster)}`;
  return `links onward to ${to.title}`;
}

export async function narratePath(
  steps: Page[],
): Promise<{ jumps: string[]; summary: string } | null> {
  if (!AI_ENABLED || steps.length < 2) return null;
  const chain = steps.map((s) => ({ t: s.title, d: s.description ?? '' }));
  return chatJSON<{ jumps: string[]; summary: string }>(
    'You narrate a Wikipedia rabbit-hole trail. Given an ordered list of pages, return JSON {"jumps": string[], "summary": string}. "jumps" has one ≤12-word connective phrase for each hop AFTER the first (length = pages-1), each explaining how the previous page leads to the next. "summary" is one vivid ≤30-word sentence describing the whole trail. Factual, no fabrication.',
    `Trail: ${JSON.stringify(chain)}`,
  );
}

// ------------------------------------------------------------ collection summary
export async function summarizeCollection(
  name: string,
  items: Array<{ title: string; description?: string }>,
): Promise<string> {
  const fallback = `${items.length} saved ${items.length === 1 ? 'item' : 'items'}${
    items.length ? ': ' + items.slice(0, 4).map((i) => i.title).join(', ') : ''
  }${items.length > 4 ? '…' : ''}`;
  if (!AI_ENABLED || !items.length) return fallback;
  const out = await chatJSON<{ summary: string }>(
    'Write one ≤35-word sentence describing the theme connecting these saved Wikipedia pages, as a research note. Return JSON {"summary": string}.',
    `Collection: ${name}\nItems: ${JSON.stringify(items.slice(0, 20))}`,
  );
  return out?.summary?.trim() || fallback;
}

// --------------------------------------------------------------------- helpers
function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function shortCat(c: string) {
  return c
    .replace(/\b(articles?|pages?|wikipedia|categories|stubs?)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
function clusterWord(c: Page['cluster']) {
  return c === 'people'
    ? 'person'
    : c === 'places'
      ? 'place'
      : c === 'events'
        ? 'event'
        : 'concept';
}
export { stripHtml };
