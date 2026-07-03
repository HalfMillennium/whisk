import { ErrorBoundary, For, Show, Suspense, createMemo, createResource } from 'solid-js';
import { A, useParams } from '@solidjs/router';
import { getPage } from '../lib/wiki/page';
import { moreLike } from '../lib/wiki/search';
import { enrichTitles } from '../lib/wiki/page';
import { openSave } from '../stores/saveDrawer';
import { savedIn } from '../stores/collections';
import { IntelligencePanel } from '../components/IntelligencePanel';
import { ResultCard } from '../components/ResultCard';
import { SkeletonGrid, EmptyState, ClusterBadge, RouteError } from '../components/bits';
import {
  IconBookmark,
  IconBookmarkFilled,
  IconExternal,
  IconSpiral,
} from '../components/icons';

export default function Article() {
  const params = useParams();
  const title = () => decodeURIComponent(params.title ?? '');

  const [page, { refetch }] = createResource(title, getPage);

  const [related] = createResource(title, async (t) => {
    const hits = await moreLike(t, 8).catch(() => []);
    if (!hits.length) return [];
    return enrichTitles(hits.map((h) => h.title)).catch(() => []);
  });
  // settled-only read: a pending read here would suspend the article body on it
  const rel = createMemo(() => (related.state === 'ready' ? related() : undefined));

  const href = () => `/wiki/${encodeURIComponent(title())}`;
  const isSaved = () => savedIn(href()).length > 0;

  return (
    <div class="article shell">
      {/* keyed: navigating to a different title rebuilds the boundary out of a stale error */}
      <Show keyed when={title()}>
        {(_t) => (
      <ErrorBoundary
        fallback={(err, reset) =>
          err instanceof Error && err.message.startsWith('Page not found') ? (
            <EmptyState glyph="∅" title={`Couldn't find “${title()}”`}>
              <p>The page may not exist. <A href="/search">Try a search</A> instead.</p>
            </EmptyState>
          ) : (
            <RouteError
              onRetry={() => {
                refetch();
                reset();
              }}
            />
          )
        }
      >
      <Suspense fallback={<ArticleSkeleton title={title()} />}>
        <Show when={page()}>
          {(pg) => (
            <>
              <A href="/search" class="back-link">← results</A>
              <div class="article__grid">
                <div class="article__main">
                  <header class="article__head">
                    <ClusterBadge type={pg().cluster} />
                    <h1 class="article__title">{pg().title}</h1>
                    <Show when={pg().description}>
                      <p class="article__desc">{pg().description}</p>
                    </Show>
                    <div class="article__actions">
                      <A
                        href={`/path?from=${encodeURIComponent(pg().title)}`}
                        class="btn btn--primary"
                      >
                        <IconSpiral size={16} />
                        Start a rabbit hole
                      </A>
                      <button
                        type="button"
                        class="btn"
                        classList={{ 'is-saved': isSaved() }}
                        onClick={() =>
                          openSave({
                            kind: 'page',
                            title: pg().title,
                            description: pg().description,
                            href: href(),
                            addedAt: Date.now(),
                          })
                        }
                      >
                        <Show when={isSaved()} fallback={<IconBookmark size={16} />}>
                          <IconBookmarkFilled size={16} />
                        </Show>
                        {isSaved() ? 'Saved' : 'Save'}
                      </button>
                      <a class="btn" href={pg().url} target="_blank" rel="noreferrer">
                        <IconExternal size={16} />
                        Wikipedia
                      </a>
                    </div>
                  </header>

                  <div class="article__body">
                    <Show when={pg().thumbnail}>
                      <img
                        class="article__img"
                        src={pg().thumbnail}
                        alt=""
                        loading="lazy"
                      />
                    </Show>
                    <Show when={pg().extract} fallback={<p class="article__extract">No summary available.</p>}>
                      <p class="article__extract serif">{pg().extract}</p>
                    </Show>
                    <p class="article__attrib mono">
                      Summary from Wikipedia, licensed CC BY-SA.{' '}
                      <a href={pg().url} target="_blank" rel="noreferrer">
                        Read the full article →
                      </a>
                    </p>
                  </div>

                  <Show when={rel()?.length}>
                    <section class="article__related">
                      <h2 class="article__section-title">
                        <IconSpiral size={18} /> Related rabbit holes
                      </h2>
                      <div class="chips-row">
                        <For each={rel()!.slice(0, 8)}>
                          {(r) => (
                            <A class="chip chip--link" href={`/wiki/${encodeURIComponent(r.title)}`}>
                              {r.title}
                            </A>
                          )}
                        </For>
                      </div>
                    </section>
                  </Show>
                </div>

                <IntelligencePanel page={pg()} />
              </div>

              <section class="article__morelike">
                <h2 class="article__section-title">More like this</h2>
                <Show when={!related.loading} fallback={<SkeletonGrid count={4} />}>
                  <Show
                    when={rel()?.length}
                    fallback={<p class="muted-note">No close matches found.</p>}
                  >
                    <div class="result-grid">
                      <For each={rel()!.slice(0, 6)}>
                        {(r, i) => (
                          <div class="result-grid__item" style={{ '--i': i() }}>
                            <ResultCard page={r} />
                          </div>
                        )}
                      </For>
                    </div>
                  </Show>
                </Show>
              </section>
            </>
          )}
        </Show>
      </Suspense>
      </ErrorBoundary>
        )}
      </Show>
    </div>
  );
}

function ArticleSkeleton(props: { title: string }) {
  return (
    <>
      <div class="skel skel--line skel--w40" style={{ 'margin-bottom': 'var(--sp-4)', width: '72px' }} />
      <div class="article__grid">
        <div class="article__main">
          <div class="skel skel--pill" />
          <h1 class="article__title" style={{ 'margin-block': 'var(--sp-2)' }}>{props.title}</h1>
          <div class="skel skel--line" />
          <div class="skel skel--line skel--w80" style={{ 'margin-top': '0.5rem' }} />
          <div class="skel-card__foot" style={{ 'margin-top': 'var(--sp-3)' }}>
            <div class="skel skel--pill" style={{ width: '150px', height: '36px' }} />
            <div class="skel skel--pill" style={{ width: '84px', height: '36px' }} />
            <div class="skel skel--pill" style={{ width: '110px', height: '36px' }} />
          </div>
          <div class="skel skel--block" />
        </div>
        <div class="skel skel--panel" />
      </div>
    </>
  );
}
