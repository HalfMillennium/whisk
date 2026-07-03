// Global "save to collection" drawer state.
import { createSignal } from 'solid-js';
import type { CollectionItem } from '../lib/types';

const [pending, setPending] = createSignal<CollectionItem | null>(null);

export { pending };

export function openSave(item: CollectionItem) {
  setPending(item);
}
export function closeSave() {
  setPending(null);
}
