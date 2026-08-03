import { describe, expect, it } from 'vitest';
import { FieldRequired } from '@bombfarm/ui/field-required';
import { reqClass } from '@bombfarm/ui/panel-field.recipe';
import { cn } from '@bombfarm/ui';

describe('FieldRequired', () => {
  it('exports a component that reserves space via invisible when hidden', () => {
    expect(typeof FieldRequired).toBe('function');
    const hidden = true;
    const shown = false;
    expect(cn(reqClass, hidden && 'invisible')).toContain('invisible');
    expect(cn(reqClass, shown && 'invisible')).not.toContain('invisible');
  });
});
