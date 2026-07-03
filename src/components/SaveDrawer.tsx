import { For, Show, createSignal, createMemo, onMount, onCleanup } from 'solid-js';
import { animate } from 'motion';
import { pending, closeSave } from '../stores/saveDrawer';
import {
  useCollections,
  createCollection,
  addItem,
  removeItem,
} from '../stores/collections';
import { IconPlus, IconBookmark } from './icons';

export function SaveDrawer() {
  const collections = useCollections();
  const [newName, setNewName] = createSignal('');

  const item = pending;
  const isIn = (colId: string) =>
    createMemo(() => {
      const it = item();
      if (!it) return false;
      const col = collections.find((c) => c.id === colId);
      return !!col?.items.some((i) => i.href === it.href && i.kind === it.kind);
    });

  function toggle(colId: string) {
    const it = item();
    if (!it) return;
    const col = collections.find((c) => c.id === colId);
    const already = col?.items.some((i) => i.href === it.href && i.kind === it.kind);
    if (already) removeItem(colId, it.href, it.kind);
    else addItem(colId, it);
  }

  function addNew(e: Event) {
    e.preventDefault();
    const name = newName().trim();
    if (!name) return;
    const col = createCollection(name);
    const it = item();
    if (it) addItem(col.id, it);
    setNewName('');
  }

  return (
    <Show when={item()}>
      {(it) => {
        let panel!: HTMLElement;
        let scrim!: HTMLDivElement;
        let closeBtn!: HTMLButtonElement;
        let closing = false;
        const invoker = document.activeElement as HTMLElement | null;

        function requestClose() {
          if (closing) return;
          closing = true;
          if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
            closeSave();
            return;
          }
          const ease = [0.165, 0.84, 0.44, 1] as [number, number, number, number];
          animate(scrim, { opacity: 0 }, { duration: 0.2, ease });
          animate(panel, { x: 24, opacity: 0 }, { duration: 0.2, ease }).finished.then(closeSave);
        }

        function onKeyDown(e: KeyboardEvent) {
          if (e.key === 'Escape') {
            e.preventDefault();
            requestClose();
            return;
          }
          if (e.key !== 'Tab') return;
          // minimal focus trap: wrap Tab / Shift+Tab inside the panel
          const focusables = panel.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input, a[href], [tabindex]:not([tabindex="-1"])',
          );
          if (!focusables.length) return;
          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }

        onMount(() => {
          closeBtn.focus();
          const prevOverflow = document.body.style.overflow;
          document.body.style.overflow = 'hidden';
          onCleanup(() => {
            document.body.style.overflow = prevOverflow;
            invoker?.focus?.();
          });
        });

        return (
          <div
            class="drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Save to collection"
            onKeyDown={onKeyDown}
          >
            <div class="drawer__scrim" ref={scrim} onClick={requestClose} />
            <aside class="drawer__panel" ref={panel}>
              <header class="drawer__head">
                <div>
                  <p class="eyebrow">Save {it().kind}</p>
                  <h2 class="drawer__title">{it().title}</h2>
                </div>
                <button
                  type="button"
                  class="icon-btn"
                  ref={closeBtn}
                  onClick={requestClose}
                  aria-label="Close"
                >
                  ✕
                </button>
              </header>

              <Show
                when={collections.length}
                fallback={<p class="drawer__empty">No collections yet — make your first one below.</p>}
              >
                <ul class="drawer__list">
                  <For each={collections}>
                    {(col) => {
                      const inCol = isIn(col.id);
                      return (
                        <li>
                          <button
                            type="button"
                            class="drawer__row"
                            classList={{ 'drawer__row--on': inCol() }}
                            onClick={() => toggle(col.id)}
                            aria-pressed={inCol()}
                          >
                            <span class="drawer__row-mark" aria-hidden="true">
                              <IconBookmark size={15} />
                            </span>
                            <span class="drawer__row-name">{col.name}</span>
                            <span class="drawer__row-count mono">{col.items.length}</span>
                          </button>
                        </li>
                      );
                    }}
                  </For>
                </ul>
              </Show>

              <form class="drawer__new" onSubmit={addNew}>
                <input
                  class="input"
                  placeholder="New collection…"
                  value={newName()}
                  onInput={(e) => setNewName(e.currentTarget.value)}
                  aria-label="New collection name"
                />
                <button type="submit" class="btn btn--primary" disabled={!newName().trim()}>
                  <IconPlus size={16} />
                  Create
                </button>
              </form>
            </aside>
          </div>
        );
      }}
    </Show>
  );
}
