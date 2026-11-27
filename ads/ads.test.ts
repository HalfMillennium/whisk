import { describe, expect, it } from 'vitest';
import {
  FEATURED_PAIRS,
  GOOGLE_RSA,
  copyViolations,
  isInPool,
  landingUrl,
  metaCopy,
  pairSlug,
} from './copy.ts';
import { FORMATS, renderCreativeHtml, type AdFormat } from './creative.ts';

describe('ad copy', () => {
  it('only features pairs the daily game can actually serve', () => {
    for (const p of FEATURED_PAIRS) expect(isInPool(p), `${p.from} → ${p.to}`).toBe(true);
  });

  it('stays within every platform character limit', () => {
    expect(copyViolations()).toEqual([]);
  });

  it('meets Google RSA minimums (3+ headlines, 2+ descriptions) and maximums (15 / 4)', () => {
    expect(GOOGLE_RSA.headlines.length).toBeGreaterThanOrEqual(3);
    expect(GOOGLE_RSA.headlines.length).toBeLessThanOrEqual(15);
    expect(GOOGLE_RSA.descriptions.length).toBeGreaterThanOrEqual(2);
    expect(GOOGLE_RSA.descriptions.length).toBeLessThanOrEqual(4);
    expect(new Set(GOOGLE_RSA.headlines).size).toBe(GOOGLE_RSA.headlines.length);
  });

  it('falls back to a generic Meta headline when the pair is too long', () => {
    expect(metaCopy({ from: 'Napoleon', to: 'Sushi' }).headline).toBe('Napoleon → Sushi in how many clicks?');
    expect(metaCopy({ from: 'Wolfgang Amadeus Mozart', to: 'Electricity' }).headline).toBe('Play whisk daily');
  });

  it('builds UTM-tagged landing URLs on /daily', () => {
    const u = new URL(landingUrl({ source: 'google', medium: 'cpc', content: 'rsa' }));
    expect(u.origin + u.pathname).toBe('https://whisk.fyi/daily');
    expect(u.searchParams.get('utm_source')).toBe('google');
    expect(u.searchParams.get('utm_medium')).toBe('cpc');
    expect(u.searchParams.get('utm_campaign')).toBe('daily_promo');
    expect(u.searchParams.get('utm_content')).toBe('rsa');
  });

  it('slugs pairs into stable, filename-safe ids', () => {
    expect(pairSlug({ from: 'Honey bee', to: 'Ancient Egypt' })).toBe('honey-bee-ancient-egypt');
    expect(pairSlug({ from: 'Rock and roll', to: 'Paper' })).toMatch(/^[a-z0-9-]+$/);
  });
});

describe('creative html', () => {
  it('renders every format at its exact canvas size', () => {
    for (const format of Object.keys(FORMATS) as AdFormat[]) {
      const { width, height } = FORMATS[format];
      const html = renderCreativeHtml({ pair: FEATURED_PAIRS[0], format });
      expect(html).toContain(`width:${width}px;height:${height}px`);
      expect(html).toContain('whisk.fyi/daily');
    }
  });

  it('escapes titles', () => {
    const html = renderCreativeHtml({ pair: { from: 'A & <B>', to: 'C' }, format: 'square' });
    expect(html).toContain('A &amp; &lt;B&gt;');
    expect(html).not.toContain('<B>');
  });
});
