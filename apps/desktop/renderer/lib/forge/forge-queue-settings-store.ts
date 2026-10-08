import { useSyncExternalStore } from 'react';
import { createLazySingleton } from '../shared-store';
import {
  DEFAULT_FORGE_QUEUE_SETTINGS,
  editQueueStoneRanges,
  loadForgeQueueSettings,
  saveForgeQueueSettings,
  type ForgeQueueSettings,
} from './forge-queue-settings';
import type { ForgeStoneEdit } from './use-forge-plan';

export interface ForgeQueueSettingsStoreDeps {
  readonly load: () => ForgeQueueSettings;
  readonly save: (settings: ForgeQueueSettings) => void;
}

export interface ForgeQueueSettingsStore {
  readonly get: () => ForgeQueueSettings;
  readonly subscribe: (listener: () => void) => () => void;
  readonly editStones: (edit: ForgeStoneEdit) => void;
  readonly setStop: (stopWhenOutOfStones: boolean) => void;
  readonly setScroll: (scroll: boolean) => void;
}

export function createForgeQueueSettingsStore(deps: ForgeQueueSettingsStoreDeps): ForgeQueueSettingsStore {
  let settings = deps.load();
  const listeners = new Set<() => void>();

  function replace(next: ForgeQueueSettings): void {
    settings = next;
    deps.save(next);
    for (const listener of listeners) listener();
  }

  return {
    get: () => settings,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    editStones: (edit) => {
      replace(editQueueStoneRanges(settings, edit));
    },
    setStop: (stopWhenOutOfStones) => {
      if (stopWhenOutOfStones !== settings.stopWhenOutOfStones) replace({ ...settings, stopWhenOutOfStones });
    },
    setScroll: (scroll) => {
      if (scroll !== settings.scroll) replace({ ...settings, scroll });
    },
  };
}

const sharedSettingsStore = createLazySingleton(() =>
  createForgeQueueSettingsStore({ load: loadForgeQueueSettings, save: saveForgeQueueSettings }),
);

export function currentForgeQueueSettings(): ForgeQueueSettings {
  return sharedSettingsStore().get();
}

export function useForgeQueueSettings(): ForgeQueueSettings {
  return useSyncExternalStore(
    (listener) => sharedSettingsStore().subscribe(listener),
    () => sharedSettingsStore().get(),
    () => DEFAULT_FORGE_QUEUE_SETTINGS,
  );
}

export function editForgeQueueStones(edit: ForgeStoneEdit): void {
  sharedSettingsStore().editStones(edit);
}

export function setForgeQueueStop(stop: boolean): void {
  sharedSettingsStore().setStop(stop);
}

export function setForgeQueueScroll(scroll: boolean): void {
  sharedSettingsStore().setScroll(scroll);
}
