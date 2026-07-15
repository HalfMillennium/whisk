import { describe, it, expect } from 'vitest';
import { mapFeedEvents, type RawFeedEvent } from './onThisDay';

function event(text: string, year?: number, pageTitles: string[] = ['Some page']): RawFeedEvent {
  return {
    text,
    year,
    pages: pageTitles.map((t) => ({
      titles: { normalized: t },
      description: `${t} description`,
      thumbnail: { source: `https://img.example/${encodeURIComponent(t)}.jpg` },
    })),
  };
}

describe('mapFeedEvents', () => {
  it('maps normalized titles, descriptions, and thumbnail sources', () => {
    const items = mapFeedEvents([event('The metric system is adopted in France', 1795)], 5);
    expect(items).toHaveLength(1);
    expect(items[0].year).toBe(1795);
    expect(items[0].text).toBe('The metric system is adopted in France');
    expect(items[0].pages[0]).toEqual({
      title: 'Some page',
      description: 'Some page description',
      thumbnail: 'https://img.example/Some%20page.jpg',
    });
  });

  it('drops events with no linked pages', () => {
    const noPages: RawFeedEvent = { text: 'A pageless event', year: 1900, pages: [] };
    expect(mapFeedEvents([noPages], 5)).toHaveLength(0);
  });

  it('drops blocklisted (violent/disaster) events', () => {
    const items = mapFeedEvents(
      [
        event('A major earthquake strikes the city', 1906),
        event('Thousands killed in the battle', 1815),
        event('The first public library opens', 1850),
      ],
      5,
    );
    expect(items).toHaveLength(1);
    expect(items[0].text).toContain('library');
  });

  it('respects the limit', () => {
    const raw = [1, 2, 3, 4, 5, 6, 7].map((i) => event(`Benign event number ${i}`, 1900 + i));
    expect(mapFeedEvents(raw, 3)).toHaveLength(3);
  });

  it('caps linked pages at 2 per event', () => {
    const items = mapFeedEvents([event('A treaty is signed', 1648, ['A', 'B', 'C', 'D'])], 5);
    expect(items[0].pages.map((p) => p.title)).toEqual(['A', 'B']);
  });

  it('tolerates missing optional fields', () => {
    const sparse: RawFeedEvent = {
      text: 'A quiet discovery',
      pages: [{ titles: { normalized: 'Discovery' } }],
    };
    const items = mapFeedEvents([sparse], 5);
    expect(items[0].year).toBeUndefined();
    expect(items[0].pages[0]).toEqual({
      title: 'Discovery',
      description: undefined,
      thumbnail: undefined,
    });
  });
});
