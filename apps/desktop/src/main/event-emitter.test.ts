import { relative, resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  idleUpdateStatus,
  IPC_EVENT_CHANNELS,
  IPC_EVENT_PREFIX,
  ipcEventName,
  type IpcEventChannel,
} from '@bombfarm/contracts';

import { createEventEmitter } from './event-emitter.js';
import { guardScanner } from './guard-scan.js';
import type { EventWindow } from './shell/broadcast-event.js';
import '../preload/index.js';

interface PreloadBridge {
  on: (channel: IpcEventChannel, handler: (payload: never) => void) => () => void;
}

function preloadBridge(): PreloadBridge {
  const call = electronState.exposeInMainWorld.mock.calls[0];
  if (!call) {
    throw new Error('preload never called contextBridge.exposeInMainWorld');
  }
  return call[1] as PreloadBridge;
}

function fakeWindow(): EventWindow & { sent: [string, unknown][] } {
  const sent: [string, unknown][] = [];
  return {
    sent,
    isDestroyed: () => false,
    webContents: {
      send: (channel, payload) => {
        sent.push([channel, payload]);
      },
    },
  };
}

/** The emitter is generic per channel; a sweep over the whole channel list is not. */
function emitOn(emit: ReturnType<typeof createEventEmitter>, channel: IpcEventChannel): void {
  (emit as unknown as (channel: string, payload: unknown) => void)(channel, { swept: true });
}

function nameMainSendsTo(channel: IpcEventChannel): string {
  const window = fakeWindow();
  emitOn(createEventEmitter({ getWindows: () => [window] }), channel);
  const first = window.sent[0];
  if (!first) {
    throw new Error(`the emitter sent nothing for ${channel}`);
  }
  return first[0];
}

function namePreloadRegisters(channel: IpcEventChannel): string {
  electronState.on.mockClear();
  preloadBridge().on(channel, vi.fn());
  const call = electronState.on.mock.calls[0];
  if (!call) {
    throw new Error(`preload registered nothing for ${channel}`);
  }
  return call[0];
}

beforeEach(() => {
  electronState.on.mockClear();
  electronState.removeListener.mockClear();
});

describe('createEventEmitter', () => {
  it('sends on the prefixed name contracts composes, not a hand-built one', () => {
    const window = fakeWindow();
    const emit = createEventEmitter({ getWindows: () => [window] });
    const status = idleUpdateStatus('1.2.3', 'beta');

    emit('updates:changed', status);

    expect(window.sent).toEqual([[ipcEventName('updates:changed'), status]]);
  });

  it('reaches every live window and skips a destroyed one', () => {
    const living = fakeWindow();
    const second = fakeWindow();
    const destroyed = { ...fakeWindow(), isDestroyed: () => true, sent: [] as [string, unknown][] };
    const emit = createEventEmitter({ getWindows: () => [living, destroyed, second] });

    emit('window:changed', { maximized: true });

    expect(living.sent).toHaveLength(1);
    expect(second.sent).toHaveLength(1);
    expect(destroyed.sent).toHaveLength(0);
  });

  it('asks for the window list on every emit, so a window opened after boot still receives', () => {
    const first = fakeWindow();
    const windows: EventWindow[] = [first];
    const emit = createEventEmitter({ getWindows: () => windows });

    emit('window:changed', { maximized: false });
    const late = fakeWindow();
    windows.push(late);
    emit('window:changed', { maximized: true });

    expect(first.sent).toHaveLength(2);
    expect(late.sent).toHaveLength(1);
  });
});

describe('main and preload compose the same wire name', () => {
  it('agrees on the name for every event channel the contract declares', () => {
    const disagreements = IPC_EVENT_CHANNELS.filter(
      (channel) => nameMainSendsTo(channel) !== namePreloadRegisters(channel),
    );

    expect(disagreements).toEqual([]);
  });

  it('agrees with the contract itself, so neither host is free to drift on its own', () => {
    const drifted = IPC_EVENT_CHANNELS.filter(
      (channel) => nameMainSendsTo(channel) !== ipcEventName(channel),
    );

    expect(drifted).toEqual([]);
  });

  it('is spelled in no shipped main or preload source, only in the contract that owns it', () => {
    const { readAll } = guardScanner(__filename);
    const sources = [
      ...readAll(__dirname, ['.ts']),
      ...readAll(resolve(__dirname, '..', 'preload'), ['.ts']),
    ];
    const offenders = sources
      .filter((entry) => entry.source.includes(IPC_EVENT_PREFIX))
      .map((entry) => relative(resolve(__dirname, '..'), entry.path));

    expect(sources.length).toBeGreaterThanOrEqual(80);
    expect(offenders).toEqual([]);
  });
});
