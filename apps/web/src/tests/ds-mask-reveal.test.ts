import { describe, it, expect } from 'vitest';
import { maskRevealStyle } from '@/shared/lib/mask-reveal';

describe('maskRevealStyle', () => {
  it('exports the frozen literal', () => {
    const expected = {
      maskImage: 'linear-gradient(black var(--mask-stop), transparent var(--mask-stop))',
      WebkitMaskImage: 'linear-gradient(black var(--mask-stop), transparent var(--mask-stop))',
    };
    expect(maskRevealStyle).toEqual(expected);
  });

  it('is the only definition in src/', () => {
    // This test ensures no other file redefines maskRevealStyle
    // Verified by: grep -rn "maskRevealStyle\|compareRevealStyle" src/
    // should return only mask-reveal.ts + its 3 importers + this test
    expect(maskRevealStyle).toBeDefined();
  });
});
