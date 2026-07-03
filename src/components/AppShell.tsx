import { Suspense, type ParentProps } from 'solid-js';
import { A, useLocation } from '@solidjs/router';
import { SaveDrawer } from './SaveDrawer';
import { IconWhisk, IconSpiral, IconSearch, IconCite } from './icons';

export function AppShell(props: ParentProps) {
  const location = useLocation();
  const onHome = () => location.pathname === '/';

  return (
    <div class="app">
      <header class="nav">
        <div class="shell nav__inner">
          <A href="/" class="brand" aria-label="whisk home">
            <span class="brand__mark" aria-hidden="true">
              <IconWhisk size={30} />
            </span>
            <span class="brand__word">whisk</span>
          </A>

          <nav class="nav__links" aria-label="Primary">
            <A href="/search" class="nav__link" aria-label="Search" title="Search">
              <IconSearch size={15} />
              <span class="nav__link-label">Search</span>
            </A>
            <A href="/path" class="nav__link" aria-label="Rabbit holes" title="Rabbit holes">
              <IconSpiral size={15} />
              <span class="nav__link-label">Rabbit holes</span>
            </A>
            <A href="/blog" class="nav__link" aria-label="Blog" title="Blog">
              <IconCite size={15} />
              <span class="nav__link-label">Blog</span>
            </A>
            {/* Collections hidden for v1 — no backend persistence yet. Restore this
                link (and re-add the IconBookmark import) when saved data ships.
            <A href="/collections" class="nav__link" aria-label="Collections" title="Collections">
              <IconBookmark size={15} />
              <span class="nav__link-label">Collections</span>
            </A> */}
          </nav>
        </div>
      </header>

      <main class="app__main" classList={{ 'app__main--home': onHome() }}>
        <Suspense fallback={<div class="route-fallback" aria-live="polite" />}>
          {props.children}
        </Suspense>
      </main>

      <footer class="foot">
        <div class="shell foot__inner">
          <p>
            whisk is a discovery layer over{' '}
            <a href="https://en.wikipedia.org" target="_blank" rel="noreferrer">
              Wikipedia
            </a>
            . Content is licensed{' '}
            <a
              href="https://creativecommons.org/licenses/by-sa/4.0/"
              target="_blank"
              rel="noreferrer"
            >
              CC BY-SA
            </a>
            ; every page links back to its source.
          </p>
        </div>
      </footer>

      <SaveDrawer />
    </div>
  );
}
