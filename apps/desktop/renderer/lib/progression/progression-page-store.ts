/**
 * Which page the Progression tab last showed, held for the window. The shell unmounts a tab the
 * player leaves, so the tab remembers its page here rather than in component state.
 */
import { useSyncExternalStore } from 'react';

export type ProgressionPageId = 'skills' | 'collections';

export const DEFAULT_PROGRESSION_PAGE: ProgressionPageId = 'skills';

export function createProgressionPageStore(initial: ProgressionPageId = DEFAULT_PROGRESSION_PAGE) {
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
    setPage: (next: ProgressionPageId) => {
      if (next === page) return;
      page = next;
      for (const listener of listeners) listener();
    },
  };
}

const store = createProgressionPageStore();

const subscribe = (listener: () => void) => store.subscribe(listener);
const snapshot = () => store.getPage();

export function useProgressionPage(): ProgressionPageId {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function getProgressionPage(): ProgressionPageId {
  return store.getPage();
}

export function setProgressionPage(page: ProgressionPageId): void {
  store.setPage(page);
}

export function isProgressionPageId(value: string): value is ProgressionPageId {
  return value === 'skills' || value === 'collections';
}
