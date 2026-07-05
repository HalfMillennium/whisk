import { For, Show } from 'solid-js';
import { A } from '@solidjs/router';
import type { Page } from '../lib/types';
import { openSave } from '../stores/saveDrawer';
import { savedIn, COLLECTIONS_ENABLED } from '../stores/collections';
import { InterestMeter, ClusterBadge, DisputeFlag } from './bits';
import { IconBookmark, IconBookmarkFilled, IconClock, IconPin, IconSpiral } from './icons';

export function ResultCard(props: { page: Page; rank?: number; feature?: boolean }) {
  const p = () => props.page;
  const href = () => `/wiki/${encodeURIComponent(p().title)}`;
  const isSaved = () => savedIn(href()).length > 0;

  return (
    <article class="card" classList={{ 'card--feature': props.feature }}>
      <div class="card__top">
        <ClusterBadge type={p().cluster} />
        <Show when={p().interestingness}>
          <InterestMeter value={p().interestingness!.score} compact />
        </Show>
      </div>

      <A href={href()} class="card__title-link">
        <h3 class="card__title">{p().title}</h3>
      </A>

      <Show when={p().description}>
        <p class="card__desc">{p().description}</p>
      </Show>

      <Show when={p().matchReason}>
        <p class="card__why">
          <span class="card__why-tag mono">why</span>
          {p().matchReason}
        </p>
      </Show>

      <Show when={p().extract && props.feature}>
        <p class="card__extract">{p().extract!.slice(0, 220)}…</p>
      </Show>

      <div class="card__facts">
        <Show when={p().timePeriod}>
          <span class="fact">
            <IconClock size={13} />
            {p().timePeriod}
          </span>
        </Show>
        <Show when={p().place}>
          <span class="fact">
            <IconPin size={13} />
            {p().place}
          </span>
        </Show>
        <Show when={p().disputed}>
          <DisputeFlag />
        </Show>
      </div>

      <Show when={p().categories.length}>
        <div class="card__cats">
          <For each={p().categories.slice(0, 3)}>
            {(c) => <span class="tag">{c}</span>}
          </For>
        </div>
      </Show>

      <div class="card__actions">
        <A href={`/path?from=${encodeURIComponent(p().title)}`} class="btn btn--ghost card__rabbit">
          <IconSpiral size={15} />
          Start rabbit hole
        </A>
        <Show when={COLLECTIONS_ENABLED}>
          <button
            type="button"
            class="icon-btn card__save"
            classList={{ 'is-saved': isSaved() }}
            aria-label={isSaved() ? 'Saved — manage' : 'Save to collection'}
            onClick={() =>
              openSave({
                kind: 'page',
                title: p().title,
                description: p().description,
                href: href(),
                addedAt: Date.now(),
              })
            }
          >
            <Show when={isSaved()} fallback={<IconBookmark size={16} />}>
              <IconBookmarkFilled size={16} />
            </Show>
          </button>
        </Show>
      </div>
    </article>
  );
}
