import { describe, expect, it, vi } from 'vitest';
import { buildAppEnv } from './env.js';
import {
  createBridgeInvokeHandler,
  createSenderWindowResolver,
  type BridgeSender,
} from './ipc-bridge-handler.js';
import type { SenderFrameLike, SenderWindow } from './ipc-sender-policy.js';

const MAIN_ID = 1;
const MINI_ID = 2;
const STRANGER_ID = 3;
const APP_URL = 'app://bundle/index.html';
const DEV_URL = 'http://127.0.0.1:4555';

const senderWindowOf = createSenderWindowResolver({
  main: () => ({ id: MAIN_ID }),
  mini: () => ({ id: MINI_ID }),
});

function senderOf(id: number): BridgeSender {
  return { id, mainFrame: { processId: 7, routingId: 1 } };
}

function frameAt(url: string, overrides: Partial<SenderFrameLike> = {}): SenderFrameLike {
  return { url, parent: null, detached: false, processId: 7, routingId: 1, ...overrides };
}

function harness(env: { isDev: boolean } = { isDev: false }) {
  const dispatch = vi.fn((channel: string, ...args: unknown[]) => ({ channel, args }));
  const log = { warn: vi.fn() };
  const gate = { admit: vi.fn((_window: SenderWindow) => true) };
  const handler = createBridgeInvokeHandler<BridgeSender>({
    env,
    devRendererUrl: DEV_URL,
    senderWindowOf,
    dispatch,
    log,
    rendererErrorGate: gate,
  });
  return { handler, dispatch, log, gate };
}

describe('createSenderWindowResolver', () => {
  it('maps each window to its role by webContents id, and anything else to null', () => {
    expect(senderWindowOf({ id: MAIN_ID })).toBe('main');
    expect(senderWindowOf({ id: MINI_ID })).toBe('mini-live');
    expect(senderWindowOf({ id: STRANGER_ID })).toBeNull();
  });

  it('knows no window that is not open', () => {
    const closed = createSenderWindowResolver({ main: () => null, mini: () => null });
    expect(closed({ id: MAIN_ID })).toBeNull();
    expect(closed({ id: MINI_ID })).toBeNull();
    expect(closed({ id: undefined as unknown as number })).toBeNull();
  });
});

describe('the bridge invoke handler', () => {
  it('dispatches a call from the main window frame and returns what dispatch returned', () => {
    const { handler, dispatch } = harness();
    const result = handler({ sender: senderOf(MAIN_ID), senderFrame: frameAt(APP_URL) }, 'window:minimize', 1, 'two');
    expect(result).toEqual({ channel: 'window:minimize', args: [1, 'two'] });
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('dispatches an allowlisted channel from the compact window and refuses any other', () => {
    const { handler, dispatch } = harness();
    const event = { sender: senderOf(MINI_ID), senderFrame: frameAt('app://bundle/mini-live/index.html') };
    expect(handler(event, 'settings:get')).toEqual({ channel: 'settings:get', args: [] });
    expect(() => handler(event, 'window:minimize')).toThrow('IPC sender not permitted');
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('refuses a window it does not own, for a channel the compact window may call and for one the main window may', () => {
    const { handler, dispatch } = harness();
    const event = { sender: senderOf(STRANGER_ID), senderFrame: frameAt(APP_URL) };
    expect(() => handler(event, 'settings:get')).toThrow('IPC sender not permitted');
    expect(() => handler(event, 'window:minimize')).toThrow('IPC sender not permitted');
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('refuses before dispatching, and logs the refusal without the arguments', () => {
    const { handler, dispatch, log } = harness();
    const event = { sender: senderOf(STRANGER_ID), senderFrame: frameAt('https://example.com/page?q=1') };
    expect(() => handler(event, 'settings:get', { token: 'hunter2' })).toThrow('IPC sender not permitted');
    expect(dispatch).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledTimes(1);
    const record = log.warn.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(record).toMatchObject({
      scope: 'main',
      event: 'ipc.sender_rejected',
      reason: 'unknown_window',
      origin: 'https://example.com',
      channel: 'settings:get',
    });
    expect(JSON.stringify(record)).not.toContain('hunter2');
  });

  it('refuses a null frame, a detached frame and a subframe from the main window', () => {
    const { handler, dispatch } = harness();
    const sender = senderOf(MAIN_ID);
    expect(() => handler({ sender, senderFrame: null }, 'app:ping')).toThrow('IPC sender not permitted');
    expect(() => handler({ sender, senderFrame: frameAt(APP_URL, { detached: true }) }, 'app:ping')).toThrow(
      'IPC sender not permitted',
    );
    expect(() => handler({ sender, senderFrame: frameAt(APP_URL, { parent: {} }) }, 'app:ping')).toThrow(
      'IPC sender not permitted',
    );
    expect(() => handler({ sender, senderFrame: frameAt(APP_URL, { routingId: 9 }) }, 'app:ping')).toThrow(
      'IPC sender not permitted',
    );
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('refuses when the sender main frame cannot be read', () => {
    const { handler, dispatch } = harness();
    const sender: BridgeSender = {
      id: MAIN_ID,
      get mainFrame(): never {
        throw new Error('destroyed');
      },
    };
    expect(() => handler({ sender, senderFrame: frameAt(APP_URL) }, 'app:ping')).toThrow('IPC sender not permitted');
    expect(dispatch).not.toHaveBeenCalled();
  });

  describe('the renderer error channel', () => {
    const miniEvent = { sender: senderOf(MINI_ID), senderFrame: frameAt('app://bundle/mini-live/index.html') };
    const mainEvent = { sender: senderOf(MAIN_ID), senderFrame: frameAt(APP_URL) };

    it('asks the gate about the window the call came from, then dispatches an admitted call from either window', () => {
      const { handler, dispatch, gate } = harness();
      expect(handler(mainEvent, 'log:rendererError', { message: 'a' })).toMatchObject({ channel: 'log:rendererError' });
      expect(handler(miniEvent, 'log:rendererError', { message: 'b' })).toMatchObject({ channel: 'log:rendererError' });
      expect(gate.admit.mock.calls).toEqual([['main'], ['mini-live']]);
      expect(dispatch).toHaveBeenCalledTimes(2);
    });

    it('answers null without dispatching a call the gate drops', () => {
      const { handler, dispatch, gate } = harness();
      gate.admit.mockReturnValue(false);
      expect(handler(miniEvent, 'log:rendererError', { message: 'a' })).toBeNull();
      expect(dispatch).not.toHaveBeenCalled();
    });

    it('does not spend the allowance on a refused sender, and consults the gate for no other channel', () => {
      const { handler, gate } = harness();
      const stranger = { sender: senderOf(STRANGER_ID), senderFrame: frameAt(APP_URL) };
      expect(() => handler(stranger, 'log:rendererError', {})).toThrow('IPC sender not permitted');
      handler(mainEvent, 'app:ping');
      expect(gate.admit).not.toHaveBeenCalled();
    });
  });

  describe('which environment may use the dev renderer origin', () => {
    const baseDeps = { rawFlavor: 'dev', bakedFlavor: null, appDataPath: 'C:\\appdata' } as const;
    const devEvent = { sender: senderOf(MAIN_ID), senderFrame: frameAt(`${DEV_URL}/`) };

    it('accepts it for an unpackaged run with a renderer URL override', () => {
      const env = buildAppEnv({ ...baseDeps, isPackaged: false, nodeEnv: undefined, rendererUrlOverride: DEV_URL });
      const { handler } = harness(env);
      expect(handler(devEvent, 'app:ping')).toMatchObject({ channel: 'app:ping' });
    });

    it('refuses it for a packaged run even with a renderer URL override and NODE_ENV development', () => {
      const env = buildAppEnv({
        ...baseDeps,
        rawFlavor: 'beta',
        bakedFlavor: 'beta',
        isPackaged: true,
        nodeEnv: 'development',
        rendererUrlOverride: DEV_URL,
      });
      expect(env.isDev).toBe(false);
      const { handler, dispatch } = harness(env);
      expect(() => handler(devEvent, 'app:ping')).toThrow('IPC sender not permitted');
      expect(dispatch).not.toHaveBeenCalled();
    });

    it('refuses it for an unpackaged production run with no override', () => {
      const env = buildAppEnv({ ...baseDeps, isPackaged: false, nodeEnv: 'production', rendererUrlOverride: undefined });
      const { handler } = harness(env);
      expect(() => handler(devEvent, 'app:ping')).toThrow('IPC sender not permitted');
    });
  });
});
