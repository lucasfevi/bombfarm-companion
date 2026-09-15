import { afterEach, describe, expect, it, vi } from 'vitest';

const mockWorker = {
  postMessage: vi.fn(),
  terminate: vi.fn(),
  onmessage: null,
  onerror: null,
};
const createTeamPlanWorkerModuleMock = vi.fn(() => mockWorker);

vi.mock('@bombfarm/team-plan/runner', () => ({
  createTeamPlanWorkerModule: () => createTeamPlanWorkerModuleMock(),
}));

const { createOptimizerWorker, E2E_NO_WORKER_KEY } = await import('./optimizer-worker');

type FakeGlobal = { localStorage?: Storage };

function installStorage(entries: Record<string, string> = {}): void {
  const store = new Map(Object.entries(entries));
  (globalThis as unknown as FakeGlobal).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: () => null,
    length: 0,
  };
}

describe('createOptimizerWorker', () => {
  afterEach(() => {
    delete (globalThis as unknown as FakeGlobal).localStorage;
    createTeamPlanWorkerModuleMock.mockClear();
  });

  it('throws when the smoke has disabled the worker, without building one', () => {
    installStorage({ [E2E_NO_WORKER_KEY]: '1' });
    expect(() => createOptimizerWorker()).toThrow();
    expect(createTeamPlanWorkerModuleMock).not.toHaveBeenCalled();
  });

  it('delegates to the package chunk factory when the knob is absent', () => {
    installStorage();
    expect(createOptimizerWorker()).toBe(mockWorker);
    expect(createTeamPlanWorkerModuleMock).toHaveBeenCalledTimes(1);
  });

  it('delegates when localStorage does not exist at all', () => {
    delete (globalThis as unknown as FakeGlobal).localStorage;
    expect(createOptimizerWorker()).toBe(mockWorker);
  });
});
