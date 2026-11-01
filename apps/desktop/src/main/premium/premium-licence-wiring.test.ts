import type { PremiumLicenceView } from '@bombfarm/contracts';
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
}));

interface RunnerSpy {
  made: number;
  calls: string[];
  view: PremiumLicenceView;
  onChanged: Array<(view: unknown) => void>;
}

const runner = vi.hoisted(
  (): RunnerSpy => ({
    made: 0,
    calls: [],
    view: { state: 'holds', moveInFlight: false, moveFailed: false, removalDone: false },
    onChanged: [],
  }),
);

vi.mock('./licence/licence-runner.js', () => ({
  createLicenceService: vi.fn((deps: { enabled: boolean; onChanged: (view: unknown) => void }) => {
    runner.made += 1;
    runner.onChanged.push(deps.onChanged);
    return {
      start: () => runner.calls.push('start'),
      stop: () => runner.calls.push('stop'),
      view: () => runner.view,
      pressMove: () => runner.calls.push('pressMove'),
      trigger: (why: string) => runner.calls.push(`trigger:${why}`),
      noteFolderGone: () => runner.calls.push('noteFolderGone'),
    };
  }),
}));

import { FLAVORS, signedOutPremiumView, type PremiumView } from '@bombfarm/contracts';
import { createPremiumWhenEnabled, type ElectronPremium, type ElectronPremiumDeps } from './index.js';
import { premiumLeaseAllows } from './licence/lease-gate.js';
import { settle } from './premium-test-support.js';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

function deps(overrides: Partial<ElectronPremiumDeps> = {}) {
  const views: PremiumView[] = [];
  const built: ElectronPremiumDeps = {
    db: null,
    originOverride: 'http://127.0.0.1:4555',
    offline: false,
    readGameIdentity: vi.fn(() => null),
    locale: () => 'en',
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    onChanged: (view) => {
      views.push(view);
    },
    ...overrides,
  };
  return { built, views };
}

function enabledService(built: ElectronPremiumDeps): ElectronPremium {
  const service = createPremiumWhenEnabled(true, built);
  if (service === null) throw new Error('the service was not built');
  return service;
}

beforeEach(() => {
  electron.fetch.mockReset();
  electron.fetch.mockImplementation(() => Promise.resolve(json(200, { visible: false })));
  electron.encryptString.mockReset();
  runner.made = 0;
  runner.calls.length = 0;
  runner.onChanged.length = 0;
  runner.view = { state: 'holds', moveInFlight: false, moveFailed: false, removalDone: false };
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the licence service per flavor', () => {
  it.each(['beta', 'prod'] as const)(
    'is not built in the %s flavor: no key, no request, a closed gate, and a signed-out view without a licence',
    (flavor) => {
      const { built } = deps();

      const service = createPremiumWhenEnabled(FLAVORS[flavor].premium, built);

      expect(service).toBeNull();
      expect(runner.made).toBe(0);
      expect(electron.fetch).not.toHaveBeenCalled();
      expect(electron.encryptString).not.toHaveBeenCalled();
      expect(premiumLeaseAllows()).toBe(false);
      expect(signedOutPremiumView.licence).toBeNull();
    },
  );

  it('is built in the dev flavor and its view rides on the Premium view', () => {
    const { built } = deps();

    const service = createPremiumWhenEnabled(FLAVORS.dev.premium, built);

    expect(runner.made).toBe(1);
    expect(service?.getView().licence).toBe(runner.view);
  });
});

describe('starting and stopping', () => {
  it('starts the licence service after the Premium service, and stops it with it', () => {
    const { built } = deps();
    const service = enabledService(built);

    service.start();
    expect(runner.calls).toEqual(['start']);
    expect(electron.fetch).toHaveBeenCalled();
    service.stop();

    expect(runner.calls).toEqual(['start', 'stop']);
  });

  it('attaches the resume listener on start, sends a resume trigger on wake, and detaches on stop', () => {
    let wake: () => void = () => undefined;
    const off = vi.fn();
    const onResume = vi.fn((listener: () => void) => {
      wake = listener;
      return off;
    });
    const { built } = deps({ onResume });
    const service = enabledService(built);

    service.start();
    wake();
    expect(runner.calls).toEqual(['start', 'trigger:resume']);
    service.stop();

    expect(onResume).toHaveBeenCalledTimes(1);
    expect(off).toHaveBeenCalledTimes(1);
  });

  it('publishes the Premium view again, carrying the licence view, when the licence changes', async () => {
    const { built, views } = deps();
    const service = enabledService(built);
    service.start();
    await settle();
    const before = views.length;

    runner.view = { state: 'elsewhere', holderName: 'OTHER-PC', moveInFlight: false, moveFailed: false, removalDone: false };
    runner.onChanged.at(-1)?.(runner.view);

    expect(views.length).toBe(before + 1);
    expect(views.at(-1)?.licence).toEqual(runner.view);
    service.stop();
  });
});

describe('Refresh and the press of "use Premium here"', () => {
  it('forwards a Refresh button press as one refresh trigger', async () => {
    const { built } = deps();
    const service = enabledService(built);
    service.start();

    await service.refresh('button');

    expect(runner.calls).toEqual(['start', 'trigger:refresh']);
    service.stop();
  });

  it('sends no trigger for a refresh the tab makes on opening', async () => {
    const { built } = deps();
    const service = enabledService(built);
    service.start();
    await settle();

    await service.refresh('open');

    expect(runner.calls).toEqual(['start']);
    service.stop();
  });

  it('sends no refresh trigger for a Refresh the service refuses inside its 30 second floor', async () => {
    const { built } = deps();
    const service = enabledService(built);
    service.start();
    await settle();
    await service.refresh('button');
    runner.calls.length = 0;

    const second = await service.refresh('button');

    expect(second).toEqual({ ok: false, reason: 'too-soon' });
    expect(runner.calls).toEqual([]);
    service.stop();
  });

  it('presses Move through useHere and answers ok', () => {
    const { built } = deps();
    const service = enabledService(built);

    expect(service.useHere()).toEqual({ ok: true });

    expect(runner.calls).toEqual(['pressMove']);
  });
});
