/**
 * The Electron-shaped login-item port. It takes the `app` object as a parameter, typed by what it
 * uses, so this module imports nothing from `electron` and a test hands it a recording fake. The
 * real one is built only in the main entry, over the real `app`.
 */

import { LOGIN_ITEM_ARGS, type LoginItemPort } from './login-item.js';

interface LaunchItem {
  readonly name: string;
  readonly enabled: boolean;
}

export interface LoginItemApp {
  setLoginItemSettings(settings: { openAtLogin: boolean; args: string[] }): void;
  getLoginItemSettings(options: { args: string[] }): {
    openAtLogin: boolean;
    launchItems?: readonly LaunchItem[];
  };
}

/** No `name` and no `path` are passed: Electron then keys the entry by the executable, which is
 *  what `launchItems` reports back under this app's AppUserModelId. */
export function createElectronLoginItemPort(app: LoginItemApp, appUserModelId: string): LoginItemPort {
  return {
    set(openAtLogin) {
      app.setLoginItemSettings({ openAtLogin, args: [...LOGIN_ITEM_ARGS] });
    },
    get() {
      const read = app.getLoginItemSettings({ args: [...LOGIN_ITEM_ARGS] });
      const own = (read.launchItems ?? []).find((item) => item.name === appUserModelId);
      return { openAtLogin: read.openAtLogin, disabledByWindows: own?.enabled === false };
    },
  };
}
