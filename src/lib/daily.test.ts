import { describe, it, expect } from 'vitest';
import {
  DAILY_PAIRS,
  buildShareText,
  msUntilNextUtcMidnight,
  puzzleNumber,
  seededRandom,
  titlesMatch,
  todaysPuzzle,
  utcDateKey,
  type DailyResult,
} from './daily';
import { computeStreak } from '../stores/daily';

function result(dateKey: string, status: DailyResult['status']): DailyResult {
  return { dateKey, number: 1, from: 'A', to: 'B', clicks: 3, trail: ['A', 'B'], status };
}

describe('date + puzzle-number math', () => {
  it('formats UTC date keys', () => {
    expect(utcDateKey(new Date('2026-08-01T05:00:00Z'))).toBe('2026-08-01');
    expect(utcDateKey(new Date('2026-08-01T23:59:59Z'))).toBe('2026-08-01');
  });

  it('numbers puzzles from the epoch', () => {
    expect(puzzleNumber('2026-07-14')).toBe(1);
    expect(puzzleNumber('2026-07-15')).toBe(2);
    expect(puzzleNumber('2026-08-14')).toBe(32);
  });

  it('clamps pre-epoch dates to puzzle #1', () => {
    expect(puzzleNumber('2020-01-01')).toBe(1);
  });

  it('computes time to next UTC midnight', () => {
    expect(msUntilNextUtcMidnight(new Date('2026-07-14T23:00:00Z'))).toBe(3_600_000);
    expect(msUntilNextUtcMidnight(new Date('2026-07-14T00:00:00Z'))).toBe(86_400_000);
  });
});

describe('deterministic daily puzzle', () => {
  it('same date ⇒ same puzzle (any timezone offset within the UTC day)', () => {
    const a = todaysPuzzle(new Date('2026-08-01T00:00:01Z'));
    const b = todaysPuzzle(new Date('2026-08-01T23:59:59Z'));
    expect(a).toEqual(b);
  });

  it('seeded PRNG is reproducible and in [0, 1)', () => {
    const r1 = seededRandom('seed');
    const r2 = seededRandom('seed');
    for (let i = 0; i < 10; i++) {
      const v = r1();
      expect(v).toBe(r2());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('spreads across the pool over 60 days', () => {
    const picked = new Set<string>();
    for (let day = 0; day < 60; day++) {
      const d = new Date(Date.parse('2026-07-14T12:00:00Z') + day * 86_400_000);
      const p = todaysPuzzle(d);
      picked.add(`${p.from}→${p.to}`);
    }
    expect(picked.size).toBeGreaterThan(25);
  });
});

describe('titlesMatch', () => {
  it('ignores case and underscores', () => {
    expect(titlesMatch('Economic_bubble', 'economic bubble')).toBe(true);
    expect(titlesMatch('  Sushi ', 'sushi')).toBe(true);
  });

  it('rejects different titles', () => {
    expect(titlesMatch('Sushi', 'Sashimi')).toBe(false);
  });
});

describe('buildShareText', () => {
  it('formats a win', () => {
    const r: DailyResult = {
      dateKey: '2026-07-25',
      number: 12,
      from: 'Napoleon',
      to: 'Sushi',
      clicks: 5,
      trail: [],
      status: 'won',
    };
    expect(buildShareText(r, 'https://whisk.example')).toBe(
      'whisk daily #12 — Napoleon → Sushi\n🐇 solved in 5 clicks\nhttps://whisk.example/daily',
    );
  });

  it('singularizes one click and formats a give-up', () => {
    expect(buildShareText({ ...result('2026-07-14', 'won'), clicks: 1 }, 'x')).toContain(
      'solved in 1 click\n',
    );
    expect(buildShareText(result('2026-07-14', 'gave-up'), 'x')).toContain('⛳ gave up');
  });
});

describe('computeStreak', () => {
  it('counts consecutive wins ending today', () => {
    const results = {
      '2026-07-14': result('2026-07-14', 'won'),
      '2026-07-13': result('2026-07-13', 'won'),
      '2026-07-12': result('2026-07-12', 'won'),
    };
    expect(computeStreak(results, '2026-07-14')).toBe(3);
  });

  it("does not require today's result yet (streak from yesterday holds)", () => {
    const results = {
      '2026-07-13': result('2026-07-13', 'won'),
      '2026-07-12': result('2026-07-12', 'won'),
    };
    expect(computeStreak(results, '2026-07-14')).toBe(2);
  });

  it('a missed day breaks the streak', () => {
    const results = {
      '2026-07-14': result('2026-07-14', 'won'),
      '2026-07-12': result('2026-07-12', 'won'),
    };
    expect(computeStreak(results, '2026-07-14')).toBe(1);
  });

  it('a gave-up breaks the streak', () => {
    const results = {
      '2026-07-14': result('2026-07-14', 'won'),
      '2026-07-13': result('2026-07-13', 'gave-up'),
      '2026-07-12': result('2026-07-12', 'won'),
    };
    expect(computeStreak(results, '2026-07-14')).toBe(1);
  });

  it('is 0 with no wins', () => {
    expect(computeStreak({}, '2026-07-14')).toBe(0);
  });
});

describe('DAILY_PAIRS pool sanity', () => {
  it('has no duplicates, no self-pairs, no empty titles', () => {
    const keys = new Set<string>();
    for (const p of DAILY_PAIRS) {
      expect(p.from.trim().length).toBeGreaterThan(0);
      expect(p.to.trim().length).toBeGreaterThan(0);
      expect(titlesMatch(p.from, p.to)).toBe(false);
      const key = `${p.from}→${p.to}`;
      expect(keys.has(key)).toBe(false);
      keys.add(key);
    }
    expect(DAILY_PAIRS.length).toBeGreaterThanOrEqual(50);
  });
});
