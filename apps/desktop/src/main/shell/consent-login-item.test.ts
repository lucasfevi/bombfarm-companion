import { initialConsent, isGranted, type ConsentRecord } from '@bombfarm/game-api';
import { describe, expect, it, vi } from 'vitest';
import { createLoginItemConsentApplier } from './consent-login-item.js';
import { createLoginItemReconciler } from './login-item-reconciler.js';
import type { LoginItemPort, LoginItemReadback } from './login-item.js';

function setup(startWithWindows: boolean) {
  let record: ConsentRecord = initialConsent();
  let registered = false;
  const set = vi.fn((v: boolean) => {
    registered = v;
  });
  const get = vi.fn((): LoginItemReadback => ({ openAtLogin: registered, disabledByWindows: false }));
  const port: LoginItemPort = { get, set };
  const settings = { startWithWindows };
  const reconciler = createLoginItemReconciler({
    getStartWithWindows: () => settings.startWithWindows,
    isConsentGranted: () => isGranted(record),
    isPackaged: true,
    platform: 'win32',
    port,
  });
  const apply = createLoginItemConsentApplier({
    read: () => record,
    write: (next) => {
      record = next;
    },
    beforeLosingConsent: [],
    afterApplied: [],
    reconcileLoginItem: () => reconciler.reconcile(),
  });
  const accept = () => apply({ type: 'accept', now: '2026-01-01T00:00:00.000Z', locale: 'en' });
  const revoke = () => apply({ type: 'revoke' });
  return { set, settings, accept, revoke, isRegistered: () => registered };
}

describe('createLoginItemConsentApplier', () => {
  it('registers on a grant with the setting on', async () => {
    const s = setup(true);
    await s.accept();
    expect(s.isRegistered()).toBe(true);
  });

  it('a revoke removes the entry and leaves the stored setting on', async () => {
    const s = setup(true);
    await s.accept();
    await s.revoke();
    expect(s.set).toHaveBeenLastCalledWith(false);
    expect(s.isRegistered()).toBe(false);
    expect(s.settings.startWithWindows).toBe(true);
  });

  it('a re-grant restores the entry', async () => {
    const s = setup(true);
    await s.accept();
    await s.revoke();
    await s.accept();
    expect(s.isRegistered()).toBe(true);
    expect(s.set).toHaveBeenLastCalledWith(true);
  });

  it('a re-grant with the setting off registers nothing', async () => {
    const s = setup(true);
    await s.accept();
    await s.revoke();
    s.settings.startWithWindows = false;
    await s.accept();
    expect(s.isRegistered()).toBe(false);
    expect(s.set).toHaveBeenLastCalledWith(false);
  });

  it('runs the caller hooks before the reconcile', async () => {
    const order: string[] = [];
    const apply = createLoginItemConsentApplier({
      read: initialConsent,
      write: () => undefined,
      beforeLosingConsent: [],
      afterApplied: [() => order.push('hook')],
      reconcileLoginItem: () => order.push('reconcile'),
    });
    await apply({ type: 'decline', locale: 'en' });
    expect(order).toEqual(['hook', 'reconcile']);
  });
});
