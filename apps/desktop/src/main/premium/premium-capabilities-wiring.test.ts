import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const electron = vi.hoisted(() => ({
  fetch: vi.fn(),
  isEncryptionAvailable: vi.fn(),
  encryptString: vi.fn(),
  decryptString: vi.fn(),
  openExternal: vi.fn(),
  shown: [] as { title: string; body: string; silent: boolean }[],
  supported: true,
}));

const licence = vi.hoisted(() => ({
  deps: null as null | Record<string, unknown>,
}));

vi.mock('electron', () => ({
  net: { fetch: electron.fetch },
  safeStorage: {
    isEncryptionAvailable: electron.isEncryptionAvailable,
    encryptString: electron.encryptString,
    decryptString: electron.decryptString,
  },
  shell: { openExternal: electron.openExternal },
  Notification: class {
    static isSupported = (): boolean => electron.supported;
    private readonly options: { title: string; body: string; silent: boolean };
    private click: (() => void) | null = null;
    constructor(options: { title: string; body: string; silent: boolean }) {
      this.options = options;
    }
    on(_event: 'click', listener: () => void): void {
      this.click = listener;
    }
    show(): void {
      electron.shown.push(this.options);
      this.click?.();
    }
  },
}));

// The licence service is replaced by a recorder: this file is about what the app wires around it.
vi.mock('./licence/licence-runner.js', () => ({
  createLicenceService: (deps: Record<string, unknown>) => {
    licence.deps = deps;
    return {
      start: () => undefined,
      stop: () => undefined,
      view: () => null,
      trigger: () => undefined,
      pressMove: () => undefined,
      deviceGet: vi.fn(),
    };
  },
}));

import type { PremiumView } from '@bombfarm/contracts';
import type { HostRunner } from './host/host-runner.js';
import type { PremiumHostWiringDeps } from './host/host-wiring.js';
import { createElectronPremium, createPremiumWhenEnabled, type ElectronPremiumDeps } from './index.js';
import { appPlayingAccount } from './playing-account-gate.js';
import { createLogSink } from './premium-test-support.js';

let mainDir = '';

beforeEach(async () => {
  mainDir = await mkdtemp(join(tmpdir(), 'bfc-premium-caps-'));
  await writeFile(join(mainDir, 'premium-shims.json'), JSON.stringify({ react: ['useState'] }));
  licence.deps = null;
  electron.shown.length = 0;
  electron.supported = true;
  electron.fetch.mockReset();
  electron.fetch.mockResolvedValue(new Response(JSON.stringify({ visible: false }), { status: 200 }));
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(mainDir, { recursive: true, force: true });
});

function deps(openPremiumTab: () => void, create: (parts: PremiumHostWiringDeps) => HostRunner): ElectronPremiumDeps {
  return {
    db: null,
    originOverride: null,
    offline: false,
    readGameIdentity: () => null,
    locale: () => 'en',
    log: createLogSink(),
    onChanged: (_view: PremiumView) => undefined,
    host: { userDataPath: 'C:\\data', mainDir, reloadWindow: () => undefined, uiOnAppScheme: true, openPremiumTab, create },
  };
}

function capture(openPremiumTab: () => void = () => undefined): PremiumHostWiringDeps {
  const parts: PremiumHostWiringDeps[] = [];
  createElectronPremium(
    deps(openPremiumTab, (wiring) => {
      parts.push(wiring);
      return { routes: { resolve: () => null }, view: () => ({ phase: 'none' }) } as unknown as HostRunner;
    }),
  );
  return parts[0] as PremiumHostWiringDeps;
}

describe('what the app hands the host to build the capabilities from', () => {
  it('passes the status, store and notify parts and the playing-account check', () => {
    const parts = capture();

    expect(Object.keys(parts.capabilities ?? {}).sort()).toEqual(['notify', 'status', 'store']);
    expect(parts.playingAccountAllows).toBeTypeOf('function');
  });

  it('answers the status parts from the Premium service, empty before any answer', () => {
    const parts = capture();

    expect(parts.capabilities?.status.premiumStatus()).toBeNull();
    expect(parts.capabilities?.status.audience()).toBeNull();
  });

  it('answers whether the playing account is the signed-in user from the app gate', () => {
    const parts = capture();
    const allows = vi.spyOn(appPlayingAccount, 'allows');

    allows.mockReturnValue(false);
    expect(parts.playingAccountAllows?.()).toBe(false);
    allows.mockReturnValue(true);
    expect(parts.playingAccountAllows?.()).toBe(true);
  });

  it('reads the store subject from the service, null while signed out', () => {
    expect(capture().capabilities?.store.subject()).toBeNull();
  });

  it('shows a system toast, and a click on it opens the Premium tab', () => {
    const open = vi.fn();
    const parts = capture(open);
    const notify = parts.capabilities?.notify;

    const outcome = notify?.show({ title: 'T', body: 'B', onClick: () => { notify.openPremiumTab(); } });

    expect(outcome).toBe('shown');
    expect(electron.shown).toEqual([{ title: 'T', body: 'B', silent: false }]);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('says unavailable when the system cannot show a toast', () => {
    electron.supported = false;
    const notify = capture().capabilities?.notify;
    expect(notify?.show({ title: 'T', body: 'B', onClick: () => undefined })).toBe('unavailable');
  });

  it('shows nothing while wiring', () => {
    capture();
    expect(electron.shown).toEqual([]);
  });
});

describe('a flavour without Premium', () => {
  it('builds no service, so no handler, no notifier and nothing to emit', () => {
    const create = vi.fn();
    const open = vi.fn();

    expect(createPremiumWhenEnabled(false, deps(open, create))).toBeNull();
    expect(create).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    expect(electron.shown).toEqual([]);
  });
});

describe('a capability call from the Premium screen through the service', () => {
  it('reaches the host', async () => {
    const callFromUi = vi.fn(() => Promise.resolve({ id: 0, ok: true as const, value: 1 }));
    const service = createElectronPremium(
      deps(
        () => undefined,
        () => ({ routes: { resolve: () => null }, callFromUi, view: () => ({ phase: 'running' }) }) as unknown as HostRunner,
      ),
    );

    await expect(service.callFromUi({ id: 0, capability: 'store', args: null })).resolves.toEqual({
      id: 0,
      ok: true,
      value: 1,
    });
    expect(callFromUi).toHaveBeenCalledWith({ id: 0, capability: 'store', args: null });
  });

  it('answers unavailable when the app built no host', async () => {
    const { host: _host, ...withoutHost } = deps(
      () => undefined,
      () => ({}) as HostRunner,
    );
    const service = createElectronPremium(withoutHost);

    await expect(service.callFromUi({ id: 0, capability: 'store', args: null })).resolves.toEqual({
      id: 0,
      ok: false,
      error: 'unavailable',
    });
  });
});
