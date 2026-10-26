import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { Session, WebContents } from 'electron';
import { createIpcSenderPolicy } from './ipc-sender-policy.js';
import {
  GRANTED_PERMISSIONS,
  applySessionPermissionPolicy,
  cancelBluetoothSelection,
  decidePermission,
} from './session-permissions.js';
import type { LogPort } from './storage/index.js';

const PACKAGED = createIpcSenderPolicy({ isDev: false, devRendererUrl: 'http://127.0.0.1:3000' }).trustedOrigins;
const DEV = createIpcSenderPolicy({ isDev: true, devRendererUrl: 'http://127.0.0.1:3000' }).trustedOrigins;

const APP_URL = 'app://bundle/index.html';

const EVERY_BROWSER_PERMISSION = [
  'clipboard-read',
  'clipboard-sanitized-write',
  'deprecated-sync-clipboard-read',
  'display-capture',
  'fullscreen',
  'geolocation',
  'idle-detection',
  'media',
  'mediaKeySystem',
  'midi',
  'midiSysex',
  'notifications',
  'openExternal',
  'pointerLock',
  'keyboardLock',
  'speaker-selection',
  'storage-access',
  'top-level-storage-access',
  'window-management',
  'unknown',
  'fileSystem',
  'hid',
  'serial',
  'usb',
  'bluetooth',
];

describe('decidePermission', () => {
  it.each(EVERY_BROWSER_PERMISSION.filter((permission) => !GRANTED_PERMISSIONS.has(permission)))(
    'refuses %s from the app origin',
    (permission) => {
      expect(decidePermission({ permission, requestingUrl: APP_URL, isMainFrame: true }, PACKAGED)).toBe(false);
    },
  );

  it.each([...GRANTED_PERMISSIONS])('grants %s to the app origin only', (permission) => {
    expect(decidePermission({ permission, requestingUrl: APP_URL, isMainFrame: true }, PACKAGED)).toBe(true);
    expect(decidePermission({ permission, requestingUrl: 'app://bundle', isMainFrame: true }, PACKAGED)).toBe(true);
    for (const foreign of [
      'https://example.com/',
      'app://bundle.evil/',
      'app://bundle@evil/',
      'app://other/',
      'http://127.0.0.1:3000/',
      'data:text/html,x',
      'about:blank',
      'null',
      '',
    ]) {
      expect(decidePermission({ permission, requestingUrl: foreign, isMainFrame: true }, PACKAGED), foreign).toBe(false);
    }
  });

  it.each([...GRANTED_PERMISSIONS])('refuses %s from a subframe', (permission) => {
    expect(decidePermission({ permission, requestingUrl: APP_URL, isMainFrame: false }, PACKAGED)).toBe(false);
  });

  it.each([...GRANTED_PERMISSIONS])('grants %s to the dev renderer origin only in a dev run', (permission) => {
    const dev = { permission, requestingUrl: 'http://127.0.0.1:3000/', isMainFrame: true };
    expect(decidePermission(dev, DEV)).toBe(true);
    expect(decidePermission(dev, PACKAGED)).toBe(false);
  });
});

function createLogSpy(): LogPort & { records: Record<string, unknown>[] } {
  const records: Record<string, unknown>[] = [];
  return {
    records,
    info: (record) => records.push(record),
    warn: (record) => records.push(record),
    error: (record) => records.push(record),
  };
}

type Listener = (...args: never[]) => void;

function createSessionSpy() {
  const state = {
    request: null as ((...args: unknown[]) => void) | null,
    check: null as ((...args: unknown[]) => boolean) | null,
    device: null as (() => boolean) | null,
    pairing: null as ((...args: unknown[]) => void) | null,
    listeners: new Map<string, Listener>(),
  };
  const session = {
    setPermissionRequestHandler: (handler: (...args: unknown[]) => void) => {
      state.request = handler;
    },
    setPermissionCheckHandler: (handler: (...args: unknown[]) => boolean) => {
      state.check = handler;
    },
    setDevicePermissionHandler: (handler: () => boolean) => {
      state.device = handler;
    },
    setBluetoothPairingHandler: (handler: (...args: unknown[]) => void) => {
      state.pairing = handler;
    },
    on: (event: string, listener: Listener) => {
      state.listeners.set(event, listener);
    },
  };
  return { session: session as unknown as Session, state };
}

function requestThrough(
  state: ReturnType<typeof createSessionSpy>['state'],
  permission: string,
  requestingUrl: string,
): boolean {
  const callback = vi.fn<(granted: boolean) => void>();
  state.request?.(null, permission, callback, { requestingUrl, isMainFrame: true });
  expect(callback).toHaveBeenCalledTimes(1);
  return callback.mock.calls[0]?.[0] ?? false;
}

describe('applySessionPermissionPolicy', () => {
  it('answers every request and every check through the one decision, and logs a refusal', () => {
    const { session, state } = createSessionSpy();
    const log = createLogSpy();
    applySessionPermissionPolicy(session, { trustedOrigins: PACKAGED, log });

    for (const permission of EVERY_BROWSER_PERMISSION) {
      const expected = GRANTED_PERMISSIONS.has(permission);
      expect(requestThrough(state, permission, APP_URL), `request ${permission}`).toBe(expected);
      expect(state.check?.(null, permission, 'app://bundle', { isMainFrame: true }), `check ${permission}`).toBe(expected);
    }

    expect(requestThrough(state, 'notifications', 'https://example.com/')).toBe(false);
    expect(log.records).toContainEqual(
      expect.objectContaining({ event: 'permission.denied', via: 'request', permission: 'notifications', origin: 'https://example.com' }),
    );
    expect(log.records).toContainEqual(
      expect.objectContaining({ event: 'permission.denied', via: 'check', permission: 'notifications', origin: 'app://bundle' }),
    );
  });

  it('refuses a check whose requesting origin is opaque or empty', () => {
    const { session, state } = createSessionSpy();
    applySessionPermissionPolicy(session, { trustedOrigins: PACKAGED, log: createLogSpy() });

    for (const permission of EVERY_BROWSER_PERMISSION) {
      expect(state.check?.(null, permission, 'null', { isMainFrame: true })).toBe(false);
      expect(state.check?.(null, permission, '', { isMainFrame: true })).toBe(false);
    }
  });

  it('denies device access and cancels every device selection', () => {
    const { session, state } = createSessionSpy();
    applySessionPermissionPolicy(session, { trustedOrigins: PACKAGED, log: createLogSpy() });

    expect(state.device?.()).toBe(false);
    const pairing = vi.fn<(response: { confirmed: boolean }) => void>();
    state.pairing?.({}, pairing);
    expect(pairing).toHaveBeenCalledWith({ confirmed: false });

    const hid = vi.fn<(deviceId?: string | null) => void>();
    const hidEvent = { preventDefault: vi.fn() };
    (state.listeners.get('select-hid-device') as unknown as (...args: unknown[]) => void)(hidEvent, {}, hid);
    expect(hidEvent.preventDefault).toHaveBeenCalled();
    expect(hid).toHaveBeenCalledWith(null);

    const usb = vi.fn<(deviceId?: string) => void>();
    const usbEvent = { preventDefault: vi.fn() };
    (state.listeners.get('select-usb-device') as unknown as (...args: unknown[]) => void)(usbEvent, {}, usb);
    expect(usbEvent.preventDefault).toHaveBeenCalled();
    expect(usb).toHaveBeenCalledWith();

    const serial = vi.fn<(portId: string) => void>();
    const serialEvent = { preventDefault: vi.fn() };
    (state.listeners.get('select-serial-port') as unknown as (...args: unknown[]) => void)(serialEvent, [], {}, serial);
    expect(serialEvent.preventDefault).toHaveBeenCalled();
    expect(serial).toHaveBeenCalledWith('');
  });
});

describe('cancelBluetoothSelection', () => {
  it('cancels a Bluetooth device selection instead of letting the first device be picked', () => {
    let listener: ((...args: unknown[]) => void) | null = null;
    const contents = {
      on: (event: string, handler: (...args: unknown[]) => void) => {
        if (event === 'select-bluetooth-device') listener = handler;
      },
    };
    cancelBluetoothSelection(contents as unknown as WebContents);

    const callback = vi.fn<(deviceId: string) => void>();
    const event = { preventDefault: vi.fn() };
    (listener as unknown as (...args: unknown[]) => void)(event, [{ deviceId: 'a' }], callback);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith('');
  });
});

describe('boot wiring', () => {
  const bootSource = readFileSync(resolve(__dirname, 'index.ts'), 'utf8');

  it('applies the permission policy to the default session every window uses, before a window exists', () => {
    const policy = bootSource.indexOf('applySessionPermissionPolicy(session.defaultSession');
    expect(policy).toBeGreaterThan(-1);
    expect(bootSource.match(/applySessionPermissionPolicy\(/g)).toHaveLength(1);
    expect(policy).toBeLessThan(bootSource.indexOf('await createMainWindow()'));
  });

  it('cancels Bluetooth selection on every web contents created', () => {
    expect(bootSource).toMatch(/app\.on\('web-contents-created',[^]*cancelBluetoothSelection\(contents\)/);
  });

  it('keeps every window on the default session, so the one policy covers them all', () => {
    for (const file of ['index.ts', 'mini-live-window.ts', 'web-preferences.ts']) {
      expect(readFileSync(resolve(__dirname, file), 'utf8'), file).not.toMatch(/partition/i);
    }
  });
});
