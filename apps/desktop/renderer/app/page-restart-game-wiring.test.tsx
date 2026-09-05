import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('page.tsx — the restart-game switch is pinned to its channel and its own warning', () => {
  const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');

  it('renders GameSection between WindowSection and ConsentSection in the settings view', () => {
    const windowIdx = source.indexOf('<WindowSection');
    const gameIdx = source.indexOf('<GameSection');
    const consentIdx = source.indexOf('<ConsentSection');
    expect(windowIdx).toBeGreaterThanOrEqual(0);
    expect(gameIdx).toBeGreaterThan(windowIdx);
    expect(consentIdx).toBeGreaterThan(gameIdx);
  });

  it('reads restartGameOnExit from settings:get alongside the other stored flags', () => {
    const readStart = source.indexOf(".invoke('settings:get')");
    expect(readStart).toBeGreaterThanOrEqual(0);
    const readEnd = source.indexOf('.catch', readStart);
    expect(source.slice(readStart, readEnd)).toContain('setRestartGameOnExit(settings.restartGameOnExit)');
  });

  it('onRestartGameOnExitChange invokes settings:setRestartGameOnExit and surfaces restartGameOnExitWarning, not language persistWarning', () => {
    const handlerStart = source.indexOf('const onRestartGameOnExitChange');
    expect(handlerStart).toBeGreaterThanOrEqual(0);
    const handlerEnd = source.indexOf('};', handlerStart);
    const handler = source.slice(handlerStart, handlerEnd);

    expect(handler).toContain("'settings:setRestartGameOnExit'");
    expect(handler).toContain('setRestartGameOnExit(result.settings.restartGameOnExit)');
    expect(handler).toContain('setRestartGameOnExitWarning');
    expect(handler).not.toContain('setPersistWarning');
    expect(handler).not.toContain('setAlwaysOnTopWarning');
    expect(handler).not.toContain('setForgeWritesWarning');
  });
});
