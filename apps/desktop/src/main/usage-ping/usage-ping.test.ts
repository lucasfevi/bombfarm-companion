import { USAGE_PING_ACCOUNT_FIELDS, USAGE_PING_FIELDS, type AccountPayload } from '@bombfarm/contracts';
import { describe, expect, it, vi } from 'vitest';
import type { InstallIdStore } from './install-id-store.js';
import {
  accountIdentityOf,
  buildUsagePing,
  createUsagePing,
  USAGE_PING_FIRST_DELAY_MS,
  USAGE_PING_INTERVAL_MS,
  type UsagePingBody,
  type UsagePingDeps,
} from './usage-ping.js';

const INSTALL = '3f2b8c1e-9d4a-4b7e-8c21-5a6f0e9d1b33';
const ACCOUNT = { id: '486', name: 'Lucas' };

describe('buildUsagePing', () => {
  it('names the install and the account while the switch is on', () => {
    expect(
      buildUsagePing({ kind: 'hourly', flavor: 'prod', version: '0.21.0', enabled: true, installId: INSTALL, account: ACCOUNT }),
    ).toEqual({ v: 1, kind: 'hourly', flavor: 'prod', version: '0.21.0', install: INSTALL, account: ACCOUNT });
  });

  it('names neither the install nor the account once the switch is off — what the Settings copy promises', () => {
    const body = buildUsagePing({
      kind: 'hourly',
      flavor: 'prod',
      version: '0.21.0',
      enabled: false,
      installId: INSTALL,
      account: ACCOUNT,
    });

    expect(body).toEqual({ v: 1, kind: 'hourly', flavor: 'prod', version: '0.21.0', install: null, account: null });
  });

  it('never sends an account without an install id', () => {
    const body = buildUsagePing({ kind: 'startup', flavor: 'beta', version: '0.21.0', enabled: true, installId: null, account: ACCOUNT });

    expect(body.account).toBeNull();
  });
});

describe('the ping and the published privacy policy', () => {
  it('sends exactly the fields the policy describes — no more, no fewer', () => {
    const body = buildUsagePing({ kind: 'hourly', flavor: 'prod', version: '0.21.0', enabled: true, installId: INSTALL, account: ACCOUNT });

    expect(Object.keys(body).sort()).toEqual([...USAGE_PING_FIELDS].sort());
    expect(Object.keys(body.account ?? {}).sort()).toEqual([...USAGE_PING_ACCOUNT_FIELDS].sort());
  });
});

describe('accountIdentityOf', () => {
  const payload = (account: Record<string, unknown> | undefined): AccountPayload => ({ account });

  it('reads the game account id and player name', () => {
    expect(accountIdentityOf(payload({ account_id: 486, player_name: ' Lucas ' }))).toEqual({ id: '486', name: 'Lucas' });
  });

  it('keeps an account whose name is missing or blank', () => {
    expect(accountIdentityOf(payload({ account_id: '486', player_name: '  ' }))).toEqual({ id: '486', name: null });
  });

  it('is null before the account section has been read', () => {
    expect(accountIdentityOf(null)).toBeNull();
    expect(accountIdentityOf(payload(undefined))).toBeNull();
    expect(accountIdentityOf(payload({ player_name: 'no id' }))).toBeNull();
  });
});

function firstCallback(scheduled: ReadonlyArray<{ callback: () => void }>): () => void {
  const entry = scheduled[0];
  if (!entry) throw new Error('nothing was scheduled');
  return entry.callback;
}

function harness(overrides: Partial<UsagePingDeps> = {}) {
  const once: Array<{ callback: () => void; delayMs: number }> = [];
  const every: Array<{ callback: () => void; intervalMs: number }> = [];
  const cancelled: string[] = [];
  const sent: UsagePingBody[] = [];
  const ensureInstallId = vi.fn(() => INSTALL);
  const clearInstallId = vi.fn();
  const installIds: InstallIdStore = { ensure: ensureInstallId, clear: clearInstallId };
  let enabled = true;

  const deps: UsagePingDeps = {
    flavor: 'prod',
    version: '0.21.0',
    isEnabled: () => enabled,
    installIds,
    readAccount: () => ACCOUNT,
    send: (body) => {
      sent.push(body);
      return Promise.resolve();
    },
    scheduler: {
      scheduleOnce: (callback, delayMs) => {
        once.push({ callback, delayMs });
        return () => cancelled.push('once');
      },
      scheduleEvery: (callback, intervalMs) => {
        every.push({ callback, intervalMs });
        return () => cancelled.push('every');
      },
    },
    log: vi.fn(),
    ...overrides,
  };

  return {
    ping: createUsagePing(deps),
    deps,
    once,
    every,
    cancelled,
    sent,
    ensureInstallId,
    clearInstallId,
    setEnabled: (next: boolean) => {
      enabled = next;
    },
  };
}

describe('createUsagePing', () => {
  it('sends one startup ping after the first delay, then one every hour', async () => {
    const h = harness();
    h.ping.start();

    expect(h.once.map((o) => o.delayMs)).toEqual([USAGE_PING_FIRST_DELAY_MS]);
    expect(h.every.map((e) => e.intervalMs)).toEqual([USAGE_PING_INTERVAL_MS]);

    firstCallback(h.once)();
    firstCallback(h.every)();
    await Promise.resolve();

    expect(h.sent.map((b) => b.kind)).toEqual(['startup', 'hourly']);
    expect(h.sent[0]).toMatchObject({ install: INSTALL, account: ACCOUNT });
  });

  it('a second start() schedules nothing more', () => {
    const h = harness();
    h.ping.start();
    h.ping.start();

    expect(h.once).toHaveLength(1);
    expect(h.every).toHaveLength(1);
  });

  it('reads the switch at send time, so turning it off makes the very next ping anonymous', async () => {
    const readAccount = vi.fn(() => ACCOUNT);
    const h = harness({ readAccount });
    h.ping.start();
    h.setEnabled(false);

    firstCallback(h.every)();
    await Promise.resolve();

    expect(h.sent).toEqual([{ v: 1, kind: 'hourly', flavor: 'prod', version: '0.21.0', install: null, account: null }]);
    expect(readAccount).not.toHaveBeenCalled();
    expect(h.ensureInstallId).not.toHaveBeenCalled();
  });

  it('turning the switch off deletes the install id', () => {
    const h = harness();

    h.ping.setEnabled(false);

    expect(h.clearInstallId).toHaveBeenCalledTimes(1);
  });

  it('turning it on leaves the install id alone', () => {
    const h = harness();

    h.ping.setEnabled(true);

    expect(h.clearInstallId).not.toHaveBeenCalled();
  });

  it('a failed send is logged and never thrown', async () => {
    const log = vi.fn();
    const h = harness({ send: () => Promise.reject(new Error('offline')), log });
    h.ping.start();

    expect(firstCallback(h.every)).not.toThrow();
    await new Promise((resolve) => setImmediate(resolve));

    expect(log).toHaveBeenCalledWith('usage-ping.failed', { kind: 'hourly', reason: 'offline' });
  });

  it('stop() cancels both timers', () => {
    const h = harness();
    h.ping.start();

    h.ping.stop();

    expect(h.cancelled.sort()).toEqual(['every', 'once']);
  });
});
