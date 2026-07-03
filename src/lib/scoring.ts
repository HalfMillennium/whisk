// Interestingness + relevance scoring. Pure functions — unit tested.
//
// whisk ranks by relevance + curiosity, not relevance alone. Every signal here
// is derived from data whisk already fetched, so the breakdown is explainable.

import type { Interestingness, Page, SearchHit } from './types';

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

const NARRATIVE_RE =
  /\b(\d{3,4}|war|died|born|killed|discovered|invented|destroyed|founded|revolution|empire|king|queen|battle|disease|escaped|vanished|mysteriously|scandal|secret|banned|forgotten|abandoned|lost|failed|hoax|fraud)\b/gi;
const PROPER_NOUN_RE = /\b[A-Z][a-z]{2,}\b/g;
const PRECISE_YEAR_RE = /\b(1\d{3}|20\d{2}|\d{1,3}\s?(?:BC|AD))\b/;

export interface ScoreContext {
  /** category name -> how many pages in the result set carry it */
  categoryFreq: Map<string, number>;
  totalDocs: number;
}

export function buildScoreContext(pages: Page[]): ScoreContext {
  const categoryFreq = new Map<string, number>();
  for (const p of pages) {
    for (const c of p.categories) {
      categoryFreq.set(c, (categoryFreq.get(c) ?? 0) + 1);
    }
  }
  return { categoryFreq, totalDocs: Math.max(1, pages.length) };
}

export function computeInterestingness(
  page: Page,
  ctx: ScoreContext,
  hit?: SearchHit,
): Interestingness {
  const extract = page.extract ?? '';

  // narrative density: story-shaped words per ~100 words, capped
  const narrativeHits = (extract.match(NARRATIVE_RE) ?? []).length;
  const words = Math.max(20, (extract.match(/\S+/g) ?? []).length);
  const narrativeDensity = clamp01((narrativeHits / words) * 12);

  // entity specificity: coordinates + a precise date + proper-noun richness
  const properNouns = new Set(extract.match(PROPER_NOUN_RE) ?? []).size;
  const entitySpecificity = clamp01(
    (page.coordinates ? 0.3 : 0) +
      (PRECISE_YEAR_RE.test(extract) || /\d/.test(page.timePeriod ?? '') ? 0.3 : 0) +
      Math.min(0.4, properNouns / 25),
  );

  // unusual category: pages whose categories rarely overlap with the rest
  let rarity = 0;
  if (page.categories.length) {
    for (const c of page.categories) {
      const freq = ctx.categoryFreq.get(c) ?? 1;
      rarity += 1 - (freq - 1) / ctx.totalDocs;
    }
    rarity /= page.categories.length;
  }
  const unusualCategory = clamp01(rarity * (page.categories.length ? 1 : 0.3));

  // hidden gem: strongly connected but not heavily viewed. If we have the deep
  // signals use them; otherwise approximate from Wikipedia's own result rank.
  let hiddenGem: number;
  if (page.pageviews30d !== undefined && page.inboundLinks !== undefined) {
    const views = Math.max(50, page.pageviews30d);
    const connectivity = Math.min(1, (page.inboundLinks ?? 0) / 400);
    const obscurity = clamp01(1 - Math.log10(views) / 6); // ~1M views -> 0
    hiddenGem = clamp01(0.5 * connectivity + 0.5 * obscurity);
  } else {
    // deeper in the result list but still semantically present == a deeper cut
    const depth = hit ? clamp01(hit.rank / 25) : 0.3;
    hiddenGem = clamp01(depth * 0.6 + narrativeDensity * 0.4);
  }

  const disputeSignal = page.disputed ? 1 : 0;

  const score01 =
    0.28 * narrativeDensity +
    0.24 * unusualCategory +
    0.22 * hiddenGem +
    0.18 * entitySpecificity +
    0.08 * disputeSignal;

  return {
    score: Math.round(clamp01(score01) * 100),
    hiddenGem: Math.round(hiddenGem * 100),
    unusualCategory: Math.round(unusualCategory * 100),
    narrativeDensity: Math.round(narrativeDensity * 100),
    entitySpecificity: Math.round(entitySpecificity * 100),
    disputeSignal: Math.round(disputeSignal * 100),
  };
}

export interface RankWeights {
  semantic: number;
  keyword: number;
  interestingness: number;
  authority: number;
  freshness: number;
}

export const NORMAL_WEIGHTS: RankWeights = {
  semantic: 0.45,
  keyword: 0.2,
  interestingness: 0.2,
  authority: 0.1,
  freshness: 0.05,
};

export const WEIRD_WEIGHTS: RankWeights = {
  semantic: 0.25,
  keyword: 0.1,
  interestingness: 0.5,
  authority: 0.05,
  freshness: 0.1,
};

export function rankScore(
  page: Page,
  hit: SearchHit | undefined,
  weights: RankWeights,
  resultSize: number,
): number {
  const semantic = hit ? 1 - hit.rank / Math.max(1, resultSize) : 0.5;

  const matchCount = hit ? (hit.snippet.match(/searchmatch/g) ?? []).length : 0;
  const keyword = clamp01(matchCount / 4);

  const interestingness = (page.interestingness?.score ?? 0) / 100;

  let authority: number;
  if (page.externalLinkCount !== undefined) {
    authority = clamp01(Math.log10(1 + page.externalLinkCount) / 2.5);
  } else {
    authority = clamp01(Math.log10(1 + (hit?.wordcount ?? 0)) / 4.5);
  }

  let freshness = 0.5;
  if (page.lastEdited) {
    const days = (Date.now() - new Date(page.lastEdited).getTime()) / 864e5;
    freshness = clamp01(1 - days / 365);
  }

  return (
    weights.semantic * semantic +
    weights.keyword * keyword +
    weights.interestingness * interestingness +
    weights.authority * authority +
    weights.freshness * freshness
  );
}

/** Weird-mode extra penalty for very high pageviews (when known). */
export function weirdPenalty(page: Page): number {
  if (page.pageviews30d === undefined) return 0;
  return clamp01(Math.log10(Math.max(50, page.pageviews30d)) / 6) * 0.15;
}
