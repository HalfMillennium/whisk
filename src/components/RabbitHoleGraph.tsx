import { For, Show, createSignal } from 'solid-js';
import { A } from '@solidjs/router';
import type { RabbitHole } from '../lib/types';
import { ClusterBadge } from './bits';
import { IconExternal } from './icons';
import { TrailMap } from './TrailMap';

export function RabbitHoleGraph(props: { hole: RabbitHole; hideJumps?: boolean }) {
  const steps = () => props.hole.steps;
  const lastIndex = () => steps().length - 1;
  const [active, setActive] = createSignal<number | null>(null);

  function scrollToStop(i: number) {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    document
      .getElementById(`stop-${i}`)
      ?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }

  return (
    <>
      <TrailMap steps={steps()} activeIndex={active()} onNodeClick={scrollToStop} />
      <div class="trail" style={{ '--stops': steps().length }}>
        <For each={steps()}>
          {(step, i) => {
            const isEnd = () => i() === 0 || i() === lastIndex();
            return (
              <div class="stop" id={`stop-${i()}`} style={{ '--i': i() }}>
                <div class="stop__rail" aria-hidden="true">
                  <Show when={i() > 0}>
                    <span class="stop__line stop__line--in" />
                  </Show>
                  <span class="stop__dot" classList={{ 'stop__dot--end': isEnd() }} />
                  <Show when={i() < lastIndex()}>
                    <span class="stop__line stop__line--out" />
                  </Show>
                </div>

                <div class="stop__body">
                  <Show when={step.jumpReason && i() > 0 && !props.hideJumps}>
                    <p class="stop__jump mono">↳ {step.jumpReason}</p>
                  </Show>
                  <article
                    class="stop__card"
                    classList={{ 'stop__card--end': isEnd() }}
                    onMouseEnter={() => setActive(i())}
                    onMouseLeave={() => setActive(null)}
                    onFocusIn={() => setActive(i())}
                    onFocusOut={() => setActive(null)}
                  >
                    <div class="stop__card-top">
                      <span class="stop__num mono">{i() + 1}</span>
                      <ClusterBadge type={step.page.cluster} />
                    </div>
                    <A href={`/wiki/${encodeURIComponent(step.page.title)}`} class="stop__title-link">
                      <h3 class="stop__title">{step.page.title}</h3>
                    </A>
                    <Show when={step.page.description}>
                      <p class="stop__desc">{step.page.description}</p>
                    </Show>
                    <div class="stop__actions">
                      <A href={`/wiki/${encodeURIComponent(step.page.title)}`} class="stop__link">
                        Open dossier
                      </A>
                      <a
                        class="stop__link stop__link--ext"
                        href={step.page.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <IconExternal size={13} /> Wikipedia
                      </a>
                    </div>
                  </article>
                </div>
              </div>
            );
          }}
        </For>
      </div>
    </>
  );
}
