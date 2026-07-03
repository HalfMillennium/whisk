import { For, Show, createResource, createSignal, createUniqueId, onCleanup } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { suggest } from '../lib/wiki/search';
import { IconSearch, IconArrow } from './icons';

interface Props {
  initial?: string;
  size?: 'hero' | 'compact';
  autofocus?: boolean;
}

export function CommandSearch(props: Props) {
  const navigate = useNavigate();
  const uid = createUniqueId();
  const [value, setValue] = createSignal(props.initial ?? '');
  const [open, setOpen] = createSignal(false);
  const [active, setActive] = createSignal(-1);
  let root!: HTMLDivElement;

  const [suggestions] = createResource(
    () => (open() ? value().trim() : ''),
    async (q) => (q.length >= 2 ? suggest(q, 6) : []),
  );

  // Read via `.latest` (not `suggestions()`) so a pending fetch never suspends
  // the route's <Suspense> boundary — otherwise the first keystroke unmounts the
  // input and steals focus.
  const list = () => suggestions.latest ?? [];
  const expanded = () => open() && list().length > 0;

  function go(q: string) {
    const query = q.trim();
    if (!query) return;
    setOpen(false);
    setActive(-1);
    navigate(`/search?q=${encodeURIComponent(query)}`);
  }

  function onKey(e: KeyboardEvent) {
    const l = list();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, l.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, -1));
    } else if (e.key === 'Enter') {
      if (expanded() && active() >= 0 && l[active()]) {
        e.preventDefault();
        go(l[active()]);
      } else {
        go(value());
      }
    } else if (e.key === 'Escape') {
      if (expanded()) {
        // first Escape closes the list (and blocks the native clear); second clears
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        setActive(-1);
      } else if (value()) {
        e.stopPropagation();
        setValue('');
      }
    }
  }

  // Dismiss when focus or a pointer press leaves the component — no blur timeouts.
  function onFocusOut(e: FocusEvent) {
    if (!root.contains(e.relatedTarget as Node | null)) {
      setOpen(false);
      setActive(-1);
    }
  }
  function onPointerDown(e: PointerEvent) {
    if (!root.contains(e.target as Node)) {
      setOpen(false);
      setActive(-1);
    }
  }
  document.addEventListener('pointerdown', onPointerDown);
  onCleanup(() => document.removeEventListener('pointerdown', onPointerDown));

  // Autofocus pops the software keyboard and scrolls the page on touch devices — desktop only.
  const shouldAutofocus = props.autofocus === true && matchMedia('(pointer: fine)').matches;

  return (
    <div
      class="cmd"
      classList={{ 'cmd--hero': props.size !== 'compact' }}
      ref={root}
      onFocusOut={onFocusOut}
    >
      <form
        class="cmd__bar"
        onSubmit={(e) => {
          e.preventDefault();
          go(value());
        }}
      >
        <span class="cmd__icon" aria-hidden="true">
          <IconSearch size={props.size === 'compact' ? 18 : 22} />
        </span>
        <input
          class="cmd__input"
          type="search"
          role="combobox"
          aria-expanded={expanded()}
          aria-controls={`cmd-listbox-${uid}`}
          aria-activedescendant={active() >= 0 ? `cmd-opt-${uid}-${active()}` : undefined}
          aria-autocomplete="list"
          // eslint-disable-next-line
          autofocus={shouldAutofocus}
          value={value()}
          placeholder="Search Wikipedia like a rabbit hole…"
          aria-label="Search query"
          autocomplete="off"
          spellcheck={false}
          onInput={(e) => {
            setValue(e.currentTarget.value);
            setActive(-1);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
        />
        <button class="cmd__go btn btn--primary" type="submit" disabled={!value().trim()}>
          <span class="cmd__go-label">Explore</span>
          <IconArrow size={17} />
        </button>
      </form>

      <Show when={expanded()}>
        <ul class="cmd__suggest" role="listbox" id={`cmd-listbox-${uid}`} aria-label="Suggestions">
          <For each={list()}>
            {(s, i) => (
              <li>
                <button
                  type="button"
                  role="option"
                  id={`cmd-opt-${uid}-${i()}`}
                  aria-selected={active() === i()}
                  class="cmd__suggest-item"
                  classList={{ 'is-active': active() === i() }}
                  tabindex={-1}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    go(s);
                  }}
                  onMouseEnter={() => setActive(i())}
                >
                  <IconSearch size={14} />
                  {s}
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  );
}
