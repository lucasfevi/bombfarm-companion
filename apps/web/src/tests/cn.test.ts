import { describe, expect, it } from 'vitest';
import { cn } from '@bombfarm/ui';

describe('cn()', () => {
  it('resolves conflicting Tailwind utilities last-wins (tailwind-merge)', () => {
    expect(cn('bg-bg-2', 'bg-accent')).toBe('bg-accent');
  });

  it('drops falsy/conditional inputs (clsx semantics)', () => {
    const off: boolean = false;
    expect(cn('a', off && 'b', undefined, 'c')).toBe('a c');
  });
});
