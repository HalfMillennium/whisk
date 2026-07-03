import { For, Show } from 'solid-js';
import { A } from '@solidjs/router';
import type { Page } from '../lib/types';
import { InterestBreakdown, DisputeFlag } from './bits';
import { IconClock, IconPin, IconCite, IconShield, IconLink, IconExternal } from './icons';

function fmtDate(iso?: string) {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return undefined;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtNum(n?: number) {
  if (n === undefined) return '—';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function IntelligencePanel(props: { page: Page }) {
  const p = () => props.page;

  return (
    <aside class="dossier" aria-label="Page intelligence">
      {/* Facts */}
      <section class="dossier__block">
        <h3 class="dossier__h">Coordinates</h3>
        <dl class="factlist">
          <Show when={p().timePeriod}>
            <div class="factlist__row">
              <span class="factlist__icon"><IconClock size={14} /></span>
              <dt>Time</dt>
              <dd>{p().timePeriod}</dd>
            </div>
          </Show>
          <Show when={p().place || p().coordinates}>
            <div class="factlist__row">
              <span class="factlist__icon"><IconPin size={14} /></span>
              <dt>Place</dt>
              <dd>
                {p().place ??
                  (p().coordinates
                    ? `${p().coordinates!.lat.toFixed(2)}, ${p().coordinates!.lon.toFixed(2)}`
                    : '—')}
              </dd>
            </div>
          </Show>
          <Show when={p().instanceOf.length}>
            <div class="factlist__row">
              <span class="factlist__icon" aria-hidden="true" />
              <dt>Type</dt>
              <dd>{p().instanceOf.slice(0, 3).join(', ')}</dd>
            </div>
          </Show>
        </dl>
      </section>

      {/* Entities */}
      <Show when={p().keyEntities?.length}>
        <section class="dossier__block">
          <h3 class="dossier__h">Key entities</h3>
          <div class="chips-row">
            <For each={p().keyEntities}>
              {(e) => (
                <A class="chip chip--link" href={`/search?q=${encodeURIComponent(e)}`}>
                  {e}
                </A>
              )}
            </For>
          </div>
        </section>
      </Show>

      {/* Interestingness */}
      <Show when={p().interestingness}>
        <section class="dossier__block">
          <h3 class="dossier__h">
            Interestingness <span class="mono dossier__score">{p().interestingness!.score}</span>
          </h3>
          <InterestBreakdown data={p().interestingness!} />
        </section>
      </Show>

      {/* Source quality */}
      <section class="dossier__block">
        <h3 class="dossier__h">Source signals</h3>
        <ul class="signals">
          <li class="signal">
            <IconCite size={15} />
            <span class="signal__label">Citations (approx.)</span>
            <span class="signal__val mono">{fmtNum(p().externalLinkCount)}</span>
          </li>
          <li class="signal">
            <IconLink size={15} />
            <span class="signal__label">Inbound links</span>
            <span class="signal__val mono">
              {p().inboundLinks !== undefined
                ? `${fmtNum(p().inboundLinks)}${p().inboundLinks! >= 500 ? '+' : ''}`
                : '—'}
            </span>
          </li>
          <li class="signal">
            <IconExternal size={15} />
            <span class="signal__label">Views / 30d</span>
            <span class="signal__val mono">{fmtNum(p().pageviews30d)}</span>
          </li>
          <li class="signal">
            <IconShield size={15} />
            <span class="signal__label">Protection</span>
            <span class="signal__val mono">
              {p().protection && p().protection!.length ? p().protection!.join(', ') : 'open'}
            </span>
          </li>
          <Show when={fmtDate(p().lastEdited)}>
            <li class="signal">
              <IconClock size={15} />
              <span class="signal__label">Last edited</span>
              <span class="signal__val mono">{fmtDate(p().lastEdited)}</span>
            </li>
          </Show>
        </ul>
        <Show when={p().disputed}>
          <div class="dossier__dispute">
            <DisputeFlag />
            <span>This article carries a maintenance or dispute template on Wikipedia.</span>
          </div>
        </Show>
      </section>
    </aside>
  );
}
