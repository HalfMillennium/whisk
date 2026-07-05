// Collections store — a Solid store persisted to localStorage. No accounts;
// everything lives on-device (MVP). Shared globally via a single module store.

import { createStore } from 'solid-js/store';
import type { Collection, CollectionItem } from '../lib/types';

// Collections aren't shipped yet (no backend persistence). Flip to true to
// re-expose the Save buttons across the app. The Collections nav link is
// separately gated in AppShell.tsx.
export const COLLECTIONS_ENABLED = false;

const KEY = 'whisk:collections';

function load(): Collection[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Collection[];
  } catch {
    /* ignore */
  }
  return [];
}

const [collections, setCollections] = createStore<Collection[]>(load());

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(collections));
  } catch {
    /* storage full/blocked — session state still holds */
  }
}

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}${collections.length}`;
}

export function useCollections() {
  return collections;
}

export function createCollection(name: string, description?: string): Collection {
  const col: Collection = {
    id: uid('col'),
    name: name.trim() || 'Untitled collection',
    description,
    items: [],
    createdAt: Date.now(),
  };
  setCollections((prev) => [col, ...prev]);
  persist();
  return col;
}

export function renameCollection(id: string, name: string) {
  setCollections((c) => c.id === id, 'name', name);
  persist();
}

export function deleteCollection(id: string) {
  setCollections((prev) => prev.filter((c) => c.id !== id));
  persist();
}

function itemKey(item: CollectionItem) {
  return `${item.kind}:${item.href}`;
}

export function addItem(collectionId: string, item: CollectionItem) {
  const idx = collections.findIndex((c) => c.id === collectionId);
  if (idx < 0) return;
  const exists = collections[idx].items.some((i) => itemKey(i) === itemKey(item));
  if (exists) return;
  setCollections(idx, 'items', (items) => [item, ...items]);
  persist();
}

export function removeItem(collectionId: string, href: string, kind: CollectionItem['kind']) {
  const idx = collections.findIndex((c) => c.id === collectionId);
  if (idx < 0) return;
  setCollections(idx, 'items', (items) =>
    items.filter((i) => !(i.href === href && i.kind === kind)),
  );
  persist();
}

export function setItemNote(collectionId: string, href: string, note: string) {
  const cIdx = collections.findIndex((c) => c.id === collectionId);
  if (cIdx < 0) return;
  const iIdx = collections[cIdx].items.findIndex((i) => i.href === href);
  if (iIdx < 0) return;
  setCollections(cIdx, 'items', iIdx, 'note', note);
  persist();
}

export function setCollectionSummary(id: string, summary: string) {
  setCollections((c) => c.id === id, 'summary', summary);
  persist();
}

/** Is this href already saved anywhere? Returns the collection ids. */
export function savedIn(href: string): string[] {
  return collections.filter((c) => c.items.some((i) => i.href === href)).map((c) => c.id);
}
