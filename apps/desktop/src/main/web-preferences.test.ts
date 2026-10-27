import { describe, expect, it } from 'vitest';
import { buildMiniLiveWindowOptions } from './mini-live-window.js';
import { sandboxedWebPreferences } from './web-preferences.js';

const PRELOAD = 'C:\\app\\preload\\index.cjs';

describe('sandboxedWebPreferences', () => {
  it('sandboxes the renderer, isolates the preload world and withholds Node', () => {
    expect(sandboxedWebPreferences(PRELOAD)).toEqual({
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    });
  });

  it('is what the compact window is built from', () => {
    const options = buildMiniLiveWindowOptions({
      preloadPath: PRELOAD,
      iconPath: 'C:\\app\\icon.ico',
      x: 0,
      y: 0,
      width: 320,
      height: 200,
    });

    expect(options.webPreferences).toEqual(sandboxedWebPreferences(PRELOAD));
  });
});
