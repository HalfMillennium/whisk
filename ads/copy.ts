// Ad copy + landing URLs for the whisk daily promo. Pure data/functions so the
// renderer, the Meta pusher, the Google CSV exporter and the tests all share one
// source of truth. Voice follows PRODUCT.md: curious, calm, never clickbait.

import { DAILY_PAIRS, type DailyPair } from '../src/lib/daily.ts';

export const SITE = 'https://whisk.fyi';
export const LANDING_PATH = '/daily';
export const CAMPAIGN_SLUG = 'daily_promo';

/**
 * Pairs that make the best ad hooks: instantly legible, a little absurd, short
 * enough to set big. Every one must exist in DAILY_PAIRS (enforced by tests) so
 * the ad never promises a puzzle the game can't serve.
 */
export const FEATURED_PAIRS: DailyPair[] = [
  { from: 'Napoleon', to: 'Sushi' },
  { from: 'Octopus', to: 'Roman Empire' },
  { from: 'Penguin', to: 'Steam engine' },
  { from: 'Cheese', to: 'Mount Everest' },
  { from: 'Origami', to: 'NASA' },
  { from: 'Honey bee', to: 'Ancient Egypt' },
];

export function isInPool(p: DailyPair): boolean {
  return DAILY_PAIRS.some((d) => d.from === p.from && d.to === p.to);
}

/** Stable, URL/filename-safe id for a pair, e.g. "napoleon-sushi". */
export function pairSlug(p: DailyPair): string {
  const s = (t: string) =>
    t
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  return `${s(p.from)}-${s(p.to)}`;
}

/** Landing URL with UTM tags so paid traffic is separable in analytics. */
export function landingUrl(opts: {
  source: string;
  medium: string;
  content?: string;
  campaign?: string;
}): string {
  const u = new URL(LANDING_PATH, SITE);
  u.searchParams.set('utm_source', opts.source);
  u.searchParams.set('utm_medium', opts.medium);
  u.searchParams.set('utm_campaign', opts.campaign ?? CAMPAIGN_SLUG);
  if (opts.content) u.searchParams.set('utm_content', opts.content);
  return u.toString();
}

// ------------------------------------------------------------------ Meta
// Meta truncates beyond these in most placements (not hard API limits).
export const META_LIMITS = { primaryText: 125, headline: 40, description: 30 } as const;

export interface MetaCopy {
  primaryText: string;
  headline: string;
  description: string;
}

/** One copy set per featured pair; falls back to a generic headline when long. */
export function metaCopy(p: DailyPair): MetaCopy {
  const pairHeadline = `${p.from} → ${p.to} in how many clicks?`;
  return {
    primaryText:
      `Get from ${p.from} to ${p.to} using only the links on Wikipedia pages. ` +
      `Fewest clicks wins. New puzzle every day, free.`,
    headline: pairHeadline.length <= META_LIMITS.headline ? pairHeadline : 'Play whisk daily',
    description: 'Free · new puzzle daily',
  };
}

/** Pair-agnostic alternates for A/B testing primary text. */
export const META_ALT_PRIMARY: string[] = [
  'One start page. One goal page. Only the links in between. How few clicks can you do it in?',
  'A daily puzzle for people who open 40 Wikipedia tabs on purpose.',
];

// ---------------------------------------------------------------- Google
// Responsive Search Ad hard limits.
export const GOOGLE_LIMITS = { headline: 30, description: 90, path: 15 } as const;

export const GOOGLE_RSA = {
  headlines: [
    'whisk daily',
    'A Daily Wikipedia Link Puzzle',
    'Fewest Clicks Wins',
    'Start Page → Goal Page',
    'New Puzzle Every Day',
    'Free, No Sign-up',
    'Play Today’s Puzzle',
    'Napoleon → Sushi. Can You?',
    'Only the Links on the Page',
    'Share Your Score',
    'A Wikipedia Racing Game',
    'Keep Your Daily Streak',
  ],
  descriptions: [
    'Get from one Wikipedia article to another using only its links. Fewest clicks wins.',
    'Same puzzle for everyone, new one at midnight UTC. Free to play, no account needed.',
    'Undo costs you. Shortcuts win. See an optimal trail when you finish.',
    'A daily rabbit-hole puzzle from whisk, a discovery layer over Wikipedia.',
  ],
  path1: 'daily',
  path2: 'puzzle',
} as const;

/** Search terms with clear intent for a Wikipedia link-racing game (phrase match). */
export const GOOGLE_KEYWORDS: string[] = [
  'wikipedia game',
  'wiki game',
  'wikipedia racing',
  'wikiracing',
  'wikipedia speedrun',
  'six degrees of wikipedia',
  'wikipedia link game',
  'daily puzzle game',
  'daily trivia game',
];

/** Every copy string that exceeds its limit — empty means shippable. */
export function copyViolations(): string[] {
  const out: string[] = [];
  const check = (label: string, s: string, max: number) => {
    if ([...s].length > max) out.push(`${label} (${[...s].length}/${max}): ${s}`);
  };
  for (const p of FEATURED_PAIRS) {
    const c = metaCopy(p);
    check(`meta primary ${pairSlug(p)}`, c.primaryText, 200); // hard-ish; 125 is the fold
    check(`meta headline ${pairSlug(p)}`, c.headline, META_LIMITS.headline);
    check(`meta description ${pairSlug(p)}`, c.description, META_LIMITS.description);
  }
  GOOGLE_RSA.headlines.forEach((h, i) => check(`google headline ${i + 1}`, h, GOOGLE_LIMITS.headline));
  GOOGLE_RSA.descriptions.forEach((d, i) =>
    check(`google description ${i + 1}`, d, GOOGLE_LIMITS.description),
  );
  check('google path1', GOOGLE_RSA.path1, GOOGLE_LIMITS.path);
  check('google path2', GOOGLE_RSA.path2, GOOGLE_LIMITS.path);
  return out;
}
