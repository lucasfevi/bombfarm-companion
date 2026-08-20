import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const webGlobals = readFileSync(resolve(__dirname, '../app/globals.css'), 'utf8');
const desktopGlobals = readFileSync(
  resolve(__dirname, '../../../desktop/renderer/app/globals.css'),
  'utf8',
);

describe('token CSS import wiring (TOK-02/03)', () => {
  it('web globals imports shared ui styles and does not duplicate @theme colors', () => {
    expect(webGlobals).toMatch(/^@import '@bombfarm\/ui\/styles\.css';/m);
    expect(webGlobals).not.toContain('@theme {');
    expect(webGlobals).not.toContain('--color-rar-0');
  });

  it('desktop globals imports shared ui styles with no --bf-* fork', () => {
    expect(desktopGlobals).toMatch(/^@import '@bombfarm\/ui\/styles\.css';/m);
    expect(desktopGlobals).not.toContain('--bf-bg');
    expect(desktopGlobals).not.toContain('--bf-fg');
    expect(desktopGlobals).not.toContain('--bf-accent');
    expect(desktopGlobals).not.toContain('--bf-muted');
    expect(desktopGlobals).toContain('var(--bg)');
    expect(desktopGlobals).toContain('var(--ink)');
  });
});
