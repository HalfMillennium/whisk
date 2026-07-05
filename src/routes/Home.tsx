import { For, Show, Suspense, createResource } from 'solid-js';
import { A } from '@solidjs/router';
import { CommandSearch } from '../components/CommandSearch';
import { AI_ENABLED } from '../lib/ai';
import { getTrendingHoles } from '../lib/trends';
import { IconSpiral } from '../components/icons';

// Exact Poolsuite title-bar glyphs (base64 PNGs from the reference window),
// rendered pixelated so they stay crisp. Decorative only.
const ICON_CLOSE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAOAQMAAAAlhr+SAAAABlBMVEUAAAAAAAClZ7nPAAAAAXRSTlMAQObYZgAAAB1JREFUCNdjOMADQgYGIMRzAISYGYAIwoaIQ9QAAKYLB+eSH+asAAAAAElFTkSuQmCC';
const ICON_TV =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWBAMAAAA2mnEIAAAAHlBMVEUAAAD///////////////////////////////////8kfJuVAAAACXRSTlMAIO+/EK+gn7AFTmhBAAAATUlEQVQY02MAgZlACAQINoKDwWY0mgkBUwUYhGbCgCJDZApUndhkhpkCUDbLJKA2XBBKobKppl7TgQHq4JkMloVQtvsMFDczRkKZygIAruY/K5IcNPMAAAAASUVORK5CYII=';
const ICON_CONTRACT =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWAQMAAAD+ev54AAAABlBMVEUAAAAAAAClZ7nPAAAAAXRSTlMAQObYZgAAABdJREFUCNdjYGBmwIH/gDEu8B+McWoHALXwBCGzcXiRAAAAAElFTkSuQmCC';

const EXAMPLES = [
  'forgotten disasters',
  'ancient frauds',
  'scientists mocked for being right',
  'failed utopian communities',
  'abandoned cities',
];

// Fallback trails shown when live trends can't be loaded, so the section is
// never empty.
const FEATURED = [
  { label: 'Napoleon → Canning', from: 'Napoleon', to: 'Canning' },
  { label: 'Medici Bank → Modern banking', from: 'Medici Bank', to: 'Bank' },
  { label: 'Nikola Tesla → Coney Island', from: 'Nikola Tesla', to: 'Coney Island' },
  { label: 'Tulip mania → Financial bubble', from: 'Tulip mania', to: 'Economic bubble' },
];

export default function Home() {
  const [holes] = createResource(getTrendingHoles);

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
              {/* Local Suspense: only the pills wait on the trends resource — the
                  hero renders immediately instead of blanking the whole route. */}
              <Suspense
                fallback={
                  <For each={[0, 1, 2, 3, 4]}>
                    {(i) => (
                      <span
                        class="example-pill example-pill--loading"
                        style={{ width: `${5 + (i % 3) * 2}rem` }}
                        aria-hidden="true"
                      />
                    )}
                  </For>
                }
              >
                <Show
                  when={holes()?.length}
                  fallback={
                    <For each={EXAMPLES}>
                      {(ex) => (
                        <A href={`/search?q=${encodeURIComponent(ex)}`} class="example-pill">
                          {ex}
                        </A>
                      )}
                    </For>
                  }
                >
                  <For each={holes()!.slice(0, 5)}>
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
              </Suspense>
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
          {/* Local Suspense keeps loading contained to this grid. */}
          <Suspense
            fallback={
              <For each={FEATURED}>
                {() => <div class="featured-card featured-card--loading" aria-hidden="true" />}
              </For>
            }
          >
            <Show
              when={holes()?.length}
              fallback={
                <For each={FEATURED}>
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
              <For each={holes()}>
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
          </Suspense>
        </div>
      </section>
    </div>
  );
}
