import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CONTENTION_NAMES_SHOWN,
  contentionHeroList,
} from '@/features/team-plan/components/plan-disclosures';
import { STRINGS } from '@/shared/i18n';
import { WEB_PACKAGE_ROOT } from './helpers/web-package-root';

/**
 * The saturated-regime callout has no DOM coverage: `e2e/team-plan-disclosures.spec.ts` skips
 * its saturated scenario because the 5-hero seed cannot reach the regime at all (its summed
 * duty tops out at 0.531 against a slots floor of 1). Until a big enough fixture exists, the
 * banner is covered here — its copy, and the one piece of real logic it carries.
 */
describe('contested-field hero list', () => {
  const names = ['A', 'B', 'C', 'D', 'E', 'F'];

  it('lists every hero when they fit', () => {
    const shown = names.slice(0, CONTENTION_NAMES_SHOWN);
    expect(contentionHeroList(shown, '{heroes} and {count} more')).toBe(shown.join(', '));
  });

  it('caps the list and counts the rest', () => {
    expect(contentionHeroList(names, '{heroes} and {count} more')).toBe('A, B, C, D and 2 more');
  });

  it('does not say "and 0 more" at exactly the cap', () => {
    const exact = names.slice(0, CONTENTION_NAMES_SHOWN);
    expect(contentionHeroList(exact, '{heroes} and {count} more')).not.toMatch(/more/);
  });

  it('handles an empty list', () => {
    expect(contentionHeroList([], '{heroes} and {count} more')).toBe('');
  });
});

describe('contested-field copy', () => {
  const source = readFileSync(
    `${WEB_PACKAGE_ROOT}/src/features/team-plan/components/plan-disclosures.tsx`,
    'utf8',
  );

  it('renders the callout from the disclosure, not from the regime flag', () => {
    // `fieldContention` carries the break-even and the hero names the copy needs; keying the
    // banner off `plan.regime` alone would render it with nothing to say.
    expect(source).toContain('plan.disclosures.fieldContention');
    expect(source).not.toContain("plan.regime === 'saturated'");
  });

  it.each(['teamPlanSaturationCallout', 'teamPlanContentionDilution', 'teamPlanContentionHeroes'])(
    'renders %s',
    (key) => {
      expect(source).toContain(`t.${key}`);
    },
  );

  it('explains the dilution and hands the decision back, in both languages', () => {
    expect(STRINGS.en.teamPlanContentionDilution).toMatch(/dilutes it/i);
    expect(STRINGS.en.teamPlanContentionDilution).toMatch(/never banks an item/i);
    expect(STRINGS.en.teamPlanContentionDilution).toMatch(/your call/i);
    expect(STRINGS.pt.teamPlanContentionDilution).toMatch(/dilui/i);
    expect(STRINGS.pt.teamPlanContentionDilution).toMatch(/nunca guarda um item/i);
    expect(STRINGS.pt.teamPlanContentionDilution).toMatch(/decis[aã]o sua/i);
  });

  it('quotes the break-even and the hero names through placeholders', () => {
    for (const lang of ['en', 'pt'] as const) {
      expect(STRINGS[lang].teamPlanContentionDilution).toContain('{mean}');
      expect(STRINGS[lang].teamPlanContentionHeroes).toContain('{heroes}');
      expect(STRINGS[lang].teamPlanContentionHeroesOverflow).toContain('{heroes}');
      expect(STRINGS[lang].teamPlanContentionHeroesOverflow).toContain('{count}');
    }
  });
});
