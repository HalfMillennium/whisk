import { For } from 'solid-js';
import { A } from '@solidjs/router';
import { CommandSearch } from '../components/CommandSearch';
import { AI_ENABLED } from '../lib/ai';
import { IconSpiral } from '../components/icons';

const EXAMPLES = [
  'forgotten disasters',
  'ancient frauds',
  'scientists mocked for being right',
  'failed utopian communities',
  'abandoned cities',
];

const FEATURED = [
  { label: 'Napoleon → Canning', from: 'Napoleon', to: 'Canning' },
  { label: 'Medici Bank → Modern banking', from: 'Medici Bank', to: 'Bank' },
  { label: 'Nikola Tesla → Coney Island', from: 'Nikola Tesla', to: 'Coney Island' },
  { label: 'Tulip mania → Financial bubble', from: 'Tulip mania', to: 'Economic bubble' },
];

export default function Home() {
  return (
    <div class="home">
      <section class="home__hero shell">
        <div class="home__window">
          <div class="home__titlebar">
            <span class="home__close" aria-hidden="true" />
            <span class="home__titlechip">whisk.exe</span>
            <span class="home__spacer" aria-hidden="true" />
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
              <For each={EXAMPLES}>
                {(ex) => (
                  <A href={`/search?q=${encodeURIComponent(ex)}`} class="example-pill">
                    {ex}
                  </A>
                )}
              </For>
            </div>
          </div>
        </div>
      </section>

      <section class="home__featured shell">
        <div class="home__featured-head">
          <h2 class="home__section-title">Featured rabbit holes</h2>
          <p class="home__ai-note mono">
            {AI_ENABLED ? 'AI narration on' : 'Wikipedia signals only'}
          </p>
        </div>
        <div class="featured-grid">
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
        </div>
      </section>
    </div>
  );
}
