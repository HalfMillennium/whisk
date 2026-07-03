import { For } from 'solid-js';
import { CLUSTER_LABEL, CLUSTER_ORDER, type ClusterType } from '../lib/types';

interface Props {
  counts: Record<ClusterType, number>;
  active: ClusterType;
  onSelect: (c: ClusterType) => void;
}

export function ClusterTabs(props: Props) {
  const visible = () => CLUSTER_ORDER.filter((c) => props.counts[c] > 0);
  let list!: HTMLDivElement;

  function onKeyDown(e: KeyboardEvent) {
    const tabs = visible();
    if (!tabs.length) return;
    const idx = Math.max(0, tabs.indexOf(props.active));
    let next = -1;
    if (e.key === 'ArrowRight') next = (idx + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    props.onSelect(tabs[next]);
    queueMicrotask(() => {
      (list.querySelector('[aria-selected="true"]') as HTMLElement | null)?.focus();
    });
  }

  return (
    <div class="tabs" role="tablist" aria-label="Result clusters" ref={list} onKeyDown={onKeyDown}>
      <For each={visible()}>
        {(c) => (
          <button
            type="button"
            role="tab"
            id={`tab-${c}`}
            aria-selected={props.active === c}
            aria-controls="cluster-panel"
            tabindex={props.active === c ? 0 : -1}
            class="tab"
            classList={{ 'tab--active': props.active === c }}
            onClick={() => props.onSelect(c)}
          >
            {CLUSTER_LABEL[c]}
            <span class="tab__count mono">{props.counts[c]}</span>
          </button>
        )}
      </For>
    </div>
  );
}
