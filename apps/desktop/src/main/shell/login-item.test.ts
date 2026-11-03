import { describe, expect, it, vi } from 'vitest';
import {
  LOGIN_ITEM_ARGS,
  desiredLoginItemState,
  reconcileLoginItem,
  type LoginItemPort,
  type LoginItemReadback,
} from './login-item.js';

function fakePort(reads: LoginItemReadback[], opts: { setThrows?: boolean } = {}) {
  let i = 0;
  const get = vi.fn((): LoginItemReadback => {
    const next = reads[Math.min(i, reads.length - 1)];
    i += 1;
    if (!next) throw new Error('fakePort needs at least one read');
    return next;
  });
  const set = vi.fn((_v: boolean) => {
    if (opts.setThrows) throw new Error('registry denied');
  });
  const port: LoginItemPort = { get, set };
  return { port, get, set };
}
const off: LoginItemReadback = { openAtLogin: false, disabledByWindows: false };
const on: LoginItemReadback = { openAtLogin: true, disabledByWindows: false };
const disabled: LoginItemReadback = { openAtLogin: false, disabledByWindows: true };
const base = { isPackaged: true, platform: 'win32' as NodeJS.Platform };

describe('desiredLoginItemState', () => {
  it.each([
    [true, true, true],
    [true, false, false],
    [false, true, false],
    [false, false, false],
  ])('startWithWindows=%s consentGranted=%s -> %s', (startWithWindows, consentGranted, want) => {
    expect(desiredLoginItemState({ startWithWindows, consentGranted })).toBe(want);
  });

  it('permission alone does not register the login item when the player turned the setting off', () => {
    expect(desiredLoginItemState({ startWithWindows: false, consentGranted: true })).toBe(false);
  });
});

describe('reconcileLoginItem', () => {
  it('registers when absent and reads back present', () => {
    const f = fakePort([off, on]);
    expect(reconcileLoginItem({ ...base, desired: true, port: f.port })).toEqual({
      applied: true,
      registered: true,
    });
    expect(f.set).toHaveBeenCalledTimes(1);
    expect(f.set).toHaveBeenCalledWith(true);
  });

  it('removal is the same path with desired false', () => {
    const f = fakePort([on, off]);
    expect(reconcileLoginItem({ ...base, desired: false, port: f.port })).toEqual({
      applied: true,
      registered: false,
    });
    expect(f.set).toHaveBeenCalledWith(false);
  });

  it('does not call set when current already equals desired', () => {
    const f = fakePort([on]);
    expect(reconcileLoginItem({ ...base, desired: true, port: f.port })).toEqual({
      applied: true,
      registered: true,
    });
    expect(f.set).not.toHaveBeenCalled();
    const g = fakePort([off]);
    expect(reconcileLoginItem({ ...base, desired: false, port: g.port }).applied).toBe(true);
    expect(g.set).not.toHaveBeenCalled();
  });

  it.each(['darwin', 'linux'] as NodeJS.Platform[])(
    '%s is not_supported and never touches the port',
    (platform) => {
      const f = fakePort([off]);
      expect(reconcileLoginItem({ ...base, platform, desired: true, port: f.port })).toEqual({
        applied: false,
        block: 'not_supported',
      });
      expect(f.get).not.toHaveBeenCalled();
      expect(f.set).not.toHaveBeenCalled();
    },
  );

  it('unpackaged is blocked and never touches the port', () => {
    const f = fakePort([off]);
    expect(reconcileLoginItem({ ...base, isPackaged: false, desired: true, port: f.port })).toEqual({
      applied: false,
      block: 'unpackaged',
    });
    expect(f.get).not.toHaveBeenCalled();
    expect(f.set).not.toHaveBeenCalled();
  });

  it('respects an entry Windows disabled: no set, disabled_by_windows', () => {
    const f = fakePort([disabled]);
    expect(reconcileLoginItem({ ...base, desired: true, port: f.port })).toEqual({
      applied: false,
      block: 'disabled_by_windows',
    });
    expect(f.set).not.toHaveBeenCalled();
  });

  it('still removes a Windows-disabled entry when desired is off', () => {
    const f = fakePort([{ openAtLogin: true, disabledByWindows: true }, off]);
    expect(reconcileLoginItem({ ...base, desired: false, port: f.port })).toEqual({
      applied: true,
      registered: false,
    });
    expect(f.set).toHaveBeenCalledWith(false);
  });

  it('a throwing set is failed', () => {
    const f = fakePort([off], { setThrows: true });
    expect(reconcileLoginItem({ ...base, desired: true, port: f.port })).toEqual({
      applied: false,
      block: 'failed',
    });
  });

  it('a set that succeeds but reads back unchanged is failed, not applied', () => {
    const f = fakePort([off, off]);
    expect(reconcileLoginItem({ ...base, desired: true, port: f.port })).toEqual({
      applied: false,
      block: 'failed',
    });
    expect(f.get).toHaveBeenCalledTimes(2);
  });

  it('a failed removal read-back is failed too', () => {
    const f = fakePort([on, on]);
    expect(reconcileLoginItem({ ...base, desired: false, port: f.port })).toEqual({
      applied: false,
      block: 'failed',
    });
  });

  it('a throwing initial read is failed without calling set', () => {
    const set = vi.fn();
    const port: LoginItemPort = {
      get: () => {
        throw new Error('boom');
      },
      set,
    };
    expect(reconcileLoginItem({ ...base, desired: true, port }).applied).toBe(false);
    expect(set).not.toHaveBeenCalled();
  });

  it('desired on with an entry both present and disabled by Windows is disabled_by_windows, no set', () => {
    const f = fakePort([{ openAtLogin: true, disabledByWindows: true }]);
    expect(reconcileLoginItem({ ...base, desired: true, port: f.port })).toEqual({
      applied: false,
      block: 'disabled_by_windows',
    });
    expect(f.set).not.toHaveBeenCalled();
  });

  it('desired off with an absent, Windows-disabled entry is already applied, no set', () => {
    const f = fakePort([{ openAtLogin: false, disabledByWindows: true }]);
    expect(reconcileLoginItem({ ...base, desired: false, port: f.port })).toEqual({
      applied: true,
      registered: false,
    });
    expect(f.set).not.toHaveBeenCalled();
  });

  it('a read-back that throws after a successful set is failed', () => {
    const set = vi.fn();
    const get = vi
      .fn<() => LoginItemReadback>()
      .mockReturnValueOnce(off)
      .mockImplementationOnce(() => {
        throw new Error('read-back denied');
      });
    expect(reconcileLoginItem({ ...base, desired: true, port: { get, set } })).toEqual({
      applied: false,
      block: 'failed',
    });
    expect(set).toHaveBeenCalledTimes(1);
  });

  it('exposes one empty args constant for set and get', () => {
    expect(LOGIN_ITEM_ARGS).toEqual([]);
  });

  it('takes no tray input: the outcome depends only on the inputs and the port', () => {
    const a = reconcileLoginItem({ ...base, desired: true, port: fakePort([off, on]).port });
    const b = reconcileLoginItem({ ...base, desired: true, port: fakePort([off, on]).port });
    expect(a).toEqual(b);
  });
});
