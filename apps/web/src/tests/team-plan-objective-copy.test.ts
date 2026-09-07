import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { TeamPlanObjective } from '@bombfarm/domain/team-plan/types';
import { STRINGS, type Lang } from '@/shared/i18n';
import * as objectiveNamespace from '@/shared/i18n/namespaces/team-plan-objective';
import { teamPlanObjectiveCopy } from '@/features/team-plan/model/objective-copy';
import { WEB_PACKAGE_ROOT } from './helpers/web-package-root';

const LANGS: Lang[] = ['en', 'pt'];
const OBJECTIVES: TeamPlanObjective[] = ['dps', 'farm'];

/**
 * A gold plan reports gold per hour. Any of these words in a string it renders is a wrong unit
 * or a wrong claim, not a stylistic slip.
 */
const DAMAGE_WORDS: Record<Lang, RegExp[]> = {
  en: [/\bdps\b/i, /\bdamage\b/i],
  pt: [/\bdps\b/i, /\bdano\b/i],
};

const GOLD_WORDS: Record<Lang, RegExp> = {
  en: /\bgold\b/i,
  pt: /\bouro\b/i,
};

function bundleEntries(lang: Lang, objective: TeamPlanObjective): [string, string][] {
  return Object.entries(teamPlanObjectiveCopy(STRINGS[lang], objective));
}

/** Every `.ts`/`.tsx` file under the web app's own source, tests excluded. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return entry === 'tests' ? [] : sourceFiles(full);
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

describe('team plan objective copy', () => {
  for (const lang of LANGS) {
    it(`${lang}: no farm-mode string carries a damage word`, () => {
      for (const [field, text] of bundleEntries(lang, 'farm')) {
        for (const pattern of DAMAGE_WORDS[lang]) {
          expect(text, `${field}: "${text}" matched ${pattern}`).not.toMatch(pattern);
        }
      }
    });

    // Without this the check above passes on an empty or accidentally-neutered dps bundle, which
    // would mean the two objectives had stopped saying anything different at all.
    it(`${lang}: the dps bundle still speaks of damage, so the farm check is not vacuous`, () => {
      const damageWorded = bundleEntries(lang, 'dps').filter(([, text]) =>
        DAMAGE_WORDS[lang].some((pattern) => pattern.test(text)),
      );
      expect(damageWorded.length).toBeGreaterThanOrEqual(6);
    });

    it(`${lang}: the farm-mode strings that report a figure name gold`, () => {
      const copy = teamPlanObjectiveCopy(STRINGS[lang], 'farm');
      expect(copy.totalGainValue).toMatch(GOLD_WORDS[lang]);
      expect(copy.resultsHeader).toMatch(GOLD_WORDS[lang]);
      expect(copy.gearDipNote).toMatch(GOLD_WORDS[lang]);
    });

    it(`${lang}: both objectives resolve every field to a non-empty string`, () => {
      for (const objective of OBJECTIVES) {
        for (const [field, text] of bundleEntries(lang, objective)) {
          expect(text, `${objective}.${field}`).toBeTruthy();
        }
      }
    });
  }

  it('the two objectives disagree on every field, in both languages', () => {
    for (const lang of LANGS) {
      const dps = teamPlanObjectiveCopy(STRINGS[lang], 'dps');
      const farm = teamPlanObjectiveCopy(STRINGS[lang], 'farm');
      for (const field of Object.keys(dps) as (keyof typeof dps)[]) {
        expect(dps[field], `${lang}.${field}`).not.toBe(farm[field]);
      }
    }
  });

  /**
   * The resolver is the only reader of the suffixed keys, which is what makes the vocabulary
   * check above a guarantee about the page rather than about one function: a component that
   * reached past it could render `teamPlanResultsHeaderDps` under a gold plan and no assertion
   * on the bundle would notice.
   */
  it('no source file outside the namespace and the resolver reads a suffixed key', () => {
    const suffixed = Object.keys(objectiveNamespace.en).filter((key) => /(Dps|Farm)$/.test(key));
    expect(suffixed.length).toBeGreaterThanOrEqual(18);

    const allowed = [
      join('shared', 'i18n', 'namespaces', 'team-plan-objective.ts'),
      join('features', 'team-plan', 'model', 'objective-copy.ts'),
    ];
    const offenders: string[] = [];
    for (const file of sourceFiles(join(WEB_PACKAGE_ROOT, 'src'))) {
      if (allowed.some((suffix) => file.endsWith(suffix))) continue;
      const text = readFileSync(file, 'utf8');
      for (const key of suffixed) {
        if (text.includes(key)) offenders.push(`${file}: ${key}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('red state: the scan above does catch a suffixed key in a component', () => {
    const pretendComponent = 'return <p>{t.teamPlanResultsHeaderFarm}</p>;';
    const suffixed = Object.keys(objectiveNamespace.en).filter((key) => /(Dps|Farm)$/.test(key));
    expect(suffixed.some((key) => pretendComponent.includes(key))).toBe(true);
  });
});
