// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { LiveMap } from '@bombfarm/contracts';
import type { MapSize } from '@bombfarm/domain/model';
import type { LiveModel } from './live-model';
import { useLiveMapSize } from './use-live-map-size';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const store = vi.hoisted(() => {
  let model = { map: null } as unknown as LiveModel;
  const listeners = new Set<(next: LiveModel) => void>();
  return {
    getModel: () => model,
    subscribe: (listener: (next: LiveModel) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start: () => undefined,
    publish(next: LiveModel) {
      model = next;
      for (const listener of listeners) listener(next);
    },
  };
});

vi.mock('./use-live-model', () => ({ sharedLiveStore: () => store }));

function modelOn(mapSize: MapSize | null, propsAlive = 75): LiveModel {
  const map: LiveMap = { phase: 61, healthFraction: 1, propsAlive, propsTotal: 75, mapSize, economy: null };
  return { map } as unknown as LiveModel;
}

describe('useLiveMapSize', () => {
  let container: HTMLDivElement;
  let root: Root;
  let seen: (MapSize | null)[];

  function Probe() {
    seen.push(useLiveMapSize());
    return null;
  }

  beforeEach(() => {
    seen = [];
    store.publish({ map: null } as unknown as LiveModel);
    container = document.createElement('div');
    document.body.appendChild(container);
    act(() => {
      root = createRoot(container);
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  function mount() {
    act(() => {
      root.render(createElement(Probe));
    });
  }

  function publish(model: LiveModel) {
    act(() => {
      store.publish(model);
    });
  }

  it('reads no field while the game shows no map', () => {
    mount();
    expect(seen.at(-1)).toBeNull();
  });

  it('follows the field the game switches to', () => {
    mount();
    publish(modelOn('classic'));
    expect(seen.at(-1)).toBe('classic');

    publish(modelOn('compact'));
    expect(seen.at(-1)).toBe('compact');
  });

  it('stops re-rendering while fast updates move the map but not its field', () => {
    mount();
    publish(modelOn('compact', 75));
    publish(modelOn('compact', 60));
    const renders = seen.length;

    for (const propsAlive of [40, 30, 20, 12]) publish(modelOn('compact', propsAlive));
    expect(seen).toHaveLength(renders);
  });
});
