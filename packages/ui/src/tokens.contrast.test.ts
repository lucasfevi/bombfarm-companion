import { describe, expect, it } from 'vitest';
import { contrastRatio } from './token-color';
import { colorTokens, contrastPairs } from './tokens';

describe('design tokens — contrast AA (TOK-09)', () => {
  it.each(contrastPairs.map((pair) => [pair.fg, pair.bg, pair.minRatio, pair] as const))(
    '%s on %s meets %.1f:1',
    (fgKey, bgKey, minRatio) => {
      const ratio = contrastRatio(colorTokens[fgKey], colorTokens[bgKey]);
      expect(ratio).toBeGreaterThanOrEqual(minRatio);
    },
  );

  it('documents rar-2 on bg fails AA when misused as standalone text (decorative-only guard)', () => {
    const ratio = contrastRatio(colorTokens.rar2, colorTokens.bg);
    expect(ratio).toBeLessThan(4.5);
  });
});
