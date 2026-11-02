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

const licence = vi.hoisted(() => ({
  order: [] as string[],
  deps: null as null | Record<string, unknown>,
  deviceGet: vi.fn(),
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

// The licence service is replaced by a recorder: this file is about what the app wires around it.
vi.mock('./licence/licence-runner.js', () => ({
  createLicenceService: (deps: Record<string, unknown>) => {
    licence.deps = deps;
    return {
      start: () => licence.order.push('licence.start'),
      stop: () => licence.order.push('licence.stop'),
      view: () => null,
      trigger: () => undefined,
      pressMove: () => undefined,
      deviceGet: licence.deviceGet,
    };
  },
}));

import type { PremiumHostView, PremiumView } from '@bombfarm/contracts';
import { createDefaultRemovalPort } from './licence/removal-port.js';
import type { HostRunner } from './host/host-runner.js';
import type { PremiumHostWiringDeps } from './host/host-wiring.js';
import {
  createElectronPremium,
  createPremiumWhenEnabled,
  premiumBuildMismatch,
  type ElectronPremiumDeps,
} from './index.js';
import { createLogSink, settle } from './premium-test-support.js';

const RUNNING: PremiumHostView = {
  phase: 'running',
  uiUrl: 'app://bundle/_premium/4/ui/index.js',
  styleUrl: null,
  localBuild: false,
};

function fakeHost() {
  let view: PremiumHostView = RUNNING;
  let listener: (() => void) | null = null;
  const calls: string[] = [];
  const runner = {
    start: (subject: string | null) => {
      calls.push(`start:${String(subject)}`);
      licence.order.push('host.start');
      return Promise.resolve();
    },
    stop: () => {
      licence.order.push('host.stop');
    },
    signedOut: () => undefined,
    mountFailed: () => {
      calls.push('mountFailed');
    },
    view: () => view,
    routes: { resolve: () => null },
    subscribe: (next: () => void) => {
      listener = next;
      return () => {
        listener = null;
      };
    },
    requestPremiumRemoval: () => undefined,
    runningSequence: () => null,
    noteLatestSequence: () => undefined,
    noteLeaseFloor: () => undefined,
    attach: () => undefined,
    idle: () => Promise.resolve(),
  } as unknown as HostRunner;
  return {
    runner,
    calls,
    change(next: PremiumHostView) {
      view = next;
      listener?.();
    },
  };
}

let mainDir = '';
let records: ReturnType<typeof createLogSink>;

beforeEach(async () => {
  mainDir = await mkdtemp(join(tmpdir(), 'bfc-premium-main-'));
  await writeFile(join(mainDir, 'premium-shims.json'), JSON.stringify({ react: ['useState'] }));
  records = createLogSink();
  licence.order.length = 0;
  licence.deps = null;
  licence.deviceGet.mockReset();
  electron.fetch.mockReset();
  electron.fetch.mockResolvedValue(new Response(JSON.stringify({ visible: false }), { status: 200 }));
});

afterEach(async () => {
  await rm(mainDir, { recursive: true, force: true });
});

function build(extra: Partial<ElectronPremiumDeps> = {}, withHost = true) {
  const views: PremiumView[] = [];
  const parts: PremiumHostWiringDeps[] = [];
  const host = fakeHost();
  const service = createElectronPremium({
    db: null,
    originOverride: null,
    offline: false,
    readGameIdentity: () => null,
    locale: () => 'en',
    log: records,
    onChanged: (view) => {
      views.push(view);
    },
    ...(withHost
      ? {
          host: {
            userDataPath: 'C:\\data',
            mainDir,
            reloadWindow: () => undefined,
            uiOnAppScheme: true,
            create: (wiring: PremiumHostWiringDeps) => {
              parts.push(wiring);
              return host.runner;
            },
          },
        }
      : {}),
    ...extra,
  });
  return { service, views, parts, host };
}

describe('the host is the licence service removal port', () => {
  it('is built from the app parts and handed to the licence service in place of the default port', () => {
    const { parts, host } = build({ appVersion: '2.3.4', flavor: 'dev' });

    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({ flavor: 'dev', appVersion: '2.3.4', userDataPath: 'C:\\data' });
    expect(parts[0]?.shims).toEqual({ react: ['useState'] });
    expect(parts[0]?.loaderPath).toBe(join(mainDir, 'premium-worker.cjs'));
    expect(licence.deps?.['removal']).toBe(host.runner);
  });

  it('keeps the default port when the app gives no host parts', () => {
    const { service } = build({}, false);

    expect(licence.deps?.['removal']).toBeDefined();
    expect(Object.keys(licence.deps?.['removal'] as object).sort()).toEqual(
      Object.keys(createDefaultRemovalPort()).sort(),
    );
    expect(service.routes).toBeNull();
  });

  it('builds no host and keeps the default port when the shim names cannot be read', async () => {
    await rm(join(mainDir, 'premium-shims.json'));
    const { parts, service } = build();

    expect(parts).toHaveLength(0);
    expect(service.routes).toBeNull();
    expect(records.events()).toContain('premium.host_unavailable');
  });

  it('gives the host the licence service signed GET', async () => {
    const { parts } = build();
    licence.deviceGet.mockResolvedValue({ ok: false, reason: 'gate_closed' });
    const request = { route: { r: 'bundle' }, maxBytes: 10, signal: new AbortController().signal };

    const answer = await parts[0]?.deviceGet(request as never);

    expect(licence.deviceGet).toHaveBeenCalledWith(request);
    expect(answer).toEqual({ ok: false, reason: 'gate_closed' });
  });
});

describe('when the host starts and stops', () => {
  it('starts it after the licence service, for the account signed in, and stops it before', () => {
    const { service, host } = build();

    service.start();
    service.stop();

    expect(licence.order).toEqual(['licence.start', 'host.start', 'host.stop', 'licence.stop']);
    expect(host.calls).toEqual(['start:null']);
  });
});

describe('what the Premium tab learns', () => {
  it('carries the host line in the view and publishes it again when the host changes', async () => {
    const { service, views, host } = build();
    expect(service.getView().host).toEqual(RUNNING);

    service.start();
    await settle();
    views.length = 0;
    host.change({ phase: 'paused', uiUrl: null, styleUrl: null, localBuild: false });
    await settle();
    service.stop();

    expect(views.at(-1)?.host?.phase).toBe('paused');
  });

  it('carries no host line when there is no host', () => {
    const { service } = build({}, false);
    expect(service.getView().host).toBeNull();
  });

  it('tells the host when the tab could not mount its screen', () => {
    const { service, host } = build();
    service.hostMountFailed();
    expect(host.calls).toEqual(['mountFailed']);
  });

  it('serves the host routes to the app protocol', () => {
    const { service, host } = build();
    expect(service.routes).toBe((host.runner as unknown as { routes: unknown }).routes);
  });
});

describe('a packaged app built for another flavour', () => {
  const same = { isPackaged: true, bakedFlavor: 'beta', builtFlavor: 'beta' } as const;

  it.each([
    ['the same flavour', same, false],
    ['another flavour', { ...same, bakedFlavor: 'prod' }, true],
    ['no baked flavour', { ...same, bakedFlavor: null }, true],
    ['an unpackaged run of another flavour', { ...same, isPackaged: false, bakedFlavor: null }, false],
  ] as const)('is judged right for %s', (_label, build, mismatch) => {
    expect(premiumBuildMismatch(build)).toBe(mismatch);
  });

  it('builds no Premium service and no host, and says so in the log', () => {
    const parts: PremiumHostWiringDeps[] = [];
    const service = createPremiumWhenEnabled(true, {
      db: null,
      originOverride: null,
      offline: false,
      readGameIdentity: () => null,
      locale: () => 'en',
      log: records,
      onChanged: () => undefined,
      host: {
        userDataPath: 'C:\\data',
        mainDir,
        reloadWindow: () => undefined,
        uiOnAppScheme: true,
        create: (wiring) => {
          parts.push(wiring);
          return fakeHost().runner;
        },
      },
      build: { isPackaged: true, bakedFlavor: 'prod', builtFlavor: 'beta' },
    });

    expect(service).toBeNull();
    expect(parts).toHaveLength(0);
    expect(licence.deps).toBeNull();
    expect(records.records).toContainEqual({ scope: 'premium', event: 'premium.build_mismatch' });
  });

  it('builds both when the flavours agree', () => {
    const service = createPremiumWhenEnabled(true, {
      db: null,
      originOverride: null,
      offline: false,
      readGameIdentity: () => null,
      locale: () => 'en',
      log: records,
      onChanged: () => undefined,
      build: { isPackaged: true, bakedFlavor: 'prod', builtFlavor: 'prod' },
    });
    expect(service).not.toBeNull();
    expect(licence.deps).not.toBeNull();
  });

  it('builds nothing when the flavour offers no Premium', () => {
    expect(
      createPremiumWhenEnabled(false, {
        db: null,
        originOverride: null,
        offline: false,
        readGameIdentity: () => null,
        locale: () => 'en',
        log: records,
        onChanged: () => undefined,
      }),
    ).toBeNull();
    expect(licence.deps).toBeNull();
  });
});
