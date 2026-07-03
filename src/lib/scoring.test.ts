import { describe, it, expect } from 'vitest';
import {
  buildScoreContext,
  computeInterestingness,
  rankScore,
  NORMAL_WEIGHTS,
  WEIRD_WEIGHTS,
} from './scoring';
import type { Page, SearchHit } from './types';

function page(over: Partial<Page> = {}): Page {
  return {
    title: 'Test',
    pageid: 1,
    url: 'https://en.wikipedia.org/wiki/Test',
    lang: 'en',
    cluster: 'concepts',
    instanceOf: [],
    categories: [],
    ...over,
  };
}

const hit = (rank: number): SearchHit => ({
  title: 'Test',
  pageid: 1,
  snippet: 'a <span class="searchmatch">match</span>',
  wordcount: 500,
  rank,
});

describe('interestingness', () => {
  it('returns a 0..100 score with a transparent breakdown', () => {
    const p = page({
      extract:
        'In 1518, a mysterious dancing plague struck Strasbourg; dozens danced for days and some died.',
      categories: ['1518 in Europe', 'Mass hysteria'],
      coordinates: { lat: 48.5, lon: 7.7 },
      timePeriod: '1518',
    });
    const ctx = buildScoreContext([p]);
    const i = computeInterestingness(p, ctx, hit(5));
    expect(i.score).toBeGreaterThanOrEqual(0);
    expect(i.score).toBeLessThanOrEqual(100);
    expect(i.narrativeDensity).toBeGreaterThan(0);
    expect(i.entitySpecificity).toBeGreaterThan(0);
  });

  it('rewards rare categories over common ones (hidden connections)', () => {
    const common = page({ title: 'Common', categories: ['Shared', 'AlsoShared'] });
    const rare = page({ title: 'Rare', categories: ['UniqueThing'] });
    const filler = Array.from({ length: 6 }, (_, n) =>
      page({ title: `F${n}`, categories: ['Shared', 'AlsoShared'] }),
    );
    const ctx = buildScoreContext([common, rare, ...filler]);
    const ci = computeInterestingness(common, ctx);
    const ri = computeInterestingness(rare, ctx);
    expect(ri.unusualCategory).toBeGreaterThan(ci.unusualCategory);
  });

  it('flags disputes', () => {
    const p = page({ disputed: true, extract: 'x' });
    const ctx = buildScoreContext([p]);
    expect(computeInterestingness(p, ctx).disputeSignal).toBe(100);
  });

  it('treats a well-connected, low-view page as a hidden gem', () => {
    const gem = page({ pageviews30d: 200, inboundLinks: 380 });
    const star = page({ pageviews30d: 900000, inboundLinks: 380 });
    const ctx = buildScoreContext([gem, star]);
    expect(computeInterestingness(gem, ctx).hiddenGem).toBeGreaterThan(
      computeInterestingness(star, ctx).hiddenGem,
    );
  });
});

describe('rankScore', () => {
  it('ranks a higher (lower-index) search hit above a lower one, all else equal', () => {
    const p = page({ interestingness: { score: 40, hiddenGem: 0, unusualCategory: 0, narrativeDensity: 0, entitySpecificity: 0, disputeSignal: 0 } });
    const top = rankScore(p, hit(0), NORMAL_WEIGHTS, 30);
    const deep = rankScore(p, hit(20), NORMAL_WEIGHTS, 30);
    expect(top).toBeGreaterThan(deep);
  });

  it('weird weights lean harder on interestingness than normal weights', () => {
    expect(WEIRD_WEIGHTS.interestingness).toBeGreaterThan(NORMAL_WEIGHTS.interestingness);
    expect(WEIRD_WEIGHTS.semantic).toBeLessThan(NORMAL_WEIGHTS.semantic);
  });
});
