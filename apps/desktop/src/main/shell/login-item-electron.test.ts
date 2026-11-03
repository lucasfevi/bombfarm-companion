import { describe, expect, it, vi } from 'vitest';
import { LOGIN_ITEM_ARGS } from './login-item.js';
import { createElectronLoginItemPort, type LoginItemApp } from './login-item-electron.js';

const APP_ID = 'app.example.id';

function fakeApp(read: ReturnType<LoginItemApp['getLoginItemSettings']>) {
  const setLoginItemSettings = vi.fn((_settings: { openAtLogin: boolean; args: string[] }) => undefined);
  const getLoginItemSettings = vi.fn((_options: { args: string[] }) => read);
  const app: LoginItemApp = { setLoginItemSettings, getLoginItemSettings };
  return { app, setLoginItemSettings, getLoginItemSettings };
}

describe('createElectronLoginItemPort', () => {
  it('hands set and get the same argument list, and neither a name nor a path', () => {
    const f = fakeApp({ openAtLogin: true });
    const port = createElectronLoginItemPort(f.app, APP_ID);
    port.set(true);
    port.get();
    expect(f.setLoginItemSettings).toHaveBeenCalledWith({ openAtLogin: true, args: LOGIN_ITEM_ARGS });
    expect(f.getLoginItemSettings).toHaveBeenCalledWith({ args: LOGIN_ITEM_ARGS });
    const setArg = f.setLoginItemSettings.mock.calls[0]?.[0];
    const getArg = f.getLoginItemSettings.mock.calls[0]?.[0];
    expect(setArg?.args).toEqual(getArg?.args);
    expect(setArg).toBeDefined();
    expect(getArg).toBeDefined();
    for (const arg of [setArg, getArg]) {
      expect(arg).not.toHaveProperty('name');
      expect(arg).not.toHaveProperty('path');
    }
  });

  it('passes openAtLogin=false through on removal', () => {
    const f = fakeApp({ openAtLogin: false });
    createElectronLoginItemPort(f.app, APP_ID).set(false);
    expect(f.setLoginItemSettings).toHaveBeenCalledWith({ openAtLogin: false, args: LOGIN_ITEM_ARGS });
  });

  it('folds a disabled launch item of this app into disabledByWindows', () => {
    const f = fakeApp({ openAtLogin: false, launchItems: [{ name: APP_ID, enabled: false }] });
    expect(createElectronLoginItemPort(f.app, APP_ID).get()).toEqual({
      openAtLogin: false,
      disabledByWindows: true,
    });
  });

  it('ignores a disabled launch item of another app, and an enabled one of this app', () => {
    const other = fakeApp({ openAtLogin: true, launchItems: [{ name: 'someone.else', enabled: false }] });
    expect(createElectronLoginItemPort(other.app, APP_ID).get().disabledByWindows).toBe(false);
    const ours = fakeApp({ openAtLogin: true, launchItems: [{ name: APP_ID, enabled: true }] });
    expect(createElectronLoginItemPort(ours.app, APP_ID).get().disabledByWindows).toBe(false);
  });

  it('reads no launch items as not disabled', () => {
    const f = fakeApp({ openAtLogin: true });
    expect(createElectronLoginItemPort(f.app, APP_ID).get()).toEqual({
      openAtLogin: true,
      disabledByWindows: false,
    });
  });
});
