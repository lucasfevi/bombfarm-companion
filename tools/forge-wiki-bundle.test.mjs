import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const BUNDLE_PATH = resolve(root, 'packages/domain/src/data/forge-wiki.json');

// A companion-side guard over the COMMITTED forge bundle, the same arrangement as
// phase-wiki-bundle.test.mjs: it reads the source json, never dist/**, so it runs without a
// build, and a missing or unparseable file fails hard under CI instead of skipping.

function isTruthyCi(raw) {
  if (raw === undefined || raw === '') return false;
  const normalized = raw.toLowerCase();
  return normalized !== '0' && normalized !== 'false';
}

export function requireFixture(path, assertion, ciFlag) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    const message =
      `[forge-wiki-bundle] ${path} is missing or unparseable, so "${assertion}" cannot run: ` +
      `${err instanceof Error ? err.message : err}`;
    if (ciFlag) {
      throw new Error(message);
    }
    console.info(`${message} (skipping locally; CI=1 fails this hard.)`);
    return null;
  }
}

// Literals, never derived from the artifact under test.
const TOP_LEVEL_KEYS = ['bonus', 'chance', 'critical', 'custo_por_nivel', 'max', 'niveis', 'safe', 'upgrade_mult'];
const COST_ROW_KEYS = ['nivel', 'por_raridade'];
const RARITY_ROW_KEYS = ['custos', 'raridade'];
const TARGETS = 15;
const UPGRADE_LEVELS = 16;
const ITEM_LEVEL_ROWS = 30;
const RARITIES = 6;
const SAFE = 8;
const MAX = 15;

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

function lengthError(arr, expectedLength, label) {
  if (!Array.isArray(arr)) return `${label}: expected an array, got ${typeof arr}`;
  if (arr.length !== expectedLength) return `${label}.length: expected ${expectedLength}, got ${arr.length}`;
  return null;
}

function validateBundle(bundle) {
  const addedKeys = [];
  const removedKeys = [];
  const dimensionErrors = [];
  const valueErrors = [];

  const top = keySetErrors(bundle, TOP_LEVEL_KEYS, '(top level)');
  addedKeys.push(...top.added);
  removedKeys.push(...top.removed);

  const nullLeaves = [];
  walkForBadLeaves(bundle, '', nullLeaves);

  for (const [key, expectedLength] of [
    ['chance', TARGETS],
    ['critical', TARGETS],
    ['upgrade_mult', UPGRADE_LEVELS],
    ['niveis', ITEM_LEVEL_ROWS],
    ['custo_por_nivel', ITEM_LEVEL_ROWS],
  ]) {
    const error = lengthError(bundle?.[key], expectedLength, key);
    if (error) dimensionErrors.push(error);
  }

  if (Array.isArray(bundle?.custo_por_nivel)) {
    bundle.custo_por_nivel.forEach((row, rowIndex) => {
      const rowLabel = `custo_por_nivel[${rowIndex}]`;
      const rowKeys = keySetErrors(row, COST_ROW_KEYS, rowLabel);
      addedKeys.push(...rowKeys.added);
      removedKeys.push(...rowKeys.removed);
      const rarityError = lengthError(row?.por_raridade, RARITIES, `${rowLabel}.por_raridade`);
      if (rarityError) {
        dimensionErrors.push(rarityError);
        return;
      }
      row.por_raridade.forEach((byRarity, rarityIndex) => {
        const rarityLabel = `${rowLabel}.por_raridade[${rarityIndex}]`;
        const rarityKeys = keySetErrors(byRarity, RARITY_ROW_KEYS, rarityLabel);
        addedKeys.push(...rarityKeys.added);
        removedKeys.push(...rarityKeys.removed);
        const costError = lengthError(byRarity?.custos, TARGETS, `${rarityLabel}.custos`);
        if (costError) dimensionErrors.push(costError);
        if (byRarity?.raridade !== rarityIndex) {
          valueErrors.push(`${rarityLabel}.raridade: expected ${rarityIndex}, got ${byRarity?.raridade}`);
        }
      });
    });
    if (Array.isArray(bundle?.niveis)) {
      const rowLevels = bundle.custo_por_nivel.map((row) => row?.nivel);
      if (JSON.stringify(rowLevels) !== JSON.stringify(bundle.niveis)) {
        valueErrors.push(
          `niveis: expected the cost rows' nivel values in order ${JSON.stringify(rowLevels)}, got ${JSON.stringify(bundle.niveis)}`,
        );
      }
    }
  }

  if (bundle?.safe !== SAFE) valueErrors.push(`safe: expected ${SAFE}, got ${bundle?.safe}`);
  if (bundle?.max !== MAX) valueErrors.push(`max: expected ${MAX}, got ${bundle?.max}`);

  return { addedKeys, removedKeys, nullLeaves, dimensionErrors, valueErrors };
}

describe('committed forge-wiki.json guard', () => {
  it('the committed artifact passes every check: exact key sets, no null leaves, pinned dimensions, safe 8 and max 15', () => {
    const bundle = requireFixture(BUNDLE_PATH, 'forge-wiki.json structural guard', isTruthyCi(process.env.CI));
    if (!bundle) return;

    const result = validateBundle(bundle);
    expect(result.addedKeys, `added keys: ${result.addedKeys.join(', ')}`).toEqual([]);
    expect(result.removedKeys, `removed keys: ${result.removedKeys.join(', ')}`).toEqual([]);
    expect(result.nullLeaves, `null/undefined leaves: ${result.nullLeaves.join(', ')}`).toEqual([]);
    expect(result.dimensionErrors, `dimension errors: ${result.dimensionErrors.join(', ')}`).toEqual([]);
    expect(result.valueErrors, `value errors: ${result.valueErrors.join(', ')}`).toEqual([]);
  });

  describe('requireFixture is CI-hard, never a silent early return', () => {
    it('throws when CI is truthy and the path does not resolve', () => {
      expect(() => requireFixture(resolve(root, 'does/not/exist.json'), 'test', true)).toThrow();
    });

    it('returns null (with a console notice) when CI is falsy and the path does not resolve', () => {
      expect(requireFixture(resolve(root, 'does/not/exist.json'), 'test', false)).toBeNull();
    });
  });

  describe('demonstrated red states, each on an in-memory copy of the real bundle', () => {
    function loadRealBundle() {
      return JSON.parse(readFileSync(BUNDLE_PATH, 'utf8'));
    }

    it('an added key is reported, path-qualified', () => {
      const mutant = loadRealBundle();
      mutant.custo_por_nivel[3].por_raridade[2].extra = 1;
      expect(validateBundle(mutant).addedKeys).toContain('custo_por_nivel[3].por_raridade[2].extra');
    });

    it('a removed key is reported, path-qualified', () => {
      const mutant = loadRealBundle();
      delete mutant.critical;
      expect(validateBundle(mutant).removedKeys).toContain('(top level).critical');
    });

    it('a null leaf is reported with its dotted path', () => {
      const mutant = loadRealBundle();
      mutant.custo_por_nivel[0].por_raridade[0].custos[4] = null;
      const result = validateBundle(mutant);
      expect(result.nullLeaves).toContain('custo_por_nivel[0].por_raridade[0].custos[4]: null');
    });

    it('a cost row that lost a target is reported naming the row', () => {
      const mutant = loadRealBundle();
      mutant.custo_por_nivel[29].por_raridade[5].custos.pop();
      expect(validateBundle(mutant).dimensionErrors).toContain(
        'custo_por_nivel[29].por_raridade[5].custos.length: expected 15, got 14',
      );
    });

    it('niveis that no longer match the cost rows is reported', () => {
      const mutant = loadRealBundle();
      mutant.niveis[0] = 15;
      expect(validateBundle(mutant).valueErrors.some((error) => error.startsWith('niveis:'))).toBe(true);
    });

    it('a moved safe level is reported', () => {
      const mutant = loadRealBundle();
      mutant.safe = 9;
      expect(validateBundle(mutant).valueErrors).toContain('safe: expected 8, got 9');
    });

    it('none of the red states above appear on the unmutated bundle', () => {
      const result = validateBundle(loadRealBundle());
      expect(result.addedKeys).toEqual([]);
      expect(result.removedKeys).toEqual([]);
      expect(result.nullLeaves).toEqual([]);
      expect(result.dimensionErrors).toEqual([]);
      expect(result.valueErrors).toEqual([]);
    });
  });
});
