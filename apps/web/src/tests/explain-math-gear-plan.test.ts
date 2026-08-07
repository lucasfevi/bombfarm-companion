import { describe, expect, it } from 'vitest';
import { STRINGS } from '@/shared/i18n';

describe('explain-math roster gear-plan section', () => {
  it('documents duty and forge floor in EN and PT (RGO-22)', () => {
    const enProse = STRINGS.en.explainSections[8].p.join(' ');
    const ptProse = STRINGS.pt.explainSections[8].p.join(' ');
    const enCode = STRINGS.en.explainSections[8].code ?? '';
    const ptCode = STRINGS.pt.explainSections[8].code ?? '';

    expect(STRINGS.en.explainSections[8].h).toBe('9 · Roster gear plan');
    expect(enProse).toMatch(/drainMult|duty/);
    expect(enProse).toMatch(/forge floor/i);
    expect(enProse).toMatch(/saturated/i);
    // Formulas stay in the code channel — not inline in player-facing prose (docs/i18n.md).
    expect(enProse).not.toMatch(/effectiveUpgrade\s*=/);
    expect(enCode).toMatch(/effectiveUpgrade/);

    expect(STRINGS.pt.explainSections[8].h).toBe('9 · Plano de gear do roster');
    expect(ptProse).toMatch(/drainMult|duty/i);
    expect(ptProse).toMatch(/piso de forja/i);
    expect(ptProse).toMatch(/saturado/i);
    expect(ptProse).not.toMatch(/effectiveUpgrade\s*=/);
    expect(ptCode).toMatch(/effectiveUpgrade/);
  });
});
