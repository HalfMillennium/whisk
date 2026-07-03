// Link graph access for rabbit-hole path finding.

import { actionQuery, actionQueryAll } from './client';
import { cached } from './cache';

/** Outgoing article links from a page (namespace 0), capped for politeness. */
export async function outgoingLinks(title: string, limit = 200): Promise<string[]> {
  return cached(
    `links:out:${title}:${limit}`,
    async () => {
      const pages = await actionQueryAll(
        {
          action: 'query',
          titles: title,
          prop: 'links',
          plnamespace: 0,
          pllimit: 'max',
          redirects: 1,
        },
        Math.ceil(limit / 500),
      );
      const links: Array<{ title: string }> = pages?.[0]?.links ?? [];
      return links.map((l) => l.title).slice(0, limit);
    },
    1000 * 60 * 60 * 24,
  );
}

/** Pages that link TO this page (reverse frontier for bidirectional BFS). */
export async function inboundLinks(title: string, limit = 200): Promise<string[]> {
  return cached(
    `links:in:${title}:${limit}`,
    async () => {
      const titles: string[] = [];
      let cont: Record<string, string> = {};
      const maxRounds = Math.ceil(limit / 500);
      for (let round = 0; round < maxRounds; round++) {
        const data = await actionQuery<any>({
          action: 'query',
          list: 'backlinks',
          bltitle: title,
          blnamespace: 0,
          bllimit: 'max',
          blfilterredir: 'nonredirects',
          ...cont,
        });
        for (const b of data?.query?.backlinks ?? []) titles.push(b.title);
        if (data.continue) cont = data.continue;
        else break;
        if (titles.length >= limit) break;
      }
      return titles.slice(0, limit);
    },
    1000 * 60 * 60 * 24,
  );
}
