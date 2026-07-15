import { For, Show, createResource } from 'solid-js';
import { A } from '@solidjs/router';
import { CommandSearch } from '../components/CommandSearch';
import { AI_ENABLED } from '../lib/ai';
import { getTrendingHoles } from '../lib/trends';
import { getOnThisDay } from '../lib/onThisDay';
import { RECOMMENDED_SEARCHES, RECOMMENDED_TRAILS } from '../lib/recommended';
import { IconSpiral } from '../components/icons';

// Exact Poolsuite title-bar glyphs (base64 PNGs from the reference window),
// rendered pixelated so they stay crisp. Decorative only.
const ICON_CLOSE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAOAQMAAAAlhr+SAAAABlBMVEUAAAAAAAClZ7nPAAAAAXRSTlMAQObYZgAAAB1JREFUCNdjOMADQgYGIMRzAISYGYAIwoaIQ9QAAKYLB+eSH+asAAAAAElFTkSuQmCC';
const ICON_TV =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWBAMAAAA2mnEIAAAAHlBMVEUAAAD///////////////////////////////////8kfJuVAAAACXRSTlMAIO+/EK+gn7AFTmhBAAAATUlEQVQY02MAgZlACAQINoKDwWY0mgkBUwUYhGbCgCJDZApUndhkhpkCUDbLJKA2XBBKobKppl7TgQHq4JkMloVQtvsMFDczRkKZygIAruY/K5IcNPMAAAAASUVORK5CYII=';
const ICON_CONTRACT =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWAQMAAAD+ev54AAAABlBMVEUAAAAAAAClZ7nPAAAAAXRSTlMAQObYZgAAABdJREFUCNdjYGBmwIH/gDEu8B+McWoHALXwBCGzcXiRAAAAAElFTkSuQmCC';

export default function Home() {
  const [holes] = createResource(getTrendingHoles);
  // Settled-only reads (prior art: RabbitHole.tsx): a pending first read —
  // even via `.latest` — would suspend AppShell's boundary and blank the whole
  // route. This way the curated recommendations paint on the first frame and
  // live trends swap in whenever they resolve. On failure the resource settles
  // to [] and the statics stay.
  const live = () => (holes.state === 'ready' ? holes() : undefined);

  // Below-the-fold anniversary section; hidden entirely until data arrives.
  const [otd] = createResource(() => getOnThisDay(5));
  const otdItems = () => (otd.state === 'ready' ? otd() : undefined);
  const otdDateLabel = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });

  return (
    <div class="home">
      <section class="home__hero shell">
        <div class="home__window">
          <div class="home__titlebar">
            <div class="home__winbtns" aria-hidden="true">
              <span class="home__winbtn">
                <img src={ICON_CLOSE} alt="" width="7" />
              </span>
              <span class="home__winbtn home__winbtn--tv">
                <img src={ICON_TV} alt="" width="11" />
              </span>
              <span class="home__winbtn">
                <img src={ICON_CONTRACT} alt="" width="8" />
              </span>
            </div>
            <span class="home__wordmark">whisk</span>
          </div>
          <div class="home__windowbody">
            <p class="home__eyebrow">☼ WIKIPEDIA, OFF THE BEATEN PATH ☼</p>
            <h1 class="home__title">
              Fall down a better <em>rabbit hole.</em>
            </h1>
            <p class="home__lede">Ask in plain language. Follow the strange connections.</p>

            <div class="home__search">
              <CommandSearch size="hero" autofocus />
            </div>

            <div class="home__examples" aria-label="Example searches">
              <span class="home__examples-label mono">Try</span>
              <Show
                when={live()?.length}
                fallback={
                  <For each={RECOMMENDED_SEARCHES.slice(0, 5)}>
                    {(ex) => (
                      <A href={`/search?q=${encodeURIComponent(ex)}`} class="example-pill">
                        {ex}
                      </A>
                    )}
                  </For>
                }
              >
                <For each={live()!.slice(0, 5)}>
                  {(h, i) => (
                    <A
                      href={`/search?q=${encodeURIComponent(h.trend)}`}
                      class="example-pill stream-in"
                      style={{ 'animation-delay': `${i() * 80}ms` }}
                    >
                      {h.trend}
                    </A>
                  )}
                </For>
              </Show>
            </div>
          </div>
        </div>
      </section>

      <section class="home__featured shell">
        <div class="home__featured-head">
          <h2 class="home__section-title">Trending rabbit holes</h2>
          <p class="home__ai-note mono">
            {AI_ENABLED ? 'AI narration on' : 'Wikipedia signals only'}
          </p>
        </div>
        <div class="featured-grid">
          <Show
            when={live()?.length}
            fallback={
              <For each={RECOMMENDED_TRAILS}>
                {(f) => (
                  <A
                    href={`/path?from=${encodeURIComponent(f.from)}&to=${encodeURIComponent(f.to)}`}
                    class="featured-card"
                  >
                    <IconSpiral size={16} />
                    <span>{f.label}</span>
                  </A>
                )}
              </For>
            }
          >
            <For each={live()}>
              {(h, i) => (
                <A
                  href={`/path?from=${encodeURIComponent(h.title)}`}
                  class="featured-card stream-in"
                  style={{ 'animation-delay': `${i() * 80}ms` }}
                >
                  <IconSpiral size={16} />
                  <span>{h.label}</span>
                  <Show when={h.trafficLabel}>
                    <span class="featured-card__traffic mono">{h.trafficLabel}</span>
                  </Show>
                </A>
              )}
            </For>
          </Show>
        </div>
      </section>

      <Show when={otdItems()?.length}>
        <section class="home__otd shell">
          <div class="home__featured-head">
            <h2 class="home__section-title">On this day</h2>
            <p class="home__ai-note mono">{otdDateLabel} · from Wikipedia</p>
          </div>
          <ul class="otd-list">
            <For each={otdItems()}>
              {(item, i) => (
                <li class="otd-item stream-in" style={{ 'animation-delay': `${i() * 80}ms` }}>
                  <Show when={item.year}>
                    <span class="otd-item__year mono">{item.year}</span>
                  </Show>
                  <div class="otd-item__body">
                    <p class="otd-item__text">{item.text}</p>
                    <span class="otd-item__links">
                      <For each={item.pages}>
                        {(p) => (
                          <A href={`/wiki/${encodeURIComponent(p.title)}`} class="otd-chip">
                            {p.title}
                          </A>
                        )}
                      </For>
                    </span>
                  </div>
                </li>
              )}
            </For>
          </ul>
        </section>
      </Show>
    </div>
  );
}
