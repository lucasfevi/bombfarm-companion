import { describe, expect, it } from 'vitest';
import { STRINGS, sub } from '@/shared/i18n';
import { mutedClass, warnClass, warnTextClass } from '@bombfarm/ui/panel-field.recipe';
import { stepperValueClass } from '@bombfarm/ui/stepper.recipe';

describe('points panel UX contracts', () => {
  it('reuses abilitiesSpent for spent / max (EN + PT)', () => {
    expect(sub(STRINGS.en.abilitiesSpent, { spent: 15, max: 38 })).toBe('15 / 38 points');
    expect(sub(STRINGS.pt.abilitiesSpent, { spent: 15, max: 38 })).toBe('15 / 38 pontos');
  });

  it('removes pointsTip from live i18n strings', () => {
    expect(STRINGS.en).not.toHaveProperty('pointsTip');
    expect(STRINGS.pt).not.toHaveProperty('pointsTip');
  });

  it('header warn uses margin-free warnClass (not block tip warnTextClass)', () => {
    expect(warnClass).toBe('text-xs text-warn');
    expect(warnClass).not.toMatch(/\bmb-/);
    expect(mutedClass).toBe('text-xs text-muted');
    expect(warnTextClass).toMatch(/\bmb-2\b/);
  });

  it('stepper value slot is fixed-width tabular so Δ column does not grow with digits', () => {
    expect(stepperValueClass).toMatch(/w-\[3ch\]/);
    expect(stepperValueClass).toMatch(/tabular-nums/);
    expect(stepperValueClass).not.toMatch(/min-w-\[18px\]/);
  });
});
