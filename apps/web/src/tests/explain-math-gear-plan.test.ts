import { describe, expect, it } from 'vitest';
import { STRINGS } from '@/shared/i18n';

describe('explain-math roster gear-plan section', () => {
  it('documents duty and forge floor in EN and PT (RGO-22)', () => {
    expect(STRINGS.en.explainSections[8].h).toBe('9 · Roster gear plan');
    expect(STRINGS.en.explainSections[8].p.join(' ')).toMatch(/drainMult|duty/);
    expect(STRINGS.en.explainSections[8].p.join(' ')).toMatch(/forge floor|effectiveUpgrade/i);
    expect(STRINGS.en.explainSections[8].p.join(' ')).toMatch(/saturated/i);
    expect(STRINGS.pt.explainSections[8].h).toBe('9 · Plano de gear do roster');
    expect(STRINGS.pt.explainSections[8].p.join(' ')).toMatch(/drainMult|duty/i);
    expect(STRINGS.pt.explainSections[8].p.join(' ')).toMatch(/piso de forja|effectiveUpgrade/i);
    expect(STRINGS.pt.explainSections[8].p.join(' ')).toMatch(/saturado/i);
  });
});
