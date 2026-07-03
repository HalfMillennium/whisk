import { For, Show, type JSX } from 'solid-js';
import { CLUSTER_LABEL, type ClusterType, type Interestingness } from '../lib/types';
import { IconAlert } from './icons';

// ---- Interestingness meter ---------------------------------------------------
export function InterestMeter(props: { value: number; compact?: boolean }) {
  const bars = () => Math.round((props.value / 100) * 5);
  return (
    <div
      class="meter"
      classList={{ 'meter--compact': props.compact }}
      title={`Interestingness ${props.value}/100`}
      aria-label={`Interestingness ${props.value} of 100`}
    >
      <span class="meter__bars" aria-hidden="true">
        <For each={[0, 1, 2, 3, 4]}>
          {(i) => <span class="meter__bar" classList={{ 'is-on': i < bars() }} />}
        </For>
      </span>
      <span class="meter__num mono">{props.value}</span>
    </div>
  );
}

export function InterestBreakdown(props: { data: Interestingness }) {
  const rows: Array<[string, number]> = [
    ['Hidden gem', props.data.hiddenGem],
    ['Unusual mix', props.data.unusualCategory],
    ['Narrative', props.data.narrativeDensity],
    ['Specificity', props.data.entitySpecificity],
    ['Disputed', props.data.disputeSignal],
  ];
  return (
    <ul class="breakdown">
      <For each={rows}>
        {([label, val]) => (
          <li class="breakdown__row">
            <span class="breakdown__label">{label}</span>
            <span class="breakdown__track" aria-hidden="true">
              <span class="breakdown__fill" style={{ transform: `scaleX(${val / 100})` }} />
            </span>
            <span class="breakdown__val mono">{val}</span>
          </li>
        )}
      </For>
    </ul>
  );
}

// ---- Cluster badge -----------------------------------------------------------
const CLUSTER_GLYPH: Record<ClusterType, string> = {
  people: '◐',
  events: '◆',
  places: '❖',
  concepts: '◇',
  other: '✦',
};

export function ClusterBadge(props: { type: ClusterType }) {
  return (
    <span class="cbadge" data-cluster={props.type}>
      <span class="cbadge__glyph" aria-hidden="true">
        {CLUSTER_GLYPH[props.type]}
      </span>
      {CLUSTER_LABEL[props.type]}
    </span>
  );
}

export function DisputeFlag() {
  return (
    <span class="flag flag--warn" title="This article carries a dispute or citation warning">
      <IconAlert size={13} />
      Disputed
    </span>
  );
}

// ---- Skeletons ---------------------------------------------------------------
export function CardSkeleton() {
  return (
    <div class="skel-card" aria-hidden="true">
      <div class="skel skel--line skel--w40" />
      <div class="skel skel--title" />
      <div class="skel skel--line" />
      <div class="skel skel--line skel--w80" />
      <div class="skel-card__foot">
        <div class="skel skel--pill" />
        <div class="skel skel--pill" />
      </div>
    </div>
  );
}

export function SkeletonGrid(props: { count?: number }) {
  return (
    <div class="result-grid">
      <For each={Array.from({ length: props.count ?? 6 })}>{() => <CardSkeleton />}</For>
    </div>
  );
}

// ---- Empty / error states ----------------------------------------------------
export function EmptyState(props: {
  glyph?: string;
  title: string;
  children?: JSX.Element;
}) {
  return (
    <div class="empty">
      <div class="empty__glyph" aria-hidden="true">
        {props.glyph ?? '✦'}
      </div>
      <h2 class="empty__title">{props.title}</h2>
      <Show when={props.children}>
        <div class="empty__body">{props.children}</div>
      </Show>
    </div>
  );
}

export function RouteError(props: {
  title?: string;
  onRetry?: () => void;
  children?: JSX.Element;
}) {
  return (
    <EmptyState glyph="!" title={props.title ?? "Couldn't reach Wikipedia"}>
      <Show
        when={props.children}
        fallback={<p>Something went wrong while fetching. Check your connection and try again.</p>}
      >
        {props.children}
      </Show>
      <Show when={props.onRetry}>
        <p>
          <button type="button" class="btn" onClick={() => props.onRetry!()}>
            Try again
          </button>
        </p>
      </Show>
    </EmptyState>
  );
}
