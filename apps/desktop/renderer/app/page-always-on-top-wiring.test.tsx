import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('page.tsx — always-on-top wiring keeps language and window warnings separate', () => {
  const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');

  it('renders WindowSection directly under LanguageSection in the settings view', () => {
    expect(source).toContain('<LanguageSection');
    expect(source).toContain('<WindowSection');
    const languageIdx = source.indexOf('<LanguageSection');
    const windowIdx = source.indexOf('<WindowSection');
    expect(windowIdx).toBeGreaterThan(languageIdx);
  });

  it('onAlwaysOnTopMainChange surfaces alwaysOnTopWarning, not language persistWarning', () => {
    expect(source).toContain('alwaysOnTopWarning');
    expect(source).toContain('setAlwaysOnTopWarning');
    expect(source).toContain("'settings:setAlwaysOnTopMain'");

    const handlerStart = source.indexOf('const onAlwaysOnTopMainChange');
    expect(handlerStart).toBeGreaterThanOrEqual(0);
    const handlerEnd = source.indexOf('};', handlerStart);
    const handler = source.slice(handlerStart, handlerEnd);

    expect(handler).toContain('setAlwaysOnTopMain');
    expect(handler).toContain('setAlwaysOnTopWarning');
    expect(handler).not.toContain('setPersistWarning');
  });
});
