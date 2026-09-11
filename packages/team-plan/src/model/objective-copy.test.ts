import { describe, expect, it } from 'vitest';
import type { TeamPlanObjective } from '@bombfarm/domain/team-plan/types';
import { teamPlanEn, teamPlanPtBR, type TeamPlanHostCopy } from '../copy';
import { teamPlanObjectiveCopy } from './objective-copy';

type Lang = 'en' | 'pt';

/** The thirteen host members, inline — this package ships no host implementation of its own. */
const TEST_HOST_COPY_EN: TeamPlanHostCopy = {
  teamPlanEmptyNoRosterTitle: 'Import heroes first',
  teamPlanEmptyNoRosterBody: 'Export your save, then import to load your roster.',
  teamPlanEmptyNoInventoryTitle: 'No item inventory yet',
  teamPlanEmptyNoInventoryBody: 'Re-import your save so every item is read.',
  teamPlanEmptyAllLeaveAloneTitle: 'Nothing in scope',
  teamPlanEmptyAllLeaveAloneBody: 'Set at least one hero to Optimize.',
  teamPlanBlockedBody: 'Re-export your save for: {heroes}.',
  teamPlanObjectiveFarmNeedsMaxPhase: 'Pick a phase, re-import the save, or score for damage.',
  teamPlanAuraDisclosureDps: 'Team auras drive the Planner DPS too.',
  teamPlanAuraDisclosureFarm: 'Team auras, though the Planner page still reads them.',
  teamPlanPlannerDivergenceDps: 'Planner DPS can differ from this page.',
  teamPlanPlannerDivergenceFarm: "The Planner's own figures can differ.",
  teamPlanFarmAdvisorPointer: 'For gear moves and forge work as well, use the Optimizer page.',
};

const TEST_HOST_COPY_PT: TeamPlanHostCopy = {
  teamPlanEmptyNoRosterTitle: 'Importe heróis primeiro',
  teamPlanEmptyNoRosterBody: 'Exporte o save e importe para carregar o roster.',
  teamPlanEmptyNoInventoryTitle: 'Sem inventário de itens',
  teamPlanEmptyNoInventoryBody: 'Reimporte o save para ler todos os itens.',
  teamPlanEmptyAllLeaveAloneTitle: 'Nada no escopo',
  teamPlanEmptyAllLeaveAloneBody: 'Marque pelo menos um herói como Otimizar.',
  teamPlanBlockedBody: 'Reexporte o save para: {heroes}.',
  teamPlanObjectiveFarmNeedsMaxPhase: 'Escolha uma fase, reimporte o save, ou pontue por dano.',
  teamPlanAuraDisclosureDps: 'Auras de time também movem o DPS do Planner.',
  teamPlanAuraDisclosureFarm: 'Auras de time, embora a página do Planner ainda os leia.',
  teamPlanPlannerDivergenceDps: 'O DPS do Planner pode divergir desta página.',
  teamPlanPlannerDivergenceFarm: 'Os números do próprio Planner podem divergir.',
  teamPlanFarmAdvisorPointer: 'Para movimentações de itens e forjas também, use a página Otimizador.',
};

const SCREEN_COPY = {
  en: { ...teamPlanEn, ...TEST_HOST_COPY_EN },
  pt: { ...teamPlanPtBR, ...TEST_HOST_COPY_PT },
};

const LANGS: Lang[] = ['en', 'pt'];
const OBJECTIVES: TeamPlanObjective[] = ['dps', 'farm'];

/** A gold plan reports gold per hour. Any of these words in a string it renders is a wrong unit
 *  or a wrong claim, not a stylistic slip. */
const DAMAGE_WORDS: Record<Lang, RegExp[]> = {
  en: [/\bdps\b/i, /\bdamage\b/i],
  pt: [/\bdps\b/i, /\bdano\b/i],
};

const GOLD_WORDS: Record<Lang, RegExp> = {
  en: /\bgold\b/i,
  pt: /\bouro\b/i,
};

function bundleEntries(lang: Lang, objective: TeamPlanObjective): [string, string][] {
  return Object.entries(teamPlanObjectiveCopy(SCREEN_COPY[lang], objective));
}

describe('teamPlanObjectiveCopy', () => {
  for (const lang of LANGS) {
    const DAMAGE_WORD_EXEMPT = new Set(['heroDeltaNote']);

    it(`${lang}: no farm-mode string carries a damage word`, () => {
      for (const [field, text] of bundleEntries(lang, 'farm')) {
        if (DAMAGE_WORD_EXEMPT.has(field)) continue;
        for (const pattern of DAMAGE_WORDS[lang]) {
          expect(text, `${field}: "${text}" matched ${pattern}`).not.toMatch(pattern);
        }
      }
    });

    it(`${lang}: the exempt farm note names DPS and denies it is the scored figure`, () => {
      const { heroDeltaNote } = teamPlanObjectiveCopy(SCREEN_COPY[lang], 'farm');
      expect(heroDeltaNote).toMatch(DAMAGE_WORDS[lang][0]);
      expect(heroDeltaNote).toMatch(GOLD_WORDS[lang]);
    });

    it(`${lang}: the dps bundle still speaks of damage, so the farm check is not vacuous`, () => {
      const damageWorded = bundleEntries(lang, 'dps').filter(([, text]) =>
        DAMAGE_WORDS[lang].some((pattern) => pattern.test(text)),
      );
      expect(damageWorded.length).toBeGreaterThanOrEqual(6);
    });

    it(`${lang}: the farm-mode strings that report a figure name gold`, () => {
      const copy = teamPlanObjectiveCopy(SCREEN_COPY[lang], 'farm');
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
      const dps = teamPlanObjectiveCopy(SCREEN_COPY[lang], 'dps');
      const farm = teamPlanObjectiveCopy(SCREEN_COPY[lang], 'farm');
      for (const field of Object.keys(dps) as (keyof typeof dps)[]) {
        expect(dps[field], `${lang}.${field}`).not.toBe(farm[field]);
      }
    }
  });
});
