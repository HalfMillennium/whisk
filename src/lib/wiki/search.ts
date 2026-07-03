// Search access: CirrusSearch full-text + "morelike" semantic-ish neighbours.

import { actionQuery } from './client';
import { cached } from './cache';
import type { SearchHit } from '../types';

interface RawSearch {
  query?: {
    search?: Array<{
      title: string;
      pageid: number;
      snippet: string;
      wordcount: number;
    }>;
  };
}

export async function fullTextSearch(q: string, limit = 30): Promise<SearchHit[]> {
  const query = q.trim();
  if (!query) return [];
  return cached(
    `search:ft:${query}:${limit}`,
    async () => {
      const data = await actionQuery<RawSearch>({
        action: 'query',
        list: 'search',
        srsearch: query,
        srprop: 'snippet|wordcount',
        srlimit: limit,
        srnamespace: 0,
      });
      return (data.query?.search ?? []).map((s, i) => ({
        title: s.title,
        pageid: s.pageid,
        snippet: s.snippet ?? '',
        wordcount: s.wordcount ?? 0,
        rank: i,
      }));
    },
    1000 * 60 * 30,
  );
}

/** CirrusSearch "morelike:" — pages similar to a seed title. */
export async function moreLike(title: string, limit = 24): Promise<SearchHit[]> {
  return cached(
    `search:morelike:${title}:${limit}`,
    async () => {
      const data = await actionQuery<RawSearch>({
        action: 'query',
        list: 'search',
        srsearch: `morelike:${title}`,
        srprop: 'snippet|wordcount',
        srlimit: limit,
        srnamespace: 0,
        srqiprofile: 'classic_noboostlinks',
      });
      return (data.query?.search ?? [])
        .filter((s) => s.title !== title)
        .map((s, i) => ({
          title: s.title,
          pageid: s.pageid,
          snippet: s.snippet ?? '',
          wordcount: s.wordcount ?? 0,
          rank: i,
        }));
    },
    1000 * 60 * 60,
  );
}

/** Title autocomplete for the command bar. */
export async function suggest(prefix: string, limit = 6): Promise<string[]> {
  const p = prefix.trim();
  if (p.length < 2) return [];
  const data = await actionQuery<any>({
    action: 'opensearch',
    search: p,
    limit,
    namespace: 0,
  });
  return (data?.[1] ?? []) as string[];
}
