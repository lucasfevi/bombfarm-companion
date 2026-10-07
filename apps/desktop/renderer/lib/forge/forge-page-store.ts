/**
 * Which page the Forge tab is showing, held for the window. The shell unmounts a tab the player
 * leaves, so a `useState` in the tab would reopen it on Forge every time; module scope remembers
 * the page until the window closes.
 */
import { useSyncExternalStore } from 'react';

export type ForgePageId = 'forge' | 'deconstruct';

export const DEFAULT_FORGE_PAGE: ForgePageId = 'forge';

export function createForgePageStore(initial: ForgePageId = DEFAULT_FORGE_PAGE) {
  let page = initial;
  const listeners = new Set<() => void>();

  return {
    getPage: () => page,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setPage: (next: ForgePageId) => {
      if (next === page) return;
      page = next;
      for (const listener of listeners) listener();
    },
  };
}

const store = createForgePageStore();

const subscribe = (listener: () => void) => store.subscribe(listener);
const snapshot = () => store.getPage();

export function useForgePage(): ForgePageId {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function setForgePage(page: ForgePageId): void {
  store.setPage(page);
}

export function isForgePageId(value: string): value is ForgePageId {
  return value === 'forge' || value === 'deconstruct';
}
