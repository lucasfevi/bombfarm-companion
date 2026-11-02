import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from './token-color';
import { colorTokens } from './tokens';

const styles = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'styles.css'), 'utf8');

function declared(name: string): string {
  const raw = new RegExp(`${name}:\s*([^;\n]+);`).exec(styles)?.[1]?.trim();
  if (!raw) throw new Error(`${name} is not declared in styles.css`);
  const hue = /--hue:\s*(\d+)/.exec(styles)?.[1];
  return raw.replace('var(--hue)', hue ?? '');
}

/** `text-warn` resolves to `--color-warn`, so the stylesheet value is what small text is drawn in. */
describe('text-warn contrast', () => {
  const warn = declared('--color-warn');

  it.each(['--color-surface', '--color-bg', '--color-bg-2'])('meets 4.5:1 on %s', (background) => {
    expect(contrastRatio(warn, declared(background))).toBeGreaterThanOrEqual(4.5);
  });

  it('matches the typed token mirror', () => {
    expect(warn).toBe(colorTokens.warn);
  });
});
