import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const BUNDLE_PATH = resolve(root, 'packages/domain/src/data/phase-wiki.json');

// ---------------------------------------------------------------------------
// A companion-side guard over the COMMITTED artifact
// (packages/domain/src/data/phase-wiki.json) -- the emit-side guard
// (tools/wiki-emit-phase-bundle.mjs, maintained out of band) protects the *emit*; this protects
// the *artifact actually shipped in this repo*, which is what a stray hand-edit or a bad merge
// would corrupt without ever running the emitter again. Reads the SOURCE json, never dist/**,
// so it runs without a build (mirrors apps/web/src/tests/support/build-output.ts's convention,
// but the source json is a checked-in file that should never legitimately be absent -- the
// requireFixture-style gate below exists for the CI=1 hard-failure guarantee, not
// because a missing file is expected).
// ---------------------------------------------------------------------------

/** GitHub Actions sets `CI=true`; be liberal about what other runners set. */
function isTruthyCi(raw) {
  if (raw === undefined || raw === '') return false;
  const normalized = raw.toLowerCase();
  return normalized !== '0' && normalized !== 'false';
}

/**
 * Absent/unparseable artifact must fail HARD under CI, never a silent skip. `ciFlag` is
 * injected (rather than read from `process.env.CI` inside this function) so both branches are
 * unit-testable below without mutating the real environment mid-run.
 */
export function requireFixture(path, assertion, ciFlag) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    const message =
      `[phase-wiki-bundle] ${path} is missing or unparseable, so "${assertion}" cannot run: ` +
      `${err instanceof Error ? err.message : err}`;
    if (ciFlag) {
      throw new Error(message);
    }
    console.info(`${message} (skipping locally; CI=1 fails this hard.)`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Written-down, complete key sets. Literals -- never derived from the artifact under test:
// a comparison sourced from the thing it checks cannot fail.
// ---------------------------------------------------------------------------
const TOP_LEVEL_KEYS = [
  'syncedAt',
  'sourcePulledAt',
  'emittedAt',
  'source',
  'props',
  'propsPorAto',
  'bossHpMult',
  'repHpMult',
  'jaula',
  'heroChestRarityByAto',
  'chestRarityDist',
  'drops',
  'timechestRarityByAto',
  'gems',
  'lootAbilities',
  'itemPorFase',
  'xpFaseIni',
  'xpFaseFim',
  'gateSecsPorAto',
  'atoLabels',
  'phaseNames',
  'lines',
];
const DROPS_KEYS = [
  'chestDropRate',
  'keyDropRate',
  'gemChestDropRate',
  'timechestDropRate',
  // XP-multiplier / drop-chances feature: the stone-chest drop rate (`DROP_RATES.stone` in
  // `packages/domain/src/phase-wiki.ts`, live wiki key `pedra.drop_rate`) — the fifth and last
  // per-prop drop-chance rate `phase-intel.ts`'s `DropChanceRow` reads.
  'stoneChestDropRate',
  'keyGateCost',
  'bonusAdd',
  'bonusAddVip',
  'bonusCapSecs',
];
const GEMS_KEYS = ['chestDropRate', 'perRank', 'rankDistByAto', 'list'];
const GEMS_LIST_ITEM_KEYS = ['defId', 'name', 'rank', 'rarity'];
const LOOT_ABILITIES_KEYS = ['veia_ouro', 'fortuna', 'olho_lapidador'];
const LOOT_ABILITY_ITEM_KEYS = ['code', 'kind', 'perLevel', 'maxLevel'];
const JAULA_KEYS = ['adiantaProbPorAto', 'janelaSecs', 'janelaSecsVip', 'hpMult'];
const LINE_KEYS = ['phase', 'hp', 'mitig', 'goldComum', 'gate', 'ato', 'mundo', 'estrela', 'xpProp'];
const PROP_KEYS = ['name', 'hpMult', 'weight', 'rarity'];
const ITEM_POR_FASE_KEYS = ['min', 'max', 'itemLevel'];

/** The committed bundle's syncedAt immediately before this feature's re-emit landed. A
 *  literal, not read from git — a re-emit may not move the artifact backwards in time. */
const PREVIOUS_SYNCED_AT = '2026-08-03';

function keySetErrors(obj, expectedKeys, pathLabel) {
  const added = [];
  const removed = [];
  const actual = new Set(Object.keys(obj ?? {}));
  const expected = new Set(expectedKeys);
  for (const key of actual) {
    if (!expected.has(key)) added.push(`${pathLabel}.${key}`);
  }
  for (const key of expected) {
    if (!actual.has(key)) removed.push(`${pathLabel}.${key}`);
  }
  return { added, removed };
}

function arrayKeySetErrors(arr, expectedKeys, pathLabel) {
  const added = [];
  const removed = [];
  (arr ?? []).forEach((item, index) => {
    const result = keySetErrors(item, expectedKeys, `${pathLabel}[${index}]`);
    added.push(...result.added);
    removed.push(...result.removed);
  });
  return { added, removed };
}

function walkForBadLeaves(value, path, out) {
  if (value === undefined || value === null) {
    out.push(`${path || '(root)'}: ${value === undefined ? 'undefined' : 'null'}`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkForBadLeaves(item, `${path}[${index}]`, out));
    return;
  }
  if (typeof value === 'object') {
    for (const [key, val] of Object.entries(value)) {
      walkForBadLeaves(val, path ? `${path}.${key}` : key, out);
    }
  }
}

/** Every element in [0,1], row sums to 1 within 1e-9, row is of the declared length. */
function distributionRowErrors(row, expectedLength, label) {
  const errors = [];
  if (!Array.isArray(row) || row.length !== expectedLength) {
    errors.push(
      `${label}: expected an array of length ${expectedLength}, got ` +
        (Array.isArray(row) ? `array of length ${row.length}` : typeof row),
    );
    return errors;
  }
  let sum = 0;
  for (let i = 0; i < row.length; i++) {
    const value = row[i];
    if (typeof value !== 'number' || value < 0 || value > 1) {
      errors.push(`${label}[${i}]: expected a number in [0,1], got ${JSON.stringify(value)}`);
    } else {
      sum += value;
    }
  }
  if (Math.abs(sum - 1) > 1e-9) {
    errors.push(`${label}: row sums to ${sum}, expected 1 (within 1e-9)`);
  }
  return errors;
}

/**
 * The full guard, run against a parsed bundle object. Pure function so it is testable against
 * both the real committed artifact and an in-memory mutated copy (the four demonstrated red
 * states below) without ever touching the file on disk twice.
 */
function validateBundle(bundle) {
  const addedKeys = [];
  const removedKeys = [];
  const distributionErrors = [];
  const dimensionErrors = [];
  const syncedAtErrors = [];

  const top = keySetErrors(bundle, TOP_LEVEL_KEYS, '(top level)');
  addedKeys.push(...top.added);
  removedKeys.push(...top.removed);

  if (bundle?.drops) {
    const r = keySetErrors(bundle.drops, DROPS_KEYS, 'drops');
    addedKeys.push(...r.added);
    removedKeys.push(...r.removed);
  }
  if (bundle?.gems) {
    const r = keySetErrors(bundle.gems, GEMS_KEYS, 'gems');
    addedKeys.push(...r.added);
    removedKeys.push(...r.removed);
    const listResult = arrayKeySetErrors(bundle.gems.list, GEMS_LIST_ITEM_KEYS, 'gems.list');
    addedKeys.push(...listResult.added);
    removedKeys.push(...listResult.removed);
  }
  if (bundle?.lootAbilities) {
    const r = keySetErrors(bundle.lootAbilities, LOOT_ABILITIES_KEYS, 'lootAbilities');
    addedKeys.push(...r.added);
    removedKeys.push(...r.removed);
    for (const code of LOOT_ABILITIES_KEYS) {
      if (bundle.lootAbilities[code]) {
        const itemResult = keySetErrors(
          bundle.lootAbilities[code],
          LOOT_ABILITY_ITEM_KEYS,
          `lootAbilities.${code}`,
        );
        addedKeys.push(...itemResult.added);
        removedKeys.push(...itemResult.removed);
      }
    }
  }
  if (bundle?.jaula) {
    const r = keySetErrors(bundle.jaula, JAULA_KEYS, 'jaula');
    addedKeys.push(...r.added);
    removedKeys.push(...r.removed);
  }
  if (Array.isArray(bundle?.lines)) {
    const r = arrayKeySetErrors(bundle.lines, LINE_KEYS, 'lines');
    addedKeys.push(...r.added);
    removedKeys.push(...r.removed);
  }
  if (Array.isArray(bundle?.props)) {
    const r = arrayKeySetErrors(bundle.props, PROP_KEYS, 'props');
    addedKeys.push(...r.added);
    removedKeys.push(...r.removed);
  }
  if (Array.isArray(bundle?.itemPorFase)) {
    const r = arrayKeySetErrors(bundle.itemPorFase, ITEM_POR_FASE_KEYS, 'itemPorFase');
    addedKeys.push(...r.added);
    removedKeys.push(...r.removed);
  }

  const nullLeaves = [];
  walkForBadLeaves(bundle, '', nullLeaves);

  if (Array.isArray(bundle?.chestRarityDist)) {
    distributionErrors.push(...distributionRowErrors(bundle.chestRarityDist, 6, 'chestRarityDist'));
  }
  if (Array.isArray(bundle?.heroChestRarityByAto)) {
    bundle.heroChestRarityByAto.forEach((row, i) => {
      distributionErrors.push(...distributionRowErrors(row, 6, `heroChestRarityByAto[${i}]`));
    });
  }
  if (Array.isArray(bundle?.timechestRarityByAto)) {
    bundle.timechestRarityByAto.forEach((row, i) => {
      distributionErrors.push(...distributionRowErrors(row, 6, `timechestRarityByAto[${i}]`));
    });
  }
  if (Array.isArray(bundle?.gems?.rankDistByAto)) {
    bundle.gems.rankDistByAto.forEach((row, i) => {
      distributionErrors.push(...distributionRowErrors(row, 3, `gems.rankDistByAto[${i}]`));
    });
  }

  if (Array.isArray(bundle?.lines) && bundle.lines.length !== 600) {
    dimensionErrors.push(`lines.length: expected 600, got ${bundle.lines.length}`);
  }
  if (Array.isArray(bundle?.props) && bundle.props.length !== 10) {
    dimensionErrors.push(`props.length: expected 10, got ${bundle.props.length}`);
  }
  if (Array.isArray(bundle?.gems?.list) && bundle.gems.list.length !== 9) {
    dimensionErrors.push(`gems.list.length: expected 9, got ${bundle.gems.list.length}`);
  }
  if (Array.isArray(bundle?.heroChestRarityByAto) && bundle.heroChestRarityByAto.length !== 5) {
    dimensionErrors.push(
      `heroChestRarityByAto.length: expected 5, got ${bundle.heroChestRarityByAto.length}`,
    );
  }
  if (Array.isArray(bundle?.timechestRarityByAto) && bundle.timechestRarityByAto.length !== 5) {
    dimensionErrors.push(
      `timechestRarityByAto.length: expected 5, got ${bundle.timechestRarityByAto.length}`,
    );
  }
  if (Array.isArray(bundle?.gems?.rankDistByAto) && bundle.gems.rankDistByAto.length !== 5) {
    dimensionErrors.push(
      `gems.rankDistByAto.length: expected 5, got ${bundle.gems.rankDistByAto.length}`,
    );
  }
  if (bundle?.lootAbilities && Object.keys(bundle.lootAbilities).length !== 3) {
    dimensionErrors.push(
      `Object.keys(lootAbilities).length: expected 3, got ${Object.keys(bundle.lootAbilities).length}`,
    );
  }
  if (Array.isArray(bundle?.propsPorAto) && bundle.propsPorAto.length !== 5) {
    dimensionErrors.push(`propsPorAto.length: expected 5, got ${bundle.propsPorAto.length}`);
  }
  if (Array.isArray(bundle?.gateSecsPorAto) && bundle.gateSecsPorAto.length !== 5) {
    dimensionErrors.push(`gateSecsPorAto.length: expected 5, got ${bundle.gateSecsPorAto.length}`);
  }

  if (typeof bundle?.syncedAt === 'string') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(bundle.syncedAt)) {
      syncedAtErrors.push(`syncedAt: "${bundle.syncedAt}" does not match YYYY-MM-DD`);
    } else if (Number.isNaN(Date.parse(bundle.syncedAt))) {
      syncedAtErrors.push(`syncedAt: "${bundle.syncedAt}" does not parse to a real date`);
    } else if (bundle.syncedAt < PREVIOUS_SYNCED_AT) {
      syncedAtErrors.push(
        `syncedAt: "${bundle.syncedAt}" is earlier than the previously committed "${PREVIOUS_SYNCED_AT}"`,
      );
    }
  } else {
    syncedAtErrors.push(`syncedAt: expected a string, got ${typeof bundle?.syncedAt}`);
  }
  if (typeof bundle?.sourcePulledAt === 'string' && Number.isNaN(Date.parse(bundle.sourcePulledAt))) {
    syncedAtErrors.push(`sourcePulledAt: "${bundle.sourcePulledAt}" does not parse as ISO`);
  }
  if (typeof bundle?.emittedAt === 'string') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(bundle.emittedAt)) {
      syncedAtErrors.push(`emittedAt: "${bundle.emittedAt}" does not match YYYY-MM-DD`);
    } else if (typeof bundle?.syncedAt === 'string' && bundle.emittedAt < bundle.syncedAt) {
      syncedAtErrors.push(
        `emittedAt: "${bundle.emittedAt}" is earlier than syncedAt "${bundle.syncedAt}"`,
      );
    }
  }

  return { addedKeys, removedKeys, nullLeaves, distributionErrors, dimensionErrors, syncedAtErrors };
}

describe('committed phase-wiki.json guard', () => {
  it('the committed artifact passes every check: exact key sets, no null leaves, valid distributions, pinned dimensions, monotonic syncedAt', () => {
    const bundle = requireFixture(BUNDLE_PATH, 'phase-wiki.json structural guard', isTruthyCi(process.env.CI));
    if (!bundle) return; // local-only skip path; CI=1 always throws above instead.

    const result = validateBundle(bundle);
    expect(result.addedKeys, `added keys: ${result.addedKeys.join(', ')}`).toEqual([]);
    expect(result.removedKeys, `removed keys: ${result.removedKeys.join(', ')}`).toEqual([]);
    expect(result.nullLeaves, `null/undefined leaves: ${result.nullLeaves.join(', ')}`).toEqual([]);
    expect(
      result.distributionErrors,
      `distribution errors: ${result.distributionErrors.join(', ')}`,
    ).toEqual([]);
    expect(result.dimensionErrors, `dimension errors: ${result.dimensionErrors.join(', ')}`).toEqual(
      [],
    );
    expect(result.syncedAtErrors, `syncedAt errors: ${result.syncedAtErrors.join(', ')}`).toEqual([]);
  });

  describe('requireFixture is CI-hard, never a silent early return', () => {
    it('throws when CI is truthy and the path does not resolve', () => {
      expect(() => requireFixture(resolve(root, 'does/not/exist.json'), 'test', true)).toThrow();
    });

    it('returns null (with a console notice) when CI is falsy and the path does not resolve', () => {
      const value = requireFixture(resolve(root, 'does/not/exist.json'), 'test', false);
      expect(value).toBeNull();
    });

    it('isTruthyCi treats "1"/"true" as CI and ""/"0"/"false"/undefined as not-CI', () => {
      expect(isTruthyCi('1')).toBe(true);
      expect(isTruthyCi('true')).toBe(true);
      expect(isTruthyCi('0')).toBe(false);
      expect(isTruthyCi('false')).toBe(false);
      expect(isTruthyCi('')).toBe(false);
      expect(isTruthyCi(undefined)).toBe(false);
    });
  });

  // Four demonstrated red states, each against an in-memory mutated deep clone of the
  // REAL committed bundle (never the committed file itself) — the artifact on disk is never
  // touched by these.
  describe('four demonstrated red states', () => {
    function loadRealBundle() {
      return JSON.parse(readFileSync(BUNDLE_PATH, 'utf8'));
    }

    it('(a) an added key is reported in the added collection, path-qualified', () => {
      const mutant = loadRealBundle();
      mutant.drops.somethingNew = 1;
      const result = validateBundle(mutant);
      expect(result.addedKeys).toContain('drops.somethingNew');
      expect(result.removedKeys).not.toContain('drops.somethingNew');
    });

    it('(b) a removed key is reported in the removed collection, path-qualified', () => {
      const mutant = loadRealBundle();
      delete mutant.gems.perRank;
      const result = validateBundle(mutant);
      expect(result.removedKeys).toContain('gems.perRank');
    });

    it('(c) a null leaf is reported with its dotted path', () => {
      const mutant = loadRealBundle();
      mutant.jaula.janelaSecs = null;
      const result = validateBundle(mutant);
      expect(result.nullLeaves.some((leaf) => leaf.startsWith('jaula.janelaSecs:'))).toBe(true);
    });

    it('(d) a distribution row that no longer sums to 1 is reported naming its row index', () => {
      const mutant = loadRealBundle();
      mutant.gems.rankDistByAto[2] = [...mutant.gems.rankDistByAto[2]];
      mutant.gems.rankDistByAto[2][0] += 1e-6;
      const result = validateBundle(mutant);
      expect(
        result.distributionErrors.some((err) => err.startsWith('gems.rankDistByAto[2]')),
      ).toBe(true);
    });

    it('the four red states above do not appear when validating the unmutated real bundle', () => {
      const result = validateBundle(loadRealBundle());
      expect(result.addedKeys).toEqual([]);
      expect(result.removedKeys).toEqual([]);
      expect(result.nullLeaves).toEqual([]);
      expect(result.distributionErrors).toEqual([]);
    });
  });
});
