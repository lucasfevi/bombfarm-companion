import { describe, expect, it, vi } from 'vitest';
import { RuntimePort, RUNTIME_MODULE_SPECIFIER } from './runtime.js';
import type { LogPort, TapRuntime } from './runtime.js';

vi.mock('@bombfarm/tap-runtime', () => ({
  createTapRuntime: (deps?: { log?: LogPort }) => {
    deps?.log?.info({ scope: 'tap-runtime', event: 'hook.installed', pid: 4242, base: '0x0', absoluteAddress: '0x1000' });
    return {
      attach: () => {
        throw new Error('not used by this test');
      },
    };
  },
}));

function createLogSpy(): { log: LogPort; infos: Record<string, unknown>[] } {
  const infos: Record<string, unknown>[] = [];
  return { log: { info: (record) => infos.push(record) }, infos };
}

const FAKE_RUNTIME: TapRuntime = {
  attach: () => {
    throw new Error('not used by these tests');
  },
};

describe('RuntimePort.resolve', () => {
  it('has a single exported module specifier the resolver is swapped against', () => {
    expect(RUNTIME_MODULE_SPECIFIER).toBe('@bombfarm/tap-runtime');
  });

  it('returns the runtime when the resolver succeeds, without logging', async () => {
    const { log, infos } = createLogSpy();
    const port = new RuntimePort({ resolve: () => Promise.resolve(FAKE_RUNTIME), log });

    const result = await port.resolve();

    expect(result).toEqual({ kind: 'ok', runtime: FAKE_RUNTIME });
    expect(infos).toHaveLength(0);
  });

  it('never throws when the resolver rejects, and reports runtimeUnavailable with likelyQuarantine false', async () => {
    const { log, infos } = createLogSpy();
    const port = new RuntimePort({ resolve: () => Promise.reject(new Error('no prebuild')), log });

    const result = await port.resolve();

    expect(result).toEqual({ kind: 'unavailable', likelyQuarantine: false });
    expect(infos).toHaveLength(1);
    expect(infos[0]).toMatchObject({ event: 'runtime.unavailable', likelyQuarantine: false });
  });

  it('reports likelyQuarantine true once a prior resolution succeeded and a later one fails', async () => {
    const { log, infos } = createLogSpy();
    let shouldFail = false;
    const port = new RuntimePort({
      resolve: () => (shouldFail ? Promise.reject(new Error('module vanished')) : Promise.resolve(FAKE_RUNTIME)),
      log,
    });

    const first = await port.resolve();
    expect(first).toEqual({ kind: 'ok', runtime: FAKE_RUNTIME });

    shouldFail = true;
    const second = await port.resolve();

    expect(second).toEqual({ kind: 'unavailable', likelyQuarantine: true });
    expect(infos).toHaveLength(1);
  });

  it('logs exactly once per failed resolution, not once per rejection cause', async () => {
    const { log, infos } = createLogSpy();
    const port = new RuntimePort({ resolve: () => Promise.reject(new Error('missing')), log });

    await port.resolve();

    expect(infos).toHaveLength(1);
  });

  it('defaults to the real module specifier when no resolver is injected', () => {
    const port = new RuntimePort();
    expect(port).toBeInstanceOf(RuntimePort);
  });

  it('threads the injected log port through the default resolver to the runtime it builds', async () => {
    const { log, infos } = createLogSpy();
    const port = new RuntimePort({ log });

    const result = await port.resolve();

    expect(result.kind).toBe('ok');
    expect(infos).toEqual([
      { scope: 'tap-runtime', event: 'hook.installed', pid: 4242, base: '0x0', absoluteAddress: '0x1000' },
    ]);
  });
});
