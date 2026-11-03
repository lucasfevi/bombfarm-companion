import { describe, expect, it, vi } from 'vitest';
import { createLoginItemReconciler } from './login-item-reconciler.js';
import type { LoginItemPort, LoginItemReadback } from './login-item.js';

function fakePort(reads: LoginItemReadback[]) {
  let i = 0;
  const get = vi.fn(() => reads[Math.min(i++, reads.length - 1)] ?? off);
  const set = vi.fn((_v: boolean) => undefined);
  const port: LoginItemPort = { get, set };
  return { port, get, set };
}
const off: LoginItemReadback = { openAtLogin: false, disabledByWindows: false };
const on: LoginItemReadback = { openAtLogin: true, disabledByWindows: false };
const disabled: LoginItemReadback = { openAtLogin: false, disabledByWindows: true };

describe('createLoginItemReconciler', () => {
  const setup = (opts: { startWithWindows: boolean; granted: boolean; reads: LoginItemReadback[] }) => {
    const f = fakePort(opts.reads);
    const settings = { startWithWindows: opts.startWithWindows };
    let granted = opts.granted;
    const r = createLoginItemReconciler({
      getStartWithWindows: () => settings.startWithWindows,
      isConsentGranted: () => granted,
      isPackaged: true,
      platform: 'win32',
      port: f.port,
    });
    return {
      ...f,
      r,
      settings,
      revoke: () => {
        granted = false;
      },
      grant: () => {
        granted = true;
      },
    };
  };

  it('reports nothing before the first reconcile', () => {
    expect(setup({ startWithWindows: true, granted: true, reads: [off] }).r.status()).toEqual({
      registered: false,
      block: null,
    });
  });

  it('registers on a granted permission with the setting on, and reports it', () => {
    const s = setup({ startWithWindows: true, granted: true, reads: [off, on] });
    s.r.reconcile();
    expect(s.set).toHaveBeenCalledWith(true);
    expect(s.r.status()).toEqual({ registered: true, block: null });
  });

  it('a revoke removes the entry and leaves the stored setting on', () => {
    const s = setup({ startWithWindows: true, granted: true, reads: [on, off] });
    s.revoke();
    s.r.reconcile();
    expect(s.set).toHaveBeenCalledWith(false);
    expect(s.settings.startWithWindows).toBe(true);
    expect(s.r.status()).toEqual({ registered: false, block: null });
  });

  it('a re-grant after a revoke registers again while the setting is still on', () => {
    const s = setup({ startWithWindows: true, granted: true, reads: [off, on, on, off, off, on] });
    s.r.reconcile();
    s.revoke();
    s.r.reconcile();
    s.grant();
    s.r.reconcile();
    expect(s.set.mock.calls.map((c) => c[0])).toEqual([true, false, true]);
    expect(s.settings.startWithWindows).toBe(true);
  });

  it('an explicit value overrides the stored one for a write not yet persisted', () => {
    const s = setup({ startWithWindows: false, granted: true, reads: [off, on] });
    s.r.reconcile(true);
    expect(s.set).toHaveBeenCalledWith(true);
  });

  it('keeps the block of the last outcome for the status read', () => {
    const s = setup({ startWithWindows: true, granted: true, reads: [disabled] });
    s.r.reconcile();
    expect(s.r.status()).toEqual({ registered: false, block: 'disabled_by_windows' });
  });
});
