// Rabbit-hole path finding. Bidirectional BFS over the Wikipedia link graph,
// with mode-based biasing of which frontier nodes to expand and which candidate
// path to prefer. Bounded fetch budget keeps it polite.

import { outgoingLinks, inboundLinks } from './wiki/links';
import { enrichTitles, getPage } from './wiki/page';
import { moreLike } from './wiki/search';
import {
  AI_ENABLED,
  fallbackJumpReason,
  narratePath,
} from './ai';
import type { Page, PathMode, RabbitHole, PathStep } from './types';

const norm = (t: string) => t.replace(/_/g, ' ').trim();

const HISTORY_RE =
  /\b(\d{3,4}|century|ancient|medieval|history|historical|war|battle|empire|dynasty|revolution|BC|AD)\b/i;

interface Node {
  title: string;
  parent: string | null;
}

/** Connect two topics with a short trail. */
export async function findPath(
  fromRaw: string,
  toRaw: string,
  mode: PathMode = 'shortest',
): Promise<RabbitHole> {
  const from = norm(fromRaw);
  const to = norm(toRaw);

  if (from.toLowerCase() === to.toLowerCase()) {
    const page = await getPage(from);
    return { from, to, mode, steps: [{ page }], aiUsed: false };
  }

  const titles = await bidirectionalBFS(from, to, mode);
  if (!titles) {
    // no path within budget — return the endpoints so the UI can still render
    const pages = await enrichTitles([from, to]);
    return {
      from,
      to,
      mode,
      steps: pages.map((p) => ({ page: p })),
      aiUsed: false,
      truncated: true,
    };
  }
  return buildRabbitHole(from, to, mode, titles);
}

async function bidirectionalBFS(
  from: string,
  to: string,
  mode: PathMode,
): Promise<string[] | null> {
  const MAX_DEPTH = 4;
  const FETCH_BUDGET = 40; // total node-expansions across both frontiers
  let fetches = 0;

  const fwd = new Map<string, Node>([[from, { title: from, parent: null }]]);
  const bwd = new Map<string, Node>([[to, { title: to, parent: null }]]);
  let fwdFrontier = [from];
  let bwdFrontier = [to];

  for (let depth = 0; depth < MAX_DEPTH && fetches < FETCH_BUDGET; depth++) {
    // fwd map is always rooted at `from`; bwd map always rooted at `to`.
    const expandFwd = fwdFrontier.length <= bwdFrontier.length;
    const frontier = expandFwd ? fwdFrontier : bwdFrontier;
    const visited = expandFwd ? fwd : bwd;
    const other = expandFwd ? bwd : fwd;
    const next: string[] = [];

    // rank frontier nodes so biased modes expand the "right" ones first
    const ordered = await orderFrontier(frontier, mode);

    for (const title of ordered) {
      if (fetches >= FETCH_BUDGET) break;
      fetches++;
      const neighbors = expandFwd
        ? await outgoingLinks(title, 220)
        : await inboundLinks(title, 220);

      for (const n of neighbors) {
        const nn = norm(n);
        if (visited.has(nn)) continue;
        visited.set(nn, { title: nn, parent: title });
        if (other.has(nn)) {
          return stitch(fwd, bwd, nn, from, to);
        }
        next.push(nn);
      }
    }
    if (expandFwd) fwdFrontier = next;
    else bwdFrontier = next;
    if (!next.length) break;
  }
  return null;
}

/** Reconstruct from -> ... -> meet -> ... -> to using the two rooted maps. */
function stitch(
  fwd: Map<string, Node>,
  bwd: Map<string, Node>,
  meet: string,
  from: string,
  to: string,
): string[] {
  const head: string[] = [];
  let cur: string | null | undefined = meet;
  while (cur) {
    head.unshift(cur);
    cur = fwd.get(cur)?.parent;
  }
  const tail: string[] = [];
  cur = bwd.get(meet)?.parent;
  while (cur) {
    tail.push(cur);
    cur = bwd.get(cur)?.parent;
  }
  const path = [...head, ...tail];
  if (path[0]?.toLowerCase() !== from.toLowerCase()) path.unshift(from);
  if (path[path.length - 1]?.toLowerCase() !== to.toLowerCase()) path.push(to);
  return dedupeConsecutive(path);
}

function dedupeConsecutive(arr: string[]): string[] {
  return arr.filter((v, i) => i === 0 || v.toLowerCase() !== arr[i - 1].toLowerCase());
}

/** Order frontier so biased modes expand promising nodes first. */
async function orderFrontier(frontier: string[], mode: PathMode): Promise<string[]> {
  if (frontier.length <= 2 || mode === 'shortest') return frontier.slice(0, 4);
  if (mode === 'historical') {
    return [...frontier]
      .sort((a, b) => Number(HISTORY_RE.test(b)) - Number(HISTORY_RE.test(a)))
      .slice(0, 4);
  }
  // weirdest / people / places: keep it cheap — shuffle-ish by title length so we
  // don't always chase the same hub pages, then cap.
  if (mode === 'weirdest') {
    return [...frontier].sort((a, b) => b.length - a.length).slice(0, 4);
  }
  return frontier.slice(0, 4);
}

async function buildRabbitHole(
  from: string,
  to: string | undefined,
  mode: PathMode,
  titles: string[],
): Promise<RabbitHole> {
  const trimmed = titles.slice(0, 8);
  const pages = await enrichTitles(trimmed);
  const byTitle = new Map(pages.map((p) => [p.title.toLowerCase(), p] as const));
  const ordered: Page[] = trimmed
    .map((t) => byTitle.get(t.toLowerCase()))
    .filter((p): p is Page => !!p);

  const steps: PathStep[] = ordered.map((page) => ({ page }));

  // narration
  let aiUsed = false;
  const narration = await narratePath(ordered).catch(() => null);
  if (narration && narration.jumps?.length === ordered.length - 1) {
    aiUsed = true;
    for (let i = 1; i < ordered.length; i++) steps[i].jumpReason = narration.jumps[i - 1];
  } else {
    for (let i = 1; i < ordered.length; i++)
      steps[i].jumpReason = fallbackJumpReason(ordered[i - 1], ordered[i]);
  }

  return {
    from,
    to,
    mode,
    steps,
    narration: narration?.summary ?? deterministicSummary(ordered),
    aiUsed: aiUsed || (AI_ENABLED && !!narration),
  };
}

function deterministicSummary(pages: Page[]): string {
  if (pages.length < 2) return '';
  return `A ${pages.length}-stop trail from ${pages[0].title} to ${
    pages[pages.length - 1].title
  }, by way of ${pages.slice(1, -1).map((p) => p.title).join(', ') || 'a direct link'}.`;
}

/** Single-topic exploration: greedily walk toward the most interesting neighbour. */
export async function startRabbitHole(
  fromRaw: string,
  steps = 5,
): Promise<RabbitHole> {
  const from = norm(fromRaw);
  const visited = new Set([from.toLowerCase()]);
  const trail: string[] = [from];

  let current = from;
  for (let i = 0; i < steps; i++) {
    // "more like" gives serendipitous, semantically-related next hops
    const candidates = await moreLike(current, 12).catch(() => []);
    const next = candidates
      .map((c) => c.title)
      .find((t) => !visited.has(t.toLowerCase()));
    if (!next) break;
    visited.add(next.toLowerCase());
    trail.push(next);
    current = next;
  }
  return buildRabbitHole(from, undefined, 'weirdest', trail);
}
