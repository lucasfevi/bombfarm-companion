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
    static isSupported = (): boolean => false;
    on(): void {}
    show(): void {}
  },
}));

vi.mock('./licence/licence-runner.js', () => ({
  createLicenceService: () => ({
    start: () => undefined,
    stop: () => undefined,
    view: () => null,
    trigger: () => undefined,
    pressMove: () => undefined,
    deviceGet: vi.fn(),
  }),
}));

import type { PremiumView } from '@bombfarm/contracts';
import { appPremiumTapFeedSlot } from '../live-source/premium-tap-feed.js';
import type { HostRunner } from './host/host-runner.js';
import type { PremiumHostWiringDeps } from './host/host-wiring.js';
import { createElectronPremium, createPremiumWhenEnabled, type ElectronPremiumDeps, type ElectronTrackingDeps } from './index.js';
import { appPlayingAccount } from './playing-account-gate.js';
import { createLogSink } from './premium-test-support.js';

let mainDir = '';

beforeEach(async () => {
  mainDir = await mkdtemp(join(tmpdir(), 'bfc-premium-track-'));
  await writeFile(join(mainDir, 'premium-shims.json'), JSON.stringify({ react: ['useState'] }));
  electron.fetch.mockReset();
  electron.fetch.mockResolvedValue(new Response(JSON.stringify({ visible: false }), { status: 200 }));
  electron.isEncryptionAvailable.mockReset();
  electron.encryptString.mockReset();
  electron.decryptString.mockReset();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(mainDir, { recursive: true, force: true });
});

function tracking(overrides: Partial<ElectronTrackingDeps> = {}): ElectronTrackingDeps {
  return {
    extensionPath: 'E:\\ext\\httpfs.duckdb_extension',
    gameSecrets: () => ['game-session-secret'],
    battleLog: { source: { stat: () => null, read: () => null, gameLanguage: () => null } },
    ...overrides,
  };
}

function deps(
  create: (parts: PremiumHostWiringDeps) => HostRunner,
  extra: Partial<ElectronPremiumDeps> = {},
  withTracking: ElectronTrackingDeps | null = tracking(),
): ElectronPremiumDeps {
  return {
    db: null,
    originOverride: null,
    offline: false,
    readGameIdentity: () => ({ accountId: '486', steamId64: '76561198012345678', playerName: 'Name' }),
    locale: () => 'en',
    log: createLogSink(),
    onChanged: (_view: PremiumView) => undefined,
    host: {
      userDataPath: 'C:\\data',
      mainDir,
      reloadWindow: () => undefined,
      uiOnAppScheme: true,
      create,
      ...(withTracking === null ? {} : { tracking: withTracking }),
    },
    ...extra,
  };
}

const fakeRunner = (extra: Partial<HostRunner> = {}): HostRunner =>
  ({ routes: { resolve: () => null }, view: () => ({ phase: 'none' }), subscribe: () => () => undefined, stop: () => undefined, start: () => Promise.resolve(), ...extra }) as unknown as HostRunner;

function capture(extra: Partial<ElectronPremiumDeps> = {}, withTracking?: ElectronTrackingDeps | null): PremiumHostWiringDeps {
  const parts: PremiumHostWiringDeps[] = [];
  createElectronPremium(
    deps(
      (wiring) => {
        parts.push(wiring);
        return fakeRunner();
      },
      extra,
      withTracking === undefined ? tracking() : withTracking,
    ),
  );
  return parts[0] as PremiumHostWiringDeps;
}

describe('what the app hands the host to build the tracking capabilities from', () => {
  it('passes the history rows, the extension, the game account and the battle log', () => {
    const parts = capture();
    const given = parts.capabilities?.tracking;

    expect(Object.keys(parts.capabilities ?? {}).sort()).toEqual(['notify', 'status', 'store', 'tracking']);
    expect(given?.extensionPath).toBe('E:\\ext\\httpfs.duckdb_extension');
    expect(given?.rows).toBe(parts.capabilities?.store.rows);
    expect(given?.accountKey()).toBe('486');
    expect(given?.battleLog.source.stat()).toBeNull();
  });

  it('hands over no tracking when the app gives none', () => {
    const parts = capture({}, null);

    expect(Object.keys(parts.capabilities ?? {}).sort()).toEqual(['notify', 'status', 'store']);
  });

  it('answers the account key from the game identity, null with none', () => {
    let identity: { accountId: string; steamId64: string | null; playerName: string | null } | null = null;
    const parts = capture({ readGameIdentity: () => identity });
    expect(parts.capabilities?.tracking?.accountKey()).toBeNull();

    identity = { accountId: '486', steamId64: null, playerName: null };
    expect(parts.capabilities?.tracking?.accountKey()).toBe('486');
  });

  it('answers whether the playing account is the licensed one from the app gate', () => {
    const parts = capture();
    const allows = vi.spyOn(appPlayingAccount, 'allows');

    allows.mockReturnValue(false);
    expect(parts.capabilities?.tracking?.playingAccountAllows()).toBe(false);
    allows.mockReturnValue(true);
    expect(parts.capabilities?.tracking?.playingAccountAllows()).toBe(true);
  });

  it('withholds the game credential and the SteamID, and not the account id', () => {
    const secrets = capture().capabilities?.tracking?.secrets();

    expect(secrets?.has('game-session-secret')).toBe(true);
    expect(secrets?.has('76561198012345678')).toBe(true);
    expect(secrets?.has('486')).toBe(false);
  });

  it('withholds the Premium sign-in token too', () => {
    electron.isEncryptionAvailable.mockReturnValue(true);
    electron.decryptString.mockReturnValue(
      JSON.stringify({ token: 'signin-token-0f3a', expiresAt: '2027-01-01T00:00:00.000Z', rotateAfter: '2026-12-01T00:00:00.000Z' }),
    );
    const db = {
      exec: () => undefined,
      close: () => undefined,
      prepare: () => ({ get: () => ({ value: Buffer.from('sealed').toString('base64') }), run: () => ({ changes: 0 }), all: () => [] }),
    };

    const secrets = capture({ db: db as unknown as ElectronPremiumDeps['db'] }).capabilities?.tracking?.secrets();

    expect(secrets?.has('signin-token-0f3a')).toBe(true);
    expect(secrets?.has('game-session-secret')).toBe(true);
  });
});

describe('the engine probe and the Settings history through the service', () => {
  function build(runner: Partial<HostRunner>) {
    return createElectronPremium(deps(() => fakeRunner(runner)));
  }

  it('starts the probe when the service starts, once, and not before', () => {
    const armTrackingProbe = vi.fn();
    const service = build({ armTrackingProbe });
    expect(armTrackingProbe).not.toHaveBeenCalled();

    service.start();
    service.stop();

    expect(armTrackingProbe).toHaveBeenCalledTimes(1);
  });

  it('answers no history and refuses a clear while nobody is signed in', async () => {
    const trackingHistory = vi.fn();
    const clearTrackingHistory = vi.fn();
    const service = build({ trackingHistory, clearTrackingHistory });

    expect(service.trackingHistory()).toBeNull();
    await expect(service.clearTrackingHistory()).resolves.toBeNull();
    expect(trackingHistory).not.toHaveBeenCalled();
    expect(clearTrackingHistory).not.toHaveBeenCalled();
  });

  it('answers nothing when the app built no host', async () => {
    const { host: _host, ...withoutHost } = deps(() => ({}) as HostRunner);
    const service = createElectronPremium(withoutHost);

    expect(service.trackingHistory()).toBeNull();
    await expect(service.clearTrackingHistory()).resolves.toBeNull();
  });
});

describe('a flavour without Premium', () => {
  it('builds no host, so no engine probe, no feed and no battle-log read', () => {
    const create = vi.fn();
    const gameSecrets = vi.fn(() => []);
    const stat = vi.fn(() => null);
    const read = vi.fn(() => null);
    const armed = vi.spyOn(appPremiumTapFeedSlot, 'set');

    const result = createPremiumWhenEnabled(
      false,
      deps(create, {}, tracking({ gameSecrets, battleLog: { source: { stat, read, gameLanguage: () => null } } })),
    );

    expect(result).toBeNull();
    expect(create).not.toHaveBeenCalled();
    expect(gameSecrets).not.toHaveBeenCalled();
    expect(stat).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
    expect(armed).not.toHaveBeenCalled();
  });
});
