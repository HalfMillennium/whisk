// Daily rabbit-hole challenge — pure, deterministic logic. One puzzle per UTC
// day: get from article A to article B by clicking Wikipedia links. The pair is
// picked from a curated pool with a PRNG seeded by the date string, so every
// visitor worldwide plays the same puzzle with no backend.

export interface DailyPair {
  from: string;
  to: string;
}

export interface DailyPuzzle {
  number: number;
  dateKey: string;
  from: string;
  to: string;
}

export interface DailyResult {
  dateKey: string;
  number: number;
  from: string;
  to: string;
  clicks: number;
  trail: string[];
  status: 'won' | 'gave-up';
}

/** Launch date — puzzle #1. */
export const DAILY_EPOCH = '2026-07-14';

// Curated start/end pairs. Every entry is a canonical, well-linked article
// (redirect targets are also accepted at win time, see Daily.tsx), and both
// endpoints are hub-y enough that a trail exists within a handful of hops.
// Extend freely — determinism only depends on the date seed, so growing the
// pool never changes past puzzles' dates retroactively mattering.
export const DAILY_PAIRS: DailyPair[] = [
  { from: 'Napoleon', to: 'Sushi' },
  { from: 'Printing press', to: 'Hip hop' },
  { from: 'Octopus', to: 'Roman Empire' },
  { from: 'Leonardo da Vinci', to: 'Helicopter' },
  { from: 'Great Wall of China', to: 'Ice cream' },
  { from: 'William Shakespeare', to: 'Chess' },
  { from: 'Coffee', to: 'Industrial Revolution' },
  { from: 'Vikings', to: 'Baseball' },
  { from: 'Cleopatra', to: 'Telescope' },
  { from: 'Silk Road', to: 'Jazz' },
  { from: 'Isaac Newton', to: 'Piano' },
  { from: 'Volcano', to: 'Photography' },
  { from: 'Honey bee', to: 'Ancient Egypt' },
  { from: 'Samurai', to: 'Basketball' },
  { from: 'Moon', to: 'Chocolate' },
  { from: 'Charles Darwin', to: 'Video game' },
  { from: 'Tea', to: 'French Revolution' },
  { from: 'Alexander the Great', to: 'Cinema' },
  { from: 'Penguin', to: 'Steam engine' },
  { from: 'Gold', to: 'Olympic Games' },
  { from: 'Wolfgang Amadeus Mozart', to: 'Electricity' },
  { from: 'Dinosaur', to: 'Renaissance' },
  { from: 'Salt', to: 'Astronomy' },
  { from: 'Genghis Khan', to: 'Opera' },
  { from: 'Lighthouse', to: 'DNA' },
  { from: 'Marie Curie', to: 'Ocean' },
  { from: 'Bicycle', to: 'Philosophy' },
  { from: 'Tornado', to: 'Mathematics' },
  { from: 'Albert Einstein', to: 'Surfing' },
  { from: 'Whale', to: 'Middle Ages' },
  { from: 'Paper', to: 'Rock and roll' },
  { from: 'Julius Caesar', to: 'Antarctica' },
  { from: 'Mushroom', to: 'Architecture' },
  { from: 'Compass', to: 'Ballet' },
  { from: 'Aristotle', to: 'Aviation' },
  { from: 'Glacier', to: 'Poetry' },
  { from: 'Bread', to: 'Space exploration' },
  { from: 'Vincent van Gogh', to: 'Railway' },
  { from: 'Desert', to: 'Internet' },
  { from: 'Maya civilization', to: 'Football' },
  { from: 'Clock', to: 'Evolution' },
  { from: 'Christopher Columbus', to: 'Photosynthesis' },
  { from: 'Iceland', to: 'Silk' },
  { from: 'Butterfly', to: 'Meteorology' },
  { from: 'Hawaii', to: 'Portugal' },
  { from: 'Ludwig van Beethoven', to: 'Comet' },
  { from: 'Amazon rainforest', to: 'Money' },
  { from: 'Galileo Galilei', to: 'Cathedral' },
  { from: 'Kangaroo', to: 'Cartography' },
  { from: 'Cheese', to: 'Mount Everest' },
  { from: 'Piracy', to: 'University' },
  { from: 'Plato', to: 'Coral reef' },
  { from: 'Windmill', to: 'Japan' },
  { from: 'Saturn', to: 'Agriculture' },
  { from: 'Camel', to: 'Venice' },
  { from: 'Origami', to: 'NASA' },
  { from: 'Tundra', to: 'Tokyo' },
  { from: 'Violin', to: 'Gravity' },
  { from: 'Library of Alexandria', to: 'Submarine' },
  { from: 'Lightning', to: 'Ancient Greece' },
];

/** YYYY-MM-DD in UTC — the canonical day key for puzzles and results. */
export function utcDateKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** 1-based puzzle number: days elapsed since the epoch, clamped to ≥ 1. */
export function puzzleNumber(dateKey: string): number {
  const days = Math.round(
    (Date.parse(`${dateKey}T00:00:00Z`) - Date.parse(`${DAILY_EPOCH}T00:00:00Z`)) / 86_400_000,
  );
  return Math.max(1, days + 1);
}

/** Deterministic PRNG from a string seed (xmur3 hash → mulberry32). */
export function seededRandom(seed: string): () => number {
  // xmur3: string → 32-bit hash
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = (() => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  })();
  // mulberry32
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The puzzle for a given moment (UTC day). Same day ⇒ same puzzle, everywhere. */
export function todaysPuzzle(d = new Date()): DailyPuzzle {
  const dateKey = utcDateKey(d);
  const rng = seededRandom(`whisk-daily:${dateKey}`);
  const pair = DAILY_PAIRS[Math.floor(rng() * DAILY_PAIRS.length)];
  return { number: puzzleNumber(dateKey), dateKey, ...pair };
}

/** Loose title equality: case- and underscore-insensitive. */
export function titlesMatch(a: string, b: string): boolean {
  const norm = (s: string) => s.replace(/_/g, ' ').trim().toLowerCase();
  return norm(a) === norm(b);
}

/** Clipboard-ready share card. Keep the format stable — it's the viral loop. */
export function buildShareText(r: DailyResult, origin: string): string {
  const line =
    r.status === 'won' ? `🐇 solved in ${r.clicks} click${r.clicks === 1 ? '' : 's'}` : '⛳ gave up';
  return `whisk daily #${r.number} — ${r.from} → ${r.to}\n${line}\n${origin}/daily`;
}

/** Time until the next puzzle unlocks. */
export function msUntilNextUtcMidnight(d = new Date()): number {
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
  return next - d.getTime();
}
