import { beforeEach, describe, expect, it, vi } from 'vitest';

type WireListener = (event: unknown, payload: unknown) => void;

const electronState = vi.hoisted(() => ({
  exposeInMainWorld: vi.fn<(key: string, api: unknown) => void>(),
  on: vi.fn<(channel: string, listener: (event: unknown, payload: unknown) => void) => void>(),
  removeListener:
    vi.fn<(channel: string, listener: (event: unknown, payload: unknown) => void) => void>(),
  invoke: vi.fn<(channel: string, ...args: unknown[]) => Promise<unknown>>(),
}));

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: electronState.exposeInMainWorld },
  ipcRenderer: {
    on: electronState.on,
    removeListener: electronState.removeListener,
    invoke: electronState.invoke,
  },
}));

vi.mock('electron-log/renderer.js', () => ({
  default: {
    transports: { console: { level: 'silly' as string } },
    info: vi.fn(),
  },
}));

import {
  createPingResponse,
  ipcEventName,
  type ConsentRecord,
  type IpcEventChannel,
  type IpcEvents,
  type IpcInvokeArgs,
  type IpcInvokeChannel,
  type IpcInvokeResult,
} from '@bombfarm/contracts';

import './index.js';

interface BfcBridge {
  invoke: <C extends IpcInvokeChannel>(
    channel: C,
    ...args: IpcInvokeArgs<C>
  ) => Promise<IpcInvokeResult<C>>;
  on: <C extends IpcEventChannel>(
    channel: C,
    handler: (payload: IpcEvents[C]) => void,
  ) => () => void;
  ping: () => ReturnType<typeof createPingResponse>;
  logBoot: () => ReturnType<typeof createPingResponse>;
}

function exposedBridge(): { key: string; api: BfcBridge } {
  const call = electronState.exposeInMainWorld.mock.calls[0];
  if (!call) {
    throw new Error('preload never called contextBridge.exposeInMainWorld');
  }
  return { key: call[0], api: call[1] as BfcBridge };
}

function onCall(index: number): [string, WireListener] {
  const call = electronState.on.mock.calls[index];
  if (!call) {
    throw new Error(`ipcRenderer.on was called fewer than ${String(index + 1)} times`);
  }
  return call;
}

const bridge = exposedBridge();

const record: ConsentRecord = {
  decision: 'granted',
  grantedAt: '2026-09-29T00:00:00.000Z',
  textVersion: 1,
};

beforeEach(() => {
  electronState.on.mockClear();
  electronState.removeListener.mockClear();
  electronState.invoke.mockClear();
});

describe('preload context bridge', () => {
  it('exposes exactly invoke, on, ping and logBoot under the bfc key', () => {
    expect(electronState.exposeInMainWorld).toHaveBeenCalledTimes(1);
    expect(bridge.key).toBe('bfc');
    expect(Object.keys(bridge.api).sort()).toEqual(['invoke', 'logBoot', 'on', 'ping']);
  });

  it('answers ping from the preload world', () => {
    expect(bridge.api.ping()).toEqual({ ok: true, from: 'preload' });
  });

  it('answers logBoot from the preload world', () => {
    expect(bridge.api.logBoot()).toEqual({ ok: true, from: 'preload' });
  });
});

describe('preload invoke', () => {
  it('forwards every call over the one bfc:invoke channel, with the caller channel first', async () => {
    electronState.invoke.mockResolvedValue({ ok: true });

    await bridge.api.invoke('settings:setAlwaysOnTopMain', true);

    expect(electronState.invoke).toHaveBeenCalledTimes(1);
    expect(electronState.invoke).toHaveBeenCalledWith(
      'bfc:invoke',
      'settings:setAlwaysOnTopMain',
      true,
    );
  });

  it('resolves with whatever the main process answered', async () => {
    electronState.invoke.mockResolvedValue({ ok: true });

    await expect(bridge.api.invoke('settings:setAlwaysOnTopMain', false)).resolves.toEqual({
      ok: true,
    });
  });
});

describe('preload on', () => {
  it('registers its listener on the prefixed name contracts composes, not a hand-built one', () => {
    bridge.api.on('consent:changed', vi.fn());

    expect(electronState.on).toHaveBeenCalledTimes(1);
    expect(onCall(0)[0]).toBe(ipcEventName('consent:changed'));
    expect(onCall(0)[0]).toBe('bfc:event:consent:changed');
  });

  it('calls the caller handler with the payload alone, dropping the Electron event argument', () => {
    const handler = vi.fn<(payload: ConsentRecord) => void>();
    bridge.api.on('consent:changed', handler);

    onCall(0)[1]({ sender: 'ipc' }, record);

    expect(handler).toHaveBeenCalledWith(record);
    expect(handler.mock.calls[0]).toHaveLength(1);
  });

  it('disposes one subscription by its own name and listener reference, leaving the other registered', () => {
    const first = vi.fn<(payload: ConsentRecord) => void>();
    const second = vi.fn<(payload: ConsentRecord) => void>();

    const disposeFirst = bridge.api.on('consent:changed', first);
    bridge.api.on('consent:changed', second);

    const [firstName, firstListener] = onCall(0);
    const [, secondListener] = onCall(1);
    expect(firstListener).not.toBe(secondListener);

    disposeFirst();

    expect(electronState.removeListener).toHaveBeenCalledTimes(1);
    expect(electronState.removeListener).toHaveBeenCalledWith(firstName, firstListener);

    onCall(1)[1]({ sender: 'ipc' }, record);
    expect(second).toHaveBeenCalledWith(record);
  });

  it('throws nothing when the disposer runs a second time, repeating the same removeListener call', () => {
    const dispose = bridge.api.on('consent:changed', vi.fn());
    const [name, listener] = onCall(0);

    dispose();
    expect(() => {
      dispose();
    }).not.toThrow();

    expect(electronState.removeListener).toHaveBeenCalledTimes(2);
    expect(electronState.removeListener).toHaveBeenNthCalledWith(1, name, listener);
    expect(electronState.removeListener).toHaveBeenNthCalledWith(2, name, listener);
  });
});
