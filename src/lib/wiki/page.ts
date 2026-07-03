// Page enrichment. Two entry points:
//   enrichTitles()  — fast batch enrichment for search result sets.
//   getPage()       — deep single-page enrichment for the article/dossier view.

import {
  actionQuery,
  pageviews,
  wikiPageUrl,
  WIKI_LANG,
} from './client';
import { cached, cacheGet, cacheSet } from './cache';
import { typeEntities } from './wikidata';
import type { ClusterType, Page } from '../types';

const DISPUTE_RE =
  /(dispute|disputed|unreliable|unverified|unsourced|accuracy|neutrality|npov|citation needed|original research|contradict)/i;

const CENTURY_RE = /(\d{1,2})(?:st|nd|rd|th)[-\s]century/i;
const DECADE_RE = /\b(\d{3,4})s\b/;
const YEAR_RE = /\b(1\d{3}|20\d{2}|\d{1,3}\s?(?:BC|AD))\b/;

interface RawPage {
  pageid: number;
  title: string;
  extract?: string;
  description?: string;
  thumbnail?: { source: string };
  coordinates?: Array<{ lat: number; lon: number }>;
  categories?: Array<{ title: string; hidden?: boolean }>;
  pageprops?: { wikibase_item?: string; disambiguation?: string };
  touched?: string;
  protection?: Array<{ type: string; level: string }>;
  fullurl?: string;
}

function cleanCategories(cats?: Array<{ title: string; hidden?: boolean }>) {
  const visible: string[] = [];
  const all: string[] = [];
  for (const c of cats ?? []) {
    const name = c.title.replace(/^Category:/, '');
    all.push(name);
    if (!c.hidden) visible.push(name);
  }
  return { visible, all };
}

export function deriveTimePeriod(categories: string[], extract?: string): string | undefined {
  const hay = categories.join(' ') + ' ' + (extract?.slice(0, 240) ?? '');
  const century = hay.match(CENTURY_RE);
  if (century) return `${century[1]}${ordinal(+century[1])} century`;
  for (const era of ['Ancient', 'Medieval', 'Middle Ages', 'Renaissance', 'Prehistoric']) {
    if (hay.includes(era)) return era === 'Middle Ages' ? 'Medieval' : era;
  }
  const year = extract?.match(YEAR_RE) || categories.join(' ').match(YEAR_RE);
  if (year) return year[1];
  const decade = categories.join(' ').match(DECADE_RE);
  if (decade) return `${decade[1]}s`;
  return undefined;
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

const PLACE_HINT =
  /(country|city|town|village|region|province|state|county|island|mountain|river)/i;

export function derivePlace(categories: string[], description?: string): string | undefined {
  if (description) {
    const m = description.match(/\bin ([A-Z][\w'-]+(?: [A-Z][\w'-]+){0,2})/);
    if (m) return m[1];
  }
  const cat = categories.find((c) => PLACE_HINT.test(c) && /\bin\b/.test(c));
  if (cat) {
    const m = cat.match(/\bin ([A-Z][\w'-]+(?: [A-Z][\w'-]+){0,2})/);
    if (m) return m[1];
  }
  return undefined;
}

function rawToPage(raw: RawPage): Page {
  const { visible, all } = cleanCategories(raw.categories);
  return {
    title: raw.title,
    pageid: raw.pageid,
    description: raw.description,
    extract: raw.extract,
    thumbnail: raw.thumbnail?.source,
    url: raw.fullurl || wikiPageUrl(raw.title),
    lang: WIKI_LANG,
    wikidataId: raw.pageprops?.wikibase_item,
    cluster: 'other',
    instanceOf: [],
    categories: visible,
    coordinates: raw.coordinates?.[0]
      ? { lat: raw.coordinates[0].lat, lon: raw.coordinates[0].lon }
      : undefined,
    timePeriod: deriveTimePeriod(all, raw.extract),
    place: derivePlace(visible, raw.description),
    lastEdited: raw.touched,
    protection: (raw.protection ?? [])
      .filter((p) => p.type === 'edit' && p.level && p.level !== '')
      .map((p) => `${p.type}=${p.level}`),
    disputed: all.some((c) => DISPUTE_RE.test(c)),
  };
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/** Fast batch enrichment (no pageviews / inbound / external links). */
export async function enrichTitles(titles: string[]): Promise<Page[]> {
  const byTitle: Record<string, Page> = {};
  // extracts is limited to 20 titles per call — batch accordingly.
  for (const group of chunk(titles, 20)) {
    if (!group.length) continue;
    const data = await actionQuery<any>({
      action: 'query',
      titles: group.join('|'),
      prop: 'extracts|pageimages|pageprops|info|coordinates|description|categories',
      exintro: 1,
      explaintext: 1,
      exsentences: 3,
      exlimit: 20,
      piprop: 'thumbnail',
      pithumbsize: 320,
      pilimit: 20,
      inprop: 'protection|url',
      ppprop: 'wikibase_item|disambiguation',
      colimit: 30,
      clshow: '!hidden',
      cllimit: 30,
      redirects: 1,
    });
    for (const raw of data?.query?.pages ?? []) {
      if (raw.missing) continue;
      byTitle[raw.title] = rawToPage(raw);
    }
  }

  const pages = Object.values(byTitle);
  await attachTypes(pages);
  return pages;
}

/** Resolve Wikidata P31 → cluster for a set of already-enriched pages. */
export async function attachTypes(pages: Page[]): Promise<void> {
  const ids = pages.map((p) => p.wikidataId).filter(Boolean) as string[];
  if (!ids.length) return;
  const typed = await typeEntities(ids);
  for (const p of pages) {
    if (p.wikidataId && typed.cluster[p.wikidataId]) {
      p.cluster = typed.cluster[p.wikidataId] as ClusterType;
      p.instanceOf = typed.instanceOf[p.wikidataId] ?? [];
    }
  }
}

/** Deep enrichment for a single page: adds pageviews, inbound links,
 *  citation-density proxy, and full dispute scan (incl. hidden categories). */
export async function getPage(title: string): Promise<Page> {
  return cached(
    `page:full:${title}`,
    async () => {
      const data = await actionQuery<any>({
        action: 'query',
        titles: title,
        prop: 'extracts|pageimages|pageprops|info|coordinates|description|categories',
        exintro: 1,
        explaintext: 1,
        piprop: 'thumbnail',
        pithumbsize: 480,
        inprop: 'protection|url',
        ppprop: 'wikibase_item|disambiguation',
        clshow: '!hidden',
        cllimit: 'max',
        redirects: 1,
      });
      const raw = data?.query?.pages?.[0];
      if (!raw || raw.missing) throw new Error(`Page not found: ${title}`);
      const page = rawToPage(raw);
      await attachTypes([page]);

      const [views, inbound, extLinks, disputed] = await Promise.all([
        pageviews(page.title, 30),
        inboundLinkCount(page.title),
        externalLinkCount(page.title),
        detectDispute(page.title),
      ]);
      page.pageviews30d = views;
      page.inboundLinks = inbound;
      page.externalLinkCount = extLinks;
      if (disputed) page.disputed = true;
      return page;
    },
    1000 * 60 * 60 * 6,
  );
}

async function inboundLinkCount(title: string): Promise<number | undefined> {
  try {
    // linkshere is capped for anonymous; sample up to 500 as a "how connected" proxy.
    const data = await actionQuery<any>({
      action: 'query',
      titles: title,
      prop: 'linkshere',
      lhprop: 'pageid',
      lhnamespace: 0,
      lhlimit: 500,
    });
    const here = data?.query?.pages?.[0]?.linkshere ?? [];
    return here.length;
  } catch {
    return undefined;
  }
}

async function externalLinkCount(title: string): Promise<number | undefined> {
  try {
    const data = await actionQuery<any>({
      action: 'parse',
      page: title,
      prop: 'externallinks',
      redirects: 1,
    });
    return data?.parse?.externallinks?.length;
  } catch {
    return undefined;
  }
}

async function detectDispute(title: string): Promise<boolean> {
  try {
    const data = await actionQuery<any>({
      action: 'query',
      titles: title,
      prop: 'categories',
      clshow: 'hidden',
      cllimit: 'max',
      redirects: 1,
    });
    const cats: Array<{ title: string }> = data?.query?.pages?.[0]?.categories ?? [];
    return cats.some((c) => DISPUTE_RE.test(c.title));
  } catch {
    return false;
  }
}

/** Look up canonical title (handles redirects/casing) for a free-text term. */
export async function resolveTitle(term: string): Promise<string | undefined> {
  const key = `resolve:${term.toLowerCase()}`;
  const hit = cacheGet<string>(key);
  if (hit) return hit;
  const data = await actionQuery<any>({
    action: 'query',
    titles: term,
    prop: 'info',
    redirects: 1,
  });
  const page = data?.query?.pages?.[0];
  if (page && !page.missing) {
    cacheSet(key, page.title);
    return page.title;
  }
  // fall back to opensearch best match
  const os = await actionQuery<any>({
    action: 'opensearch',
    search: term,
    limit: 1,
    namespace: 0,
  });
  const best = os?.[1]?.[0];
  if (best) cacheSet(key, best);
  return best;
}
