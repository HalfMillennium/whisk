import { For, Show, createMemo, createResource, createSignal } from 'solid-js';
import { A } from '@solidjs/router';
import { todaysPuzzle, titlesMatch, buildShareText, msUntilNextUtcMidnight } from '../lib/daily';
import type { DailyResult } from '../lib/daily';
import { getResult, saveResult, allResults, computeStreak } from '../stores/daily';
import { outgoingLinks } from '../lib/wiki/links';
import { enrichTitles, resolveTitle } from '../lib/wiki/page';
import { findPath } from '../lib/path';
import { RabbitHoleGraph } from '../components/RabbitHoleGraph';
import { EmptyState } from '../components/bits';
import { IconArrow, IconSpiral, IconSparkle } from '../components/icons';

export default function Daily() {
  // Computed once at mount: a user straddling UTC midnight keeps the old
  // puzzle until reload, which is fine for v1.
  const puzzle = todaysPuzzle();
  const stored = getResult(puzzle.dateKey);

  const [trail, setTrail] = createSignal<string[]>(stored?.trail ?? [puzzle.from]);
  const [clicks, setClicks] = createSignal(stored?.clicks ?? 0);
  const [status, setStatus] = createSignal<'playing' | 'won' | 'gave-up'>(
    stored?.status ?? 'playing',
  );
  const current = () => trail()[trail().length - 1];

  // Endpoint blurbs are best-effort decoration — titles render instantly.
  // Settled-only reads throughout (prior art: RabbitHole.tsx): a pending FIRST
  // read — even via `.latest` — suspends AppShell's boundary and blanks the
  // route. Once a value exists, `.latest` is safe and keeps the previous list
  // on screen while the next hop's links load.
  const [endpoints] = createResource(() => enrichTitles([puzzle.from, puzzle.to]).catch(() => []));
  const endpointFor = (title: string) =>
    (endpoints.state === 'ready' ? endpoints() : undefined)?.find((p) =>
      titlesMatch(p.title, title),
    );

  // NOTE: outgoingLinks caps at 500 alphabetical links, so on huge hub pages
  // the exact link you want may be missing — the filter box keeps it playable.
  const [links] = createResource(
    () => (status() === 'playing' ? current() : null),
    (t) => outgoingLinks(t, 500),
  );
  const linkList = () =>
    links.state === 'ready' || links.state === 'refreshing' ? links.latest : undefined;
  const [filter, setFilter] = createSignal('');
  const visibleLinks = createMemo(() => {
    const q = filter().trim().toLowerCase();
    const list = (linkList() ?? []).filter((l) => !titlesMatch(l, current()));
    return q ? list.filter((l) => l.toLowerCase().includes(q)) : list;
  });

  // Optimal-trail reveal is on-demand only — findPath burns a 40-fetch budget,
  // so it must never run just because the page loaded.
  const [revealRequested, setRevealRequested] = createSignal(false);
  const [optimal] = createResource(
    () => (revealRequested() ? { from: puzzle.from, to: puzzle.to } : null),
    ({ from, to }) => findPath(from, to, 'shortest'),
  );

  const [savedAt, setSavedAt] = createSignal(0);
  const streak = createMemo(() => {
    savedAt();
    return computeStreak(allResults(), puzzle.dateKey);
  });

  const [copied, setCopied] = createSignal(false);
  const [shareFallback, setShareFallback] = createSignal('');

  function finish(finalStatus: 'won' | 'gave-up', finalTrail: string[]) {
    setStatus(finalStatus);
    const r: DailyResult = {
      dateKey: puzzle.dateKey,
      number: puzzle.number,
      from: puzzle.from,
      to: puzzle.to,
      clicks: clicks(),
      trail: finalTrail,
      status: finalStatus,
    };
    saveResult(r);
    setSavedAt(Date.now());
  }

  async function pick(link: string) {
    if (status() !== 'playing') return;
    const nextTrail = [...trail(), link];
    setTrail(nextTrail);
    setClicks((c) => c + 1);
    setFilter('');
    if (titlesMatch(link, puzzle.to)) {
      finish('won', nextTrail);
      return;
    }
    // The clicked link may be a redirect to the target (e.g. "Financial
    // bubble" → "Economic bubble") — resolve before ruling it a miss.
    try {
      const canonical = await resolveTitle(link);
      if (canonical && titlesMatch(canonical, puzzle.to)) finish('won', nextTrail);
    } catch {
      /* resolution is a bonus check; the game continues */
    }
  }

  // Undo pops the trail but does NOT refund the click — wrong turns cost you.
  function back() {
    if (status() !== 'playing' || trail().length < 2) return;
    setTrail((t) => t.slice(0, -1));
  }

  function giveUp() {
    if (status() !== 'playing') return;
    finish('gave-up', trail());
    setRevealRequested(true);
  }

  async function share() {
    const r = getResult(puzzle.dateKey);
    if (!r) return;
    const text = buildShareText(r, window.location.origin);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setShareFallback(text);
    }
  }

  function countdown(): string {
    const ms = msUntilNextUtcMidnight();
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    return `${h}h ${m}m`;
  }

  return (
    <div class="daily shell">
      <header class="daily__head">
        <p class="eyebrow">Daily challenge</p>
        <h1 class="daily__title">
          <IconSpiral size={26} /> whisk daily #{puzzle.number}
        </h1>
        <p class="daily__lede">
          Get from one article to the other using only the links on the page. Fewest clicks wins —
          same puzzle for everyone, new one at midnight UTC.
        </p>
        <div class="daily__endpoints">
          <EndpointCard title={puzzle.from} kind="Start" page={endpointFor(puzzle.from)} />
          <span class="daily__endpoints-arrow" aria-hidden="true">
            <IconArrow size={20} />
          </span>
          <EndpointCard title={puzzle.to} kind="Goal" page={endpointFor(puzzle.to)} />
        </div>
      </header>

      <div class="daily__trail" aria-label="Your trail so far">
        <For each={trail()}>
          {(t, i) => (
            <>
              <Show when={i() > 0}>
                <span class="daily__crumb-sep" aria-hidden="true">
                  →
                </span>
              </Show>
              <span
                class="daily__crumb mono"
                classList={{ 'daily__crumb--current': i() === trail().length - 1 }}
              >
                {t}
              </span>
            </>
          )}
        </For>
      </div>

      <Show
        when={status() === 'playing'}
        fallback={
          <div class="daily__result">
            <p class="daily__result-title">
              {status() === 'won'
                ? `Solved in ${clicks()} click${clicks() === 1 ? '' : 's'}.`
                : 'Down the wrong hole this time.'}
            </p>
            <p class="daily__result-meta mono">
              <Show when={streak() > 0}>streak {streak()} · </Show>
              next puzzle in {countdown()}
            </p>
            <div class="daily__result-actions">
              <button type="button" class="btn btn--primary" onClick={share}>
                {copied() ? 'Copied!' : 'Share result'}
              </button>
              <Show when={!revealRequested()}>
                <button type="button" class="btn" onClick={() => setRevealRequested(true)}>
                  <IconSparkle size={14} /> Show an optimal trail
                </button>
              </Show>
              <A class="btn" href={`/wiki/${encodeURIComponent(puzzle.to)}`}>
                Read about {puzzle.to}
              </A>
            </div>
            <Show when={shareFallback()}>
              <pre class="daily__share-text mono">{shareFallback()}</pre>
            </Show>
            <Show when={revealRequested()}>
              <div class="daily__optimal">
                <Show
                  when={optimal.state === 'ready' && optimal()}
                  fallback={<p class="daily__result-meta mono">Charting an optimal trail…</p>}
                >
                  {(h) => (
                    <>
                      <p class="daily__result-meta mono">
                        one optimal trail · {h().steps.length} stops
                        <Show when={h().truncated}> · no full path found — showing endpoints</Show>
                      </p>
                      <RabbitHoleGraph hole={h()} />
                    </>
                  )}
                </Show>
              </div>
            </Show>
          </div>
        }
      >
        <div class="daily__play">
          <div class="daily__hud">
            <span class="mono">
              {clicks()} click{clicks() === 1 ? '' : 's'}
            </span>
            <div class="daily__hud-actions">
              <button type="button" class="btn" onClick={back} disabled={trail().length < 2}>
                Undo
              </button>
              <button type="button" class="btn" onClick={giveUp}>
                Give up
              </button>
            </div>
          </div>
          <p class="daily__prompt">
            You're on <strong>{current()}</strong>. Pick a link:
          </p>
          <input
            class="input daily__filter"
            placeholder="Filter links…"
            value={filter()}
            onInput={(e) => setFilter(e.currentTarget.value)}
            aria-label="Filter links"
          />
          <Show
            when={linkList()}
            fallback={
              <div class="daily__links" aria-hidden="true">
                <For each={[0, 1, 2, 3, 4, 5, 6, 7]}>
                  {() => <span class="skel skel--pill" />}
                </For>
              </div>
            }
          >
            <Show
              when={visibleLinks().length}
              fallback={
                <EmptyState glyph="∅" title="No links match">
                  <p>Try a different filter — or Undo and take another turn.</p>
                </EmptyState>
              }
            >
              <div class="daily__links">
                <For each={visibleLinks()}>
                  {(link) => (
                    <button type="button" class="daily__link" onClick={() => pick(link)}>
                      {link}
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </Show>
        </div>
      </Show>
    </div>
  );
}

function EndpointCard(props: {
  title: string;
  kind: string;
  page?: { description?: string; extract?: string; thumbnail?: string };
}) {
  return (
    <div class="daily__endpoint">
      <Show when={props.page?.thumbnail}>
        <img class="daily__endpoint-thumb" src={props.page!.thumbnail} alt="" loading="lazy" />
      </Show>
      <div>
        <p class="daily__endpoint-kind mono">{props.kind}</p>
        <p class="daily__endpoint-title">{props.title}</p>
        <Show when={props.page?.description ?? props.page?.extract}>
          <p class="daily__endpoint-desc">{props.page?.description ?? props.page?.extract}</p>
        </Show>
      </div>
    </div>
  );
}
