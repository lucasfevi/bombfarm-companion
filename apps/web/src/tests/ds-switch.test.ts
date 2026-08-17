import { describe, expect, it } from 'vitest';
import { switchRootRecipe, switchThumbClass } from '@bombfarm/ui/switch.recipe';

describe('switch recipe', () => {
  it('exports checked/unchecked track styles via data attributes', () => {
    const root = switchRootRecipe();
    expect(root).toContain('data-[checked]:border-accent');
    expect(root).toContain('data-[checked]:bg-[color-mix(in_oklch,var(--accent)_32%,var(--bg-2))]');
    expect(root).toContain('w-10');
    expect(switchThumbClass).toContain('data-[checked]:translate-x-[18px]');
    expect(switchThumbClass).toContain('data-[checked]:bg-accent');
  });
});
