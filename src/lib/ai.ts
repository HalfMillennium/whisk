// Optional OpenAI enrichment. Every function has a deterministic fallback, so
// whisk is fully functional with no key. AI only expands and explains — it
// never replaces Wikipedia content, and everything still links to the source.
//
// SECURITY: the key is read from a VITE_ env var and therefore ships in the
// client bundle. Fine for local/personal use; put a proxy in front before any
// public deploy. See .env.example / README.md.

import type OpenAI from 'openai';
import type { Page } from './types';

const KEY = import.meta.env.VITE_OPENAI_API_KEY as string | undefined;
const MODEL = (import.meta.env.VITE_OPENAI_MODEL as string) || 'gpt-4o-mini';

export const AI_ENABLED = !!KEY;

let client: OpenAI | null = null;
// The OpenAI SDK is heavy, so we only import it lazily when a call actually fires.
async function ai(): Promise<OpenAI | null> {
  if (!KEY) return null;
  if (!client) {
    const { default: OpenAIClient } = await import('openai');
    client = new OpenAIClient({ apiKey: KEY, dangerouslyAllowBrowser: true });
  }
  return client;
}

async function chatJSON<T>(system: string, user: string): Promise<T | null> {
  const c = await ai();
  if (!c) return null;
  try {
    const res = await c.chat.completions.create({
      model: MODEL,
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    const text = res.choices[0]?.message?.content;
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch (err) {
    console.warn('[whisk] OpenAI call failed, using fallback:', err);
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
