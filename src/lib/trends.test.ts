import { describe, it, expect } from 'vitest';
import { isSafeTrend, cleanTrends, type RawTrend } from '../../api/trends';

function trend(title: string, newsTitles: string[] = []): RawTrend {
  return { title, newsTitles };
}

describe('deterministic trend safety filter', () => {
  it('drops violent / disaster / death titles', () => {
    for (const t of [
      'coney island shooting',
      'flood warning',
      'provo fire',
      'downtown stabbing',
      'plane crash',
      'earthquake',
    ]) {
      expect(isSafeTrend(trend(t))).toBe(false);
    }
  });

  it('keeps benign titles', () => {
    for (const t of ['will smith', 'denzel washington', 'new album release']) {
      expect(isSafeTrend(trend(t))).toBe(true);
    }
  });

  it('does not mistake "fireworks" for "fire" (word boundary)', () => {
    expect(isSafeTrend(trend('seattle fireworks'))).toBe(true);
    expect(isSafeTrend(trend('waikiki fireworks'))).toBe(true);
  });

  it('drops a benign-looking title when its news headlines are violent', () => {
    expect(
      isSafeTrend(trend('john doe', ['John Doe killed in overnight shooting'])),
    ).toBe(false);
  });

  it('cleanTrends removes only the flagged items', () => {
    const items = [
      trend('will smith'),
      trend('coney island shooting'),
      trend('seattle fireworks'),
      trend('flood warning'),
    ];
    expect(cleanTrends(items).map((t) => t.title)).toEqual([
      'will smith',
      'seattle fireworks',
    ]);
  });
});
