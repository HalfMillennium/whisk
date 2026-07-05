import { For, Show, createMemo, createResource, createSignal } from 'solid-js';
import { useSearchParams } from '@solidjs/router';
import { findPath, startRabbitHole } from '../lib/path';
import type { PathMode, RabbitHole as Hole } from '../lib/types';
import { RabbitHoleGraph } from '../components/RabbitHoleGraph';
import { EmptyState, RouteError } from '../components/bits';
import { openSave } from '../stores/saveDrawer';
import { COLLECTIONS_ENABLED } from '../stores/collections';
import { IconSpiral, IconBookmark, IconArrow, IconClock, IconSparkle } from '../components/icons';

const MODES: Array<{ id: PathMode; label: string }> = [
  { id: 'shortest', label: 'Shortest' },
  { id: 'weirdest', label: 'Weirdest' },
  { id: 'historical', label: 'Historical' },
];

export default function RabbitHole() {
  const [params, setParams] = useSearchParams();
  const from = () => (params.from as string) ?? '';
  const to = () => (params.to as string) ?? '';
  const mode = () => ((params.mode as PathMode) ?? 'shortest');
  const [timeline, setTimeline] = createSignal(false);

  const [fromInput, setFromInput] = createSignal(from());
  const [toInput, setToInput] = createSignal(to());

  const [hole, { refetch }] = createResource(
    () => ({ from: from(), to: to(), mode: mode() }),
    async ({ from, to, mode }): Promise<Hole | null> => {
      if (!from.trim()) return null;
      return to.trim() ? findPath(from, to, mode) : startRabbitHole(from);
    },
  );

  // Read the resource only once it's settled: a pending read would suspend the
  // nearest boundary — AppShell's — and blank the whole route while charting.
  const data = createMemo(() => (hole.state === 'ready' ? hole() : null));

  const orderedHole = createMemo<Hole | null>(() => {
    const h = data();
    if (!h) return null;
    if (!timeline()) return h;
    const steps = [...h.steps].sort((a, b) => yearOf(a.page.timePeriod) - yearOf(b.page.timePeriod));
    return { ...h, steps };
  });

  function connect(e: Event) {
    e.preventDefault();
    if (!fromInput().trim()) return;
    setParams({
      from: fromInput().trim(),
      to: toInput().trim() || undefined,
      mode: mode(),
    });
  }

  function savePath() {
    const h = data();
    if (!h) return;
    const label = h.to ? `${h.from} → ${h.to}` : `${h.from} rabbit hole`;
    openSave({
      kind: 'path',
      title: label,
      description: h.narration,
      href: `/path?from=${encodeURIComponent(h.from)}${h.to ? `&to=${encodeURIComponent(h.to)}` : ''}&mode=${h.mode}`,
      addedAt: Date.now(),
      payload: h,
    });
  }

  return (
    <div class="rabbit shell">
      <header class="rabbit__head">
        <p class="eyebrow">Rabbit hole</p>
        <h1 class="rabbit__title">
          <IconSpiral size={26} /> Follow the connections
        </h1>
        <p class="rabbit__lede">
          Pick a starting topic. Add a destination to build a trail between two ideas, or leave it
          blank to wander.
        </p>

        <form class="rabbit__form" onSubmit={connect}>
          <input
            class="input rabbit__from"
            placeholder="Start (e.g. Napoleon)"
            value={fromInput()}
            onInput={(e) => setFromInput(e.currentTarget.value)}
            aria-label="Start topic"
          />
          <span class="rabbit__arrow" aria-hidden="true"><IconArrow size={18} /></span>
          <input
            class="input rabbit__to"
            placeholder="Destination (optional)"
            value={toInput()}
            onInput={(e) => setToInput(e.currentTarget.value)}
            aria-label="Destination topic"
          />
          <button type="submit" class="btn btn--primary" disabled={!fromInput().trim()}>
            Connect
          </button>
        </form>

        <Show when={from().trim()}>
          <div class="rabbit__controls">
            <div class="pillbar" role="group" aria-label="Path mode">
              <For each={MODES}>
                {(m) => (
                  <button
                    type="button"
                    class="pill"
                    classList={{ 'pill--on': mode() === m.id }}
                    aria-pressed={mode() === m.id}
                    disabled={!to().trim()}
                    title={to().trim() ? undefined : 'Add a destination to choose a route'}
                    onClick={() =>
                      setParams({ from: from(), to: to().trim() || undefined, mode: m.id })
                    }
                  >
                    {m.label}
                  </button>
                )}
              </For>
            </div>
            <button
              type="button"
              class="pill"
              classList={{ 'pill--on': timeline() }}
              aria-pressed={timeline()}
              onClick={() => setTimeline((t) => !t)}
            >
              <IconClock size={14} /> Timeline
            </button>
          </div>
        </Show>
      </header>

      <Show
        when={from().trim()}
        fallback={
          <EmptyState glyph="✦" title="Start anywhere">
            <p>Type a topic above, or open one from a search result and hit “Start rabbit hole”.</p>
          </EmptyState>
        }
      >
        <Show when={!hole.loading} fallback={<TrailLoading from={from()} to={to()} />}>
        <Show when={!hole.error} fallback={<RouteError onRetry={refetch} />}>
          <Show
            when={orderedHole() && orderedHole()!.steps.length}
            fallback={
              <Show when={data()}>
                <EmptyState glyph="∅" title="Couldn't chart that trail">
                  <p>Try different endpoints, or switch to a shorter mode.</p>
                </EmptyState>
              </Show>
            }
          >
            {(_) => {
              const h = orderedHole()!;
              return (
                <>
                  <div class="rabbit__banner">
                    <div>
                      <Show when={h.narration}>
                        <p class="rabbit__narration serif">{h.narration}</p>
                      </Show>
                      <p class="rabbit__meta mono">
                        {h.steps.length} stops · {h.mode}
                        <Show when={h.aiUsed}> · <IconSparkle size={12} /> AI-narrated</Show>
                        <Show when={h.truncated}> · no full path found — showing endpoints</Show>
                        <Show when={timeline()}> · ordered by era, not by trail</Show>
                      </p>
                    </div>
                    <Show when={COLLECTIONS_ENABLED}>
                      <button type="button" class="btn" onClick={savePath}>
                        <IconBookmark size={16} /> Save trail
                      </button>
                    </Show>
                  </div>
                  <RabbitHoleGraph hole={h} hideJumps={timeline()} />
                </>
              );
            }}
          </Show>
        </Show>
        </Show>
      </Show>
    </div>
  );
}

function yearOf(period?: string): number {
  if (!period) return 9999;
  const bc = /(\d+)\s?BC/i.exec(period);
  if (bc) return -Number(bc[1]);
  const century = /(\d+)(?:st|nd|rd|th)\s+century/i.exec(period);
  if (century) return (Number(century[1]) - 1) * 100;
  const year = /(\d{3,4})/.exec(period);
  if (year) return Number(year[1]);
  return 9999;
}

function TrailLoading(props: { from: string; to: string }) {
  return (
    <div class="rabbit__loading">
      <div class="rabbit__banner">
        <p class="rabbit__meta mono">
          Charting a trail from {props.from}
          {props.to ? ` to ${props.to}` : ''}…
        </p>
      </div>
      <div class="trail" aria-hidden="true">
        <For each={[0, 1, 2]}>
          {(i) => (
            <div class="stop" style={{ '--i': i }}>
              <div class="stop__rail">
                <span class="stop__dot" />
                <Show when={i < 2}>
                  <span class="stop__line stop__line--out" />
                </Show>
              </div>
              <div class="stop__body">
                <div class="skel-card">
                  <div class="skel skel--line skel--w40" />
                  <div class="skel skel--title" />
                  <div class="skel skel--line skel--w80" />
                </div>
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
