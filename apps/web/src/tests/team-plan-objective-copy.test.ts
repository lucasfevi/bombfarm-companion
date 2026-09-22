import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { TeamPlanObjective } from '@bombfarm/domain/team-plan/types';
import { STRINGS, type Lang } from '@/shared/i18n';
import * as objectiveNamespace from '@/shared/i18n/namespaces/team-plan-objective';
import { teamPlanObjectiveCopy } from '@bombfarm/team-plan/model';
import { WEB_PACKAGE_ROOT } from './helpers/web-package-root';

const LANGS: Lang[] = ['en', 'pt'];
const OBJECTIVES: TeamPlanObjective[] = ['dps', 'farm', 'gateClear', 'pvp'];
/** The objectives that score damage — every one but gold. */
const DAMAGE_OBJECTIVES: TeamPlanObjective[] = ['dps', 'gateClear', 'pvp'];

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

    it(`${lang}: every damage bundle still speaks of damage, so the farm check is not vacuous`, () => {
      for (const objective of DAMAGE_OBJECTIVES) {
        const damageWorded = bundleEntries(lang, objective).filter(([, text]) =>
          DAMAGE_WORDS[lang].some((pattern) => pattern.test(text)),
        );
        expect(damageWorded.length, objective).toBeGreaterThanOrEqual(4);
      }
    });

    it(`${lang}: the farm-mode strings that report a figure name gold`, () => {
      const copy = teamPlanObjectiveCopy(STRINGS[lang], 'farm');
      expect(copy.totalGainValue).toMatch(GOLD_WORDS[lang]);
      expect(copy.gearDipNote).toMatch(GOLD_WORDS[lang]);
    });

    it(`${lang}: every objective resolves every field to a non-empty string`, () => {
      for (const objective of OBJECTIVES) {
        for (const [field, text] of bundleEntries(lang, objective)) {
          expect(text, `${objective}.${field}`).toBeTruthy();
        }
      }
    });
  }

  it('every damage objective disagrees with gold on every field, in both languages', () => {
    for (const lang of LANGS) {
      const farm = teamPlanObjectiveCopy(STRINGS[lang], 'farm');
      for (const objective of DAMAGE_OBJECTIVES) {
        const damage = teamPlanObjectiveCopy(STRINGS[lang], objective);
        for (const field of Object.keys(damage) as (keyof typeof damage)[]) {
          expect(damage[field], `${lang}.${objective}.${field}`).not.toBe(farm[field]);
        }
      }
    }
  });

  /**
   * The resolver is the only reader of the suffixed keys, which is what makes the vocabulary
   * check above a guarantee about the page rather than about one function: a component that
   * reached past it could render `teamPlanGearDipNoteDps` under a gold plan and no assertion
   * on the bundle would notice.
   */
  it('no source file outside the namespace and the resolver reads a suffixed key', () => {
    const suffixed = Object.keys(objectiveNamespace.en).filter((key) => /(Dps|Farm|Gate|Pvp)$/.test(key));
    expect(suffixed.length).toBeGreaterThanOrEqual(10);

    const allowed = [join('shared', 'i18n', 'namespaces', 'team-plan-objective.ts')];
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

  /**
   * The phase picker, the allowed-changes control and the breakdown's phase card render under
   * BOTH objectives from a single key each, so they get no `…Dps`/`…Farm` pair to keep them apart
   * — which means each string has to be true of a gold plan and a damage plan at once. A damage
   * word in any of them is the same failure the bundle split exists to prevent, arriving through
   * the one door the split does not cover.
   */
  const OBJECTIVE_NEUTRAL_KEYS = [
    'teamPlanPhaseLabel',
    'teamPlanPhaseAria',
    'teamPlanPhaseNone',
    'teamPlanPhaseSearchPlaceholder',
    'teamPlanPhaseNoMatch',
    'teamPlanPhaseMoreMatches',
    'teamPlanPhaseHintChosen',
    'teamPlanPhaseBeyondMax',
    'teamPlanWaterfallPhaseLabel',
    'teamPlanWaterfallPhaseFrom',
    'teamPlanScoredPhaseChosen',
    'teamPlanScoredPhaseAccount',
    'teamPlanScoredPhaseSearched',
    'teamPlanScoredPhaseUnreachable',
    'teamPlanScoredPhaseNoneFeasible',
    'teamPlanAllowedChangesLabel',
    'teamPlanAllowedChangesAria',
    'teamPlanAllowedChangesOptionBoth',
    'teamPlanAllowedChangesOptionPoints',
    'teamPlanAllowedChangesOptionGear',
    'teamPlanAllowedChangesHintBoth',
    'teamPlanAllowedChangesHintPoints',
    'teamPlanAllowedChangesHintGear',
    // The three Optimize arias name the KIND of work a plan may contain, never what it is scored
    // on, so all three render under either objective.
    'teamPlanOptimizeAriaBoth',
    'teamPlanOptimizeAriaPoints',
    'teamPlanOptimizeAriaGear',
  ] as const;

  for (const lang of LANGS) {
    it(`${lang}: the phase copy renders under both objectives, so it names neither`, () => {
      for (const key of OBJECTIVE_NEUTRAL_KEYS) {
        const text = STRINGS[lang][key];
        expect(text, `${key} is missing`).toBeTruthy();
        for (const pattern of DAMAGE_WORDS[lang]) {
          expect(text, `${key}: "${text}" matched ${pattern}`).not.toMatch(pattern);
        }
        expect(text, `${key}: "${text}" names gold`).not.toMatch(GOLD_WORDS[lang]);
      }
    });
  }

  it('red state: the scan above does catch a suffixed key in a component', () => {
    const pretendComponent = 'return <p>{t.teamPlanGearDipNoteFarm}</p>;';
    const suffixed = Object.keys(objectiveNamespace.en).filter((key) => /(Dps|Farm)$/.test(key));
    expect(suffixed.some((key) => pretendComponent.includes(key))).toBe(true);
  });
});
