import {
  For,
  Show,
  createComputed,
  createMemo,
  createResource,
  createSignal,
  on,
} from 'solid-js';
import { useSearchParams } from '@solidjs/router';
import { discover } from '../lib/cluster';
import { CLUSTER_ORDER, type ClusterType } from '../lib/types';
import { CommandSearch } from '../components/CommandSearch';
import { ClusterTabs } from '../components/ClusterTabs';
import { ResultCard } from '../components/ResultCard';
import { SkeletonGrid, EmptyState, RouteError } from '../components/bits';
import { IconSparkle } from '../components/icons';

export default function Search() {
  const [params, setParams] = useSearchParams();
  const query = () => (params.q as string) ?? '';
  const weird = () => params.weird === '1';
  const [activeCluster, setActiveCluster] = createSignal<ClusterType | null>(null);
  const [tabSwap, setTabSwap] = createSignal(false);

  const [result, { refetch }] = createResource(
    () => ({ q: query(), weird: weird() }),
    async ({ q, weird }) => {
      if (!q.trim()) return null;
      return discover(q, { weird });
    },
  );

  // Read the resource only once it's settled: reading it while pending would
  // suspend the nearest boundary — AppShell's — and blank the whole route.
  const data = createMemo(() => (result.state === 'ready' ? result() : null));

  // A new query resets the cluster tab; toggling weird mode keeps the user's place.
  createComputed(on(query, () => setActiveCluster(null), { defer: true }));
  // Fresh results (new query or weird toggle) get the full entrance stagger again.
  createComputed(on(data, () => setTabSwap(false), { defer: true }));

  const counts = createMemo(() => {
    const r = data();
    const out = {} as Record<ClusterType, number>;
    for (const c of CLUSTER_ORDER) out[c] = r ? r.clusters[c].length : 0;
    return out;
  });

  const current = createMemo<ClusterType>(() => {
    const explicit = activeCluster();
    if (explicit && counts()[explicit] > 0) return explicit;
    return CLUSTER_ORDER.find((c) => counts()[c] > 0) ?? 'other';
  });

  const pages = createMemo(() => data()?.clusters[current()] ?? []);

  return (
    <div class="search shell">
      <div class="search__bar">
        <CommandSearch initial={query()} size="compact" />
      </div>

      <Show when={query().trim()} fallback={
        <EmptyState glyph="✦" title="What are you curious about?">
          <p>Try a fuzzy, story-shaped query — “forgotten disasters”, “scientists mocked for being right”.</p>
        </EmptyState>
      }>
        <Show when={!result.loading} fallback={<SearchSkeleton q={query()} />}>
          <Show when={!result.error} fallback={<RouteError onRetry={refetch} />}>
            <Show
              when={data() && data()!.all.length > 0}
              fallback={
                <Show when={data()}>
                  <EmptyState glyph="∅" title={`No trails found for “${query()}”`}>
                    <p>Try broader or differently-worded terms.</p>
                  </EmptyState>
                </Show>
              }
            >
              <header class="search__head">
                <div>
                  <p class="eyebrow">
                    {data()!.all.length} pages · {countClusters(counts())} clusters
                    <Show when={data()!.aiUsed}> · AI-expanded</Show>
                  </p>
                  <h1 class="search__title">
                    Exploring <span class="search__q">{query()}</span>
                  </h1>
                  <Show when={data()!.expandedTerms.length}>
                    <p class="search__expanded mono">
                      also searched: {data()!.expandedTerms.join(' · ')}
                    </p>
                  </Show>
                </div>
                <button
                  type="button"
                  class="btn weird-toggle"
                  classList={{ 'weird-toggle--on': weird() }}
                  onClick={() => setParams({ q: query(), weird: weird() ? undefined : '1' })}
                  aria-pressed={weird()}
                >
                  <IconSparkle size={16} />
                  {weird() ? 'Weird mode on' : 'Make it weirder'}
                </button>
              </header>

              <ClusterTabs
                counts={counts()}
                active={current()}
                onSelect={(c) => {
                  setTabSwap(true);
                  setActiveCluster(c);
                }}
              />

              <div
                id="cluster-panel"
                role="tabpanel"
                aria-labelledby={`tab-${current()}`}
                class="result-grid"
                classList={{ 'result-grid--swap': tabSwap() }}
              >
                <For each={pages()}>
                  {(page, i) => (
                    <div class="result-grid__item" style={{ '--i': i() }}>
                      <ResultCard page={page} feature={i() === 0 && current() === 'other'} />
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </Show>
        </Show>
      </Show>
    </div>
  );
}

function countClusters(counts: Record<ClusterType, number>) {
  return CLUSTER_ORDER.filter((c) => counts[c] > 0).length;
}

function SearchSkeleton(props: { q: string }) {
  return (
    <div class="search__loading">
      <header class="search__head">
        <div>
          <p class="eyebrow">Gathering trails…</p>
          <h1 class="search__title">
            Exploring <span class="search__q">{props.q}</span>
          </h1>
        </div>
      </header>
      <SkeletonGrid count={6} />
    </div>
  );
}
