import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('page.tsx — the forge writes switch is pinned to its channel and its own warning', () => {
  const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');

  it('renders ForgeSection between WindowSection and ConsentSection in the settings view', () => {
    const windowIdx = source.indexOf('<WindowSection');
    const forgeIdx = source.indexOf('<ForgeSection');
    const consentIdx = source.indexOf('<ConsentSection');
    expect(windowIdx).toBeGreaterThanOrEqual(0);
    expect(forgeIdx).toBeGreaterThan(windowIdx);
    expect(consentIdx).toBeGreaterThan(forgeIdx);
  });

  it('reads forgeWritesEnabled from settings:get alongside the other stored flags', () => {
    const readStart = source.indexOf(".invoke('settings:get')");
    expect(readStart).toBeGreaterThanOrEqual(0);
    const readEnd = source.indexOf('.catch', readStart);
    expect(source.slice(readStart, readEnd)).toContain('setForgeWritesEnabled(settings.forgeWritesEnabled)');
  });

  it('onForgeWritesEnabledChange invokes settings:setForgeWritesEnabled and surfaces forgeWritesWarning, not language persistWarning', () => {
    const handlerStart = source.indexOf('const onForgeWritesEnabledChange');
    expect(handlerStart).toBeGreaterThanOrEqual(0);
    const handlerEnd = source.indexOf('};', handlerStart);
    const handler = source.slice(handlerStart, handlerEnd);

    expect(handler).toContain("'settings:setForgeWritesEnabled'");
    expect(handler).toContain('setForgeWritesEnabled(result.settings.forgeWritesEnabled)');
    expect(handler).toContain('setForgeWritesWarning');
    expect(handler).not.toContain('setPersistWarning');
    expect(handler).not.toContain('setAlwaysOnTopWarning');
  });
});
