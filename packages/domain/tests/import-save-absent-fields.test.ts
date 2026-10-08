import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AccountPayload } from '@bombfarm/contracts';
import { scanRosterIssues } from '@bombfarm/domain/data-issues';
import { parseAccountPayload, parseSaveFile } from '@bombfarm/domain/import-save';

type Save = {
  heroes: Record<string, unknown>[];
  items: Record<string, unknown>[];
  skills: { totals: Record<string, unknown>; [key: string]: unknown };
  casa: Record<string, unknown>;
  [key: string]: unknown;
};

function loadSave(): Save {
  const path = join(__dirname, 'fixtures', 'sheet-math', 'save-20260813-5heroes.json');
  return JSON.parse(readFileSync(path, 'utf8')) as Save;
}

function withoutKey(record: Record<string, unknown>, key: string): void {
  Reflect.deleteProperty(record, key);
}

function firstHero(save: Save): Record<string, unknown> {
  const hero = save.heroes[0];
  if (!hero) throw new Error('fixture has no hero');
  return hero;
}

function gearWornBy(save: Save, heroId: unknown): Record<string, unknown> {
  const item = save.items.find((candidate) => candidate.equipped_on === heroId && candidate.category === 0);
  if (!item) throw new Error('fixture hero wears no gear');
  return item;
}

function blockedIds(save: Save): string[] {
  return parseSaveFile(save, [])
    .candidates.filter((candidate) => candidate.blocked)
    .map((candidate) => candidate.sourceId)
    .sort();
}

function firstHeroWithGear(save: Save): Record<string, unknown> {
  const hero = save.heroes.find((candidate) =>
    save.items.some((item) => item.equipped_on === candidate.id && item.category === 0),
  );
  if (!hero) throw new Error('fixture has no hero wearing gear');
  return hero;
}

const BLOCKED_BY_THE_CAPTURE_ITSELF = blockedIds(loadSave());

describe('a save from a game update that removed fields the importer reads', () => {
  it('blocks, as the control, only the heroes whose sheet the point inversion cannot explain', () => {
    expect(parseSaveFile(loadSave(), []).candidates.length).toBeGreaterThan(BLOCKED_BY_THE_CAPTURE_ITSELF.length);
  });

  it('imports every hero unblocked when only fields nothing reads are gone', () => {
    const save = loadSave();
    for (const hero of save.heroes) {
      for (const key of ['xp', 'skin_birth', 'in_market', 'slots', 'ability_points_total', 'ability_reroll_cost']) {
        withoutKey(hero, key);
      }
    }
    expect(parseSaveFile(save, []).rejected).toBeNull();
    expect(blockedIds(save)).toEqual(BLOCKED_BY_THE_CAPTURE_ITSELF);
  });

  it('blocks a hero with no level instead of importing it as level 1', () => {
    const save = loadSave();
    const hero = firstHero(save);
    withoutKey(hero, 'level');
    const candidate = parseSaveFile(save, []).candidates.find((entry) => entry.sourceId === hero.id);
    expect(candidate?.blocked).toBe(true);
    expect(candidate?.issues.join(' ')).toContain('level');
  });

  it('blocks a hero with no stars instead of importing it as unstarred', () => {
    const save = loadSave();
    const hero = firstHero(save);
    withoutKey(hero, 'stars');
    const candidate = parseSaveFile(save, []).candidates.find((entry) => entry.sourceId === hero.id);
    expect(candidate?.blocked).toBe(true);
    expect(candidate?.issues.join(' ')).toContain('stars');
  });

  it('blocks a hero with no stat_points_available instead of importing it as having none to spend', () => {
    const save = loadSave();
    const hero = firstHero(save);
    withoutKey(hero, 'stat_points_available');
    const candidate = parseSaveFile(save, []).candidates.find((entry) => entry.sourceId === hero.id);
    expect(candidate?.blocked).toBe(true);
    expect(candidate?.issues.join(' ')).toContain('stat_points_available');
  });

  it('blocks only the hero that lost a field, leaving the rest of the roster importable', () => {
    const save = loadSave();
    const hero = firstHero(save);
    withoutKey(hero, 'level');
    expect(blockedIds(save)).toEqual([...new Set([...BLOCKED_BY_THE_CAPTURE_ITSELF, String(hero.id)])].sort());
  });

  it('blocks a hero wearing a piece with no upgrade instead of importing the piece as unforged', () => {
    const save = loadSave();
    const hero = firstHero(save);
    withoutKey(gearWornBy(save, hero.id), 'upgrade');
    const candidate = parseSaveFile(save, []).candidates.find((entry) => entry.sourceId === hero.id);
    expect(candidate?.blocked).toBe(true);
    expect(candidate?.issues.join(' ')).toContain('upgrade');
  });

  it('keeps a gear piece with no level out of the optimizer pool instead of pooling it at level 10', () => {
    const save = loadSave();
    const spare = save.items.find((item) => item.category === 0 && item.equipped_on === null);
    if (!spare) throw new Error('fixture has no spare gear');
    const before = parseSaveFile(loadSave(), []).inventory.length;
    withoutKey(spare, 'level');
    const after = parseSaveFile(save, []);
    expect(after.inventory).toHaveLength(before - 1);
    expect(after.warnings.join(' ')).toContain('excluded from the pool');
  });

  it('reads a piece that lost equipped_on from the one hero whose slots name it, blocking nobody', () => {
    const save = loadSave();
    const hero = firstHeroWithGear(save);
    const piece = gearWornBy(save, hero.id);
    const before = parseAccountPayload(save as unknown as AccountPayload, []);
    withoutKey(piece, 'equipped_on');
    const after = parseAccountPayload(save as unknown as AccountPayload, []);
    expect(blockedIds(save)).toEqual(BLOCKED_BY_THE_CAPTURE_ITSELF);
    expect(after.candidates.find((entry) => entry.sourceId === hero.id)?.gearCount).toBe(
      before.candidates.find((entry) => entry.sourceId === hero.id)?.gearCount,
    );
    expect(after.inventory.find((entry) => entry.id === piece.id)?.equippedBy).toBe(String(hero.id));
  });

  it('leaves out only the piece that lost equipped_on when no hero names it, and says so', () => {
    const save = loadSave();
    const hero = firstHeroWithGear(save);
    const piece = gearWornBy(save, hero.id);
    const before = parseAccountPayload(save as unknown as AccountPayload, []);
    withoutKey(piece, 'equipped_on');
    for (const entry of save.heroes) entry.slots = [];
    const after = parseAccountPayload(save as unknown as AccountPayload, []);
    const gearBefore = before.candidates.find((entry) => entry.sourceId === hero.id)?.gearCount ?? 0;
    expect(after.candidates.find((entry) => entry.sourceId === hero.id)?.gearCount).toBe(gearBefore - 1);
    expect(after.inventory.some((entry) => entry.id === piece.id)).toBe(false);
    expect(after.candidates.filter((entry) => entry.blocked).map((entry) => entry.sourceId).sort()).toEqual(
      BLOCKED_BY_THE_CAPTURE_ITSELF,
    );
    expect(scanRosterIssues(save as unknown as AccountPayload).issues).toContainEqual({
      kind: 'gear_owner_unknown',
      section: 'items',
      keys: ['equipped_on'],
      itemId: String(piece.id),
    });
  });

  it('blocks a hero without birth stats alone while the others still compute, and names the hero', () => {
    const save = loadSave();
    const hero = firstHeroWithGear(save);
    withoutKey(hero, 'birth_stats');
    const { candidates, rejected } = parseAccountPayload(save as unknown as AccountPayload, []);
    expect(rejected).toBeNull();
    expect(candidates.filter((entry) => entry.blocked).map((entry) => entry.sourceId).sort()).toEqual(
      [...new Set([...BLOCKED_BY_THE_CAPTURE_ITSELF, String(hero.id)])].sort(),
    );
    expect(candidates.find((entry) => entry.sourceId === hero.id)?.record.birth).toBeUndefined();
    expect(scanRosterIssues(save as unknown as AccountPayload).issues).toContainEqual({
      kind: 'hero_field_absent',
      section: 'heroes',
      keys: ['birth_stats'],
      heroId: String(hero.id),
    });
  });

  it('still rejects a whole save file whose hero lacks birth stats, so the planner asks for a fresh export', () => {
    const save = loadSave();
    withoutKey(firstHero(save), 'birth_stats');
    expect(parseSaveFile(save, []).rejected?.reason).toBe('missingBirthStats');
  });

  it('withholds the tree and blocks every hero from point inversion when a required total is gone', () => {
    const save = loadSave();
    withoutKey(save.skills.totals, 'xp_mult');
    const { account, candidates } = parseAccountPayload(save as unknown as AccountPayload, []);
    expect(account.tree).toBeNull();
    expect(candidates.every((entry) => entry.blocked)).toBe(true);
  });

  it('warns when no item carries a category, since none of them can then be told to be gear', () => {
    const save = loadSave();
    for (const item of save.items) withoutKey(item, 'category');
    const { warnings } = parseSaveFile(save, []);
    expect(warnings.join(' ')).toContain('carry no category');
  });

  it('leaves the house level unknown when the levels list is gone, instead of reading level 1', () => {
    const save = loadSave();
    withoutKey(save.casa, 'levels');
    const { account } = parseSaveFile(save, []);
    expect(account.houseIdx).not.toBeNull();
    expect(account.houseLevel).toBeNull();
  });
});
