import { Menu, Tray, type NativeImage } from 'electron';
import type { TrayMenuItem, TrayPort } from './window-lifecycle.js';

export type TrayCreation =
  | { readonly ok: true; readonly tray: TrayPort; readonly native: Tray }
  | {
      readonly ok: false;
      readonly reason: 'not-win32' | 'icon-missing' | 'icon-empty' | 'construction-failed';
    };

function adaptTray(native: Tray): TrayPort {
  return {
    setToolTip(text) {
      native.setToolTip(text);
    },
    setContextMenu(items: readonly TrayMenuItem[]) {
      native.setContextMenu(
        Menu.buildFromTemplate(
          items.map((item) => ({
            label: item.label,
            click: item.click,
          })),
        ),
      );
    },
    destroy() {
      native.destroy();
    },
  };
}

export function createElectronTray(input: {
  iconPath: string;
  tooltip: string;
  platform: NodeJS.Platform;
  fileExists: (path: string) => boolean;
  createNativeImage: (path: string) => { isEmpty(): boolean };
  createTray?: (image: NativeImage) => Tray;
}): TrayCreation {
  if (input.platform !== 'win32') {
    return { ok: false, reason: 'not-win32' };
  }

  if (!input.fileExists(input.iconPath)) {
    return { ok: false, reason: 'icon-missing' };
  }

  const image = input.createNativeImage(input.iconPath);
  if (image.isEmpty()) {
    return { ok: false, reason: 'icon-empty' };
  }

  try {
    const native = input.createTray
      ? input.createTray(image as NativeImage)
      : new Tray(image as NativeImage);
    native.setToolTip(input.tooltip);
    return { ok: true, tray: adaptTray(native), native };
  } catch {
    return { ok: false, reason: 'construction-failed' };
  }
}
