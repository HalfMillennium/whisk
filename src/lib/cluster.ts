// Discovery orchestrator: search -> enrich -> score -> cluster.
// Turns a natural-language query into clustered, ranked, explained results.

import { fullTextSearch, moreLike } from './wiki/search';
import { enrichTitles } from './wiki/page';
import { AI_ENABLED, expandQuery, explainMatches } from './ai';
import {
  NORMAL_WEIGHTS,
  WEIRD_WEIGHTS,
  buildScoreContext,
  computeInterestingness,
  rankScore,
  weirdPenalty,
} from './scoring';
import {
  CLUSTER_ORDER,
  type ClusterType,
  type Page,
  type SearchHit,
  type SearchResult,
} from './types';

const PROPER_RE = /\b[A-Z][a-zA-Z'’-]{2,}(?:\s+[A-Z][a-zA-Z'’-]{2,}){0,2}\b/g;

function keyEntities(page: Page): string[] {
  const text = (page.extract ?? '').slice(0, 500);
  const seen = new Set<string>();
  const stop = new Set(page.title.split(/\s+/));
  const out: string[] = [];
  for (const m of text.match(PROPER_RE) ?? []) {
    if (stop.has(m) || seen.has(m)) continue;
    seen.add(m);
    out.push(m);
    if (out.length >= 4) break;
  }
  return out;
}

export async function discover(
  query: string,
  opts: { weird?: boolean } = {},
): Promise<SearchResult> {
  const q = query.trim();
  const weird = !!opts.weird;

  // 1. primary + serendipity search pools
  const primary = await fullTextSearch(q, 30);
  const pools: SearchHit[][] = [primary];

  // 2. optional AI query expansion (bounded to one extra search)
  let expandedTerms: string[] = [];
  if (AI_ENABLED) {
    expandedTerms = await expandQuery(q).catch(() => []);
    if (expandedTerms.length) {
      const extra = await fullTextSearch(expandedTerms.join(' OR '), 16).catch(() => []);
      pools.push(extra);
    }
  }

  // 3. "more like" the strongest hit widens the graph (esp. for weird mode)
  if (primary[0]) {
    const like = await moreLike(primary[0].title, weird ? 20 : 12).catch(() => []);
    pools.push(like);
  }

  // merge, keeping the best (lowest) rank per title
  const hitByTitle = new Map<string, SearchHit>();
  for (const pool of pools) {
    for (const h of pool) {
      const prev = hitByTitle.get(h.title);
      if (!prev || h.rank < prev.rank) hitByTitle.set(h.title, h);
    }
  }
  const titles = [...hitByTitle.keys()].slice(0, 48);
  if (!titles.length) {
    return { query: q, expandedTerms, clusters: emptyClusters(), all: [], aiUsed: AI_ENABLED };
  }

  // 4. enrich + score
  const pages = await enrichTitles(titles);
  const ctx = buildScoreContext(pages);
  const weights = weird ? WEIRD_WEIGHTS : NORMAL_WEIGHTS;
  for (const p of pages) {
    const hit = hitByTitle.get(p.title);
    p.interestingness = computeInterestingness(p, ctx, hit);
    p.keyEntities = keyEntities(p);
    (p as any)._score =
      rankScore(p, hit, weights, titles.length) - (weird ? weirdPenalty(p) : 0);
  }

  // 5. explain matches (AI batched, else deterministic)
  const reasons = await explainMatches(q, pages).catch(() => new Map<string, string>());
  for (const p of pages) p.matchReason = reasons.get(p.title);

  // 6. sort + cluster
  const all = [...pages].sort((a, b) => (b as any)._score - (a as any)._score);
  const clusters = emptyClusters();
  for (const p of all) clusters[p.cluster].push(p);

  // "Deep cuts" = the most interesting pages regardless of type (curated view)
  clusters.other = [...pages]
    .filter((p) => (p.interestingness?.score ?? 0) > 0)
    .sort((a, b) => (b.interestingness!.score - a.interestingness!.score))
    .slice(0, 10);

  return { query: q, expandedTerms, clusters, all, aiUsed: AI_ENABLED && expandedTerms.length > 0 };
}

function emptyClusters(): Record<ClusterType, Page[]> {
  return CLUSTER_ORDER.reduce(
    (acc, c) => {
      acc[c] = [];
      return acc;
    },
    {} as Record<ClusterType, Page[]>,
  );
}
