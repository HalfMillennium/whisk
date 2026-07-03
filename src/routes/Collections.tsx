import { For, Show, createSignal } from 'solid-js';
import { A } from '@solidjs/router';
import {
  useCollections,
  createCollection,
  deleteCollection,
  removeItem,
  setItemNote,
  setCollectionSummary,
} from '../stores/collections';
import { summarizeCollection, AI_ENABLED } from '../lib/ai';
import type { Collection } from '../lib/types';
import { EmptyState } from '../components/bits';
import {
  IconPlus,
  IconTrash,
  IconSparkle,
  IconExternal,
  IconSpiral,
  IconBookmark,
} from '../components/icons';

export default function Collections() {
  const collections = useCollections();
  const [newName, setNewName] = createSignal('');

  function add(e: Event) {
    e.preventDefault();
    if (!newName().trim()) return;
    createCollection(newName().trim());
    setNewName('');
  }

  return (
    <div class="collections shell">
      <header class="collections__head">
        <div>
          <p class="eyebrow">Your trails</p>
          <h1 class="collections__title">Collections</h1>
          <p class="collections__lede">
            Saved pages and rabbit holes, kept on this device. Add notes, generate a summary, or
            export to Markdown.
          </p>
        </div>
        <form class="collections__new" onSubmit={add}>
          <input
            class="input"
            placeholder="New collection…"
            value={newName()}
            onInput={(e) => setNewName(e.currentTarget.value)}
            aria-label="New collection name"
          />
          <button type="submit" class="btn btn--primary" disabled={!newName().trim()}>
            <IconPlus size={16} /> New
          </button>
        </form>
      </header>

      <Show
        when={collections.length}
        fallback={
          <EmptyState glyph="✦" title="No collections yet">
            <p>
              Save a page or a rabbit hole and it lands here. Start from a{' '}
              <A href="/search">search</A> or a <A href="/path">rabbit hole</A>.
            </p>
          </EmptyState>
        }
      >
        <div class="collections__list">
          <For each={collections}>{(col) => <CollectionCard col={col} />}</For>
        </div>
      </Show>
    </div>
  );
}

function CollectionCard(props: { col: Collection }) {
  const [busy, setBusy] = createSignal(false);
  const [summaryError, setSummaryError] = createSignal(false);
  const [confirming, setConfirming] = createSignal(false);
  const col = () => props.col;
  let confirmTimer: ReturnType<typeof setTimeout> | undefined;

  async function summarize() {
    setBusy(true);
    setSummaryError(false);
    try {
      const summary = await summarizeCollection(
        col().name,
        col().items.map((i) => ({ title: i.title, description: i.description })),
      );
      setCollectionSummary(col().id, summary);
    } catch {
      setSummaryError(true);
    } finally {
      setBusy(false);
    }
  }

  // deleting is irreversible (localStorage) — two-step inline confirm, no modal
  function askDelete() {
    if (confirming()) {
      clearTimeout(confirmTimer);
      deleteCollection(col().id);
      return;
    }
    setConfirming(true);
    confirmTimer = setTimeout(() => setConfirming(false), 4000);
  }

  function exportMd() {
    const c = col();
    const lines = [`# ${c.name}`, ''];
    if (c.summary) lines.push(`> ${c.summary}`, '');
    for (const it of c.items) {
      lines.push(`## ${it.title}`);
      if (it.description) lines.push(it.description);
      if (it.note) lines.push(`*Note:* ${it.note}`);
      lines.push(`- whisk: ${it.href}`);
      lines.push('');
    }
    lines.push('---', '_Sources: Wikipedia (CC BY-SA), organised with whisk._');
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${c.name.replace(/[^\w-]+/g, '-').toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section class="col-card">
      <header class="col-card__head">
        <div>
          <h2 class="col-card__name">{col().name}</h2>
          <p class="col-card__meta mono">
            {col().items.length} {col().items.length === 1 ? 'item' : 'items'}
          </p>
        </div>
        <div class="col-card__tools">
          <button
            type="button"
            class="btn btn--ghost"
            onClick={summarize}
            disabled={busy() || !col().items.length}
            title={AI_ENABLED ? 'Summarize with AI' : 'Summarize'}
          >
            <IconSparkle size={15} /> {busy() ? 'Summarizing…' : 'Summarize'}
          </button>
          <button
            type="button"
            class="btn btn--ghost"
            onClick={exportMd}
            disabled={!col().items.length}
          >
            <IconExternal size={15} /> Export
          </button>
          <Show
            when={confirming()}
            fallback={
              <button
                type="button"
                class="icon-btn col-card__del"
                onClick={askDelete}
                aria-label={`Delete ${col().name}`}
              >
                <IconTrash size={16} />
              </button>
            }
          >
            <button
              type="button"
              class="btn btn--danger"
              onClick={askDelete}
              aria-label={`Confirm deleting ${col().name}`}
            >
              <IconTrash size={15} /> Delete?
            </button>
          </Show>
        </div>
      </header>

      <Show when={summaryError()}>
        <p class="col-card__error" role="alert">
          Couldn't generate a summary — try again in a moment.
        </p>
      </Show>

      <Show when={col().summary}>
        <p class="col-card__summary serif">{col().summary}</p>
      </Show>

      <Show
        when={col().items.length}
        fallback={<p class="muted-note">Nothing saved here yet.</p>}
      >
        <ul class="col-items">
          <For each={col().items}>
            {(item) => (
              <li class="col-item">
                <span class="col-item__kind" aria-hidden="true">
                  <Show when={item.kind === 'path'} fallback={<IconBookmark size={15} />}>
                    <IconSpiral size={15} />
                  </Show>
                </span>
                <div class="col-item__body">
                  <A href={item.href} class="col-item__title">
                    {item.title}
                  </A>
                  <Show when={item.description}>
                    <p class="col-item__desc">{item.description}</p>
                  </Show>
                  <input
                    class="col-item__note"
                    placeholder="Add a note…"
                    value={item.note ?? ''}
                    onChange={(e) => setItemNote(col().id, item.href, e.currentTarget.value)}
                    aria-label={`Note for ${item.title}`}
                  />
                </div>
                <button
                  type="button"
                  class="icon-btn"
                  onClick={() => removeItem(col().id, item.href, item.kind)}
                  aria-label={`Remove ${item.title}`}
                >
                  ✕
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </section>
  );
}
