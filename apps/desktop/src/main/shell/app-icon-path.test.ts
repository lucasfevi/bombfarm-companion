import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveAppIconPath } from './app-icon-path.js';

describe('resolveAppIconPath', () => {
  it('reads the icon unpacked beside the archive on a packaged build, never from inside app.asar', () => {
    const resources = path.join('C:', 'Program Files', 'Bomb Farm Companion', 'resources');
    const mainDir = path.join(resources, 'app.asar', 'dist', 'main');

    expect(resolveAppIconPath(mainDir)).toBe(
      path.join(resources, 'app.asar.unpacked', 'assets', 'icon.ico'),
    );
  });

  it('reads the source tree icon on an unpackaged run', () => {
    const desktopRoot = path.join('C:', 'dev', 'companion', 'apps', 'desktop');

    expect(resolveAppIconPath(path.join(desktopRoot, 'dist', 'main'))).toBe(
      path.join(desktopRoot, 'assets', 'icon.ico'),
    );
  });

  it('leaves a directory that merely starts with app.asar alone', () => {
    const desktopRoot = path.join('C:', 'dev', 'app.asar-experiments', 'apps', 'desktop');

    expect(resolveAppIconPath(path.join(desktopRoot, 'dist', 'main'))).toBe(
      path.join(desktopRoot, 'assets', 'icon.ico'),
    );
  });
});
