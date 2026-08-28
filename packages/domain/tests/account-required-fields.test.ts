/**
 * `maxPhase` is the field that proves this matters: `resolveUpperPhase` reads a null ceiling as
 * "no ceiling" and returns 600, so the Farm Respec Advisor can recommend spending real gold
 * toward a phase the player cannot enter.
 *
 * Every save below is built here rather than read from the corpus, so a capture being retired
 * cannot take these assertions with it.
 */
import { describe, expect, it } from 'vitest';
import {
  REQUIRED_ACCOUNT_FIELDS,
  OPTIONAL_ACCOUNT_FIELDS,
  missingRequiredAccountFields,
  toRequiredAccountFields,
} from '@bombfarm/domain/account-required-fields';
import { parseAccountPayload, parseSaveFile } from '@bombfarm/domain/import-save';
import { minimalHero } from './helpers/minimal-save-hero';

/** Everything `POST_UPDATE_SAVE_KEYS` demands, so the version gate never fires first. */
const TOTALS = {
  team_dmg_add: 0.2,
  crit_chance_add: 0,
  crit_dmg_add: 0,
  speed_add: 0,
  coin_add: 0,
  luck_add: 0,
  energia_add: 0,
  xp_mult: 1,
  geo_mult: 1,
  dmg_static: 1.2,
  vagas_campo: 2,
  bag_tabs_bonus: 1,
};

function completeSave(): Record<string, unknown> {
  return {
    heroes: [minimalHero('1')],
    items: [],
    skills: { refunds: {}, levels: {}, field_slots: 3, max_phase: 42, totals: { ...TOTALS } },
    account: { phase: 24, max_phase: 42 },
    casa: { active_casa: 1, levels: [4], cycle_secs: 1168, slots: 3 },
  };
}

describe('REQUIRED_ACCOUNT_FIELDS classifies every account field the importer produces', () => {
  it('required and optional together cover the parsed account, with no overlap', () => {
    const { account } = parseSaveFile(completeSave(), []);
    const classified = [...REQUIRED_ACCOUNT_FIELDS, ...OPTIONAL_ACCOUNT_FIELDS];

    expect([...Object.keys(account)].sort()).toEqual([...classified].sort());
  });
});

describe('parseSaveFile reports required fields the save did not carry', () => {
  it('a complete save reports nothing missing and adds no warning', () => {
    const result = parseSaveFile(completeSave(), []);

    expect(result.accountMissingRequired).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('a save carrying neither max_phase source reports maxPhase, and still imports the roster', () => {
    const save = completeSave();
    delete (save.account as Record<string, unknown>).max_phase;
    delete (save.skills as Record<string, unknown>).max_phase;

    const result = parseSaveFile(save, []);

    expect(result.accountMissingRequired).toEqual(['maxPhase']);
    expect(result.rejected).toBeNull();
    expect(result.candidates).toHaveLength(1);
  });

  it('a save with no house block reports the House and its level, in field order', () => {
    const save = completeSave();
    delete save.casa;

    expect(parseSaveFile(save, []).accountMissingRequired).toEqual(['houseIdx', 'houseLevel']);
  });

  /**
   * `tree` stays on the required list even though the version gate always catches it first: the
   * list states what the planner needs, not what today's gate happens to reject, so
   * re-baselining that gate must not quietly make a tree-less save importable.
   */
  it('a save with no skill-tree totals is rejected by the version gate before the field check', () => {
    const save = completeSave();
    (save.skills as Record<string, unknown>).totals = undefined;

    const result = parseSaveFile(save, []);

    expect(result.rejected?.reason).toBe('unsupportedSaveShape');
    expect(missingRequiredAccountFields({ ...result.account })).toContain('tree');
  });

  it('names the missing fields in a warning, not only in the typed result', () => {
    const save = completeSave();
    delete (save.account as Record<string, unknown>).phase;

    const result = parseSaveFile(save, []);

    expect(result.accountMissingRequired).toEqual(['phase']);
    expect(result.warnings.join(' ')).toContain('phase');
  });

  it('a rejected file reports nothing missing — it produced no account to judge', () => {
    const result = parseSaveFile({ nope: true }, []);

    expect(result.rejected?.reason).toBe('notASaveFile');
    expect(result.accountMissingRequired).toEqual([]);
  });
});

describe('parseAccountPayload never asserts required-ness', () => {
  it('a payload missing every required field still reports none', () => {
    const result = parseAccountPayload({ heroes: [minimalHero('1')] }, []);

    // A payload legitimately omits whole sections per poll, so absence there is a degraded
    // cycle, not a malformed export — the same split the save-shape gate already makes.
    expect(missingRequiredAccountFields(result.account)).toHaveLength(REQUIRED_ACCOUNT_FIELDS.length);
    expect(result.accountMissingRequired).toEqual([]);
  });
});

describe('toRequiredAccountFields', () => {
  it('reads a non-array (an account stored before the rule) as "never checked", not "complete"', () => {
    expect(toRequiredAccountFields(undefined)).toBeNull();
    expect(toRequiredAccountFields(null)).toBeNull();
  });

  it('keeps an empty list as the distinct "checked and complete" state', () => {
    expect(toRequiredAccountFields([])).toEqual([]);
  });

  it('drops unknown entries and restores field order', () => {
    expect(toRequiredAccountFields(['maxPhase', 'playerName', 'tree', 7])).toEqual(['tree', 'maxPhase']);
  });
});
