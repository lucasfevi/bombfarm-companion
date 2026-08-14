/**
 * PFR item B, T3 — `account.max_phase` through the import path (`R-B15`, `spec.md` P1-6).
 *
 * `mapAccountMaxPhase` (import-save.ts) reads `account.max_phase` primary, `skills.max_phase`
 * fallback, normalizes to an integer in `[1, WIKI_PHASE_LINES.length]`, and reports `null` when
 * neither source is a finite number > 0 or when the whole file is rejected. This suite proves
 * every branch named in `design.md` §5.1 and `spec.md`'s P1-6 acceptance criteria; the `locked`
 * row-mapping half of R-B15 (AC-5) is added at T6 once `computeFarmRateTable` exists.
 */
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseAccountPayload, parseSaveFile } from '@bombfarm/domain/import-save';
import {
  computeHeroFarmFacts,
  computeSquadFarmFacts,
  computeFarmRateTable,
} from '@bombfarm/domain/farm-rate';
import { requireFixture } from './helpers/require-fixture';
import { loadFarmRateFixture } from './helpers/farm-rate-fixtures';

const DOMAIN_ROOT = join(__dirname, '..');
const FIXTURE_PATH = join(DOMAIN_ROOT, 'tests/fixtures/sheet-math/save-20260813-5heroes.json');

function loadFixture(): Record<string, unknown> | null {
  if (!requireFixture(FIXTURE_PATH, 'farm-rate-max-phase fixture corpus')) return null;
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as Record<string, unknown>;
}

describe('account.max_phase — the fixture, both entry points (spec.md P1-6 AC-1)', () => {
  const raw = loadFixture();

  it('parseAccountPayload(save-20260813-5heroes.json).account.maxPhase === 42', () => {
    if (!raw) return;
    const result = parseAccountPayload(raw, []);
    expect(result.account.maxPhase).toBe(42);
  });

  it('parseSaveFile(save-20260813-5heroes.json).account.maxPhase === 42 (same reader, file entry point)', () => {
    if (!raw) return;
    const result = parseSaveFile(raw, []);
    expect(result.account.maxPhase).toBe(42);
  });
});

describe('account.max_phase — source precedence (spec.md P1-6 AC-2)', () => {
  it('account.max_phase present ⇒ used', () => {
    const result = parseAccountPayload({ heroes: [], account: { max_phase: 55 } }, []);
    expect(result.account.maxPhase).toBe(55);
  });

  it('account.max_phase absent, skills.max_phase present ⇒ the skills value is used', () => {
    const result = parseAccountPayload({ heroes: [], skills: { max_phase: 33 } }, []);
    expect(result.account.maxPhase).toBe(33);
  });

  it('neither source present ⇒ null', () => {
    const result = parseAccountPayload({ heroes: [] }, []);
    expect(result.account.maxPhase).toBeNull();
  });

  it('account.max_phase present but not a finite number (null) ⇒ falls back to skills.max_phase', () => {
    const result = parseAccountPayload(
      { heroes: [], account: { max_phase: null }, skills: { max_phase: 33 } },
      [],
    );
    expect(result.account.maxPhase).toBe(33);
  });

  it('account.max_phase present but not a finite number (string) ⇒ falls back to skills.max_phase', () => {
    const result = parseAccountPayload(
      { heroes: [], account: { max_phase: 'forty-two' }, skills: { max_phase: 33 } },
      [],
    );
    expect(result.account.maxPhase).toBe(33);
  });

  it('account.max_phase present but not a finite number (NaN) ⇒ falls back to skills.max_phase', () => {
    const result = parseAccountPayload(
      { heroes: [], account: { max_phase: NaN }, skills: { max_phase: 33 } },
      [],
    );
    expect(result.account.maxPhase).toBe(33);
  });
});

describe('account.max_phase — normalization (spec.md P1-6 AC-3)', () => {
  it('non-integer 41.7 rounds to 42', () => {
    const result = parseAccountPayload({ heroes: [], account: { max_phase: 41.7 } }, []);
    expect(result.account.maxPhase).toBe(42);
  });

  it('0 normalizes to null (not a valid phase)', () => {
    const result = parseAccountPayload({ heroes: [], account: { max_phase: 0 } }, []);
    expect(result.account.maxPhase).toBeNull();
  });

  it('-3 normalizes to null', () => {
    const result = parseAccountPayload({ heroes: [], account: { max_phase: -3 } }, []);
    expect(result.account.maxPhase).toBeNull();
  });

  it('900 clamps to 600 (WIKI_PHASE_LINES.length), never emitted raw', () => {
    const result = parseAccountPayload({ heroes: [], account: { max_phase: 900 } }, []);
    expect(result.account.maxPhase).toBe(600);
  });

  it('Infinity is not finite ⇒ null', () => {
    const result = parseAccountPayload({ heroes: [], account: { max_phase: Infinity } }, []);
    expect(result.account.maxPhase).toBeNull();
  });
});

describe('account.max_phase — rejection paths yield null (spec.md P1-6 AC-4)', () => {
  it('notASaveFile ⇒ maxPhase null, matching EMPTY_ACCOUNT_DATA', () => {
    const result = parseSaveFile({ not_a_save: true, max_phase: 99 }, []);
    expect(result.rejected?.reason).toBe('notASaveFile');
    expect(result.account.maxPhase).toBeNull();
  });

  it('missingBirthStats ⇒ maxPhase null even though the raw payload carries a value', () => {
    const payload = {
      heroes: [{ name: 'NoBirth' }],
      skills: { refunds: 0, totals: { vagas_campo: 0, bag_tabs_bonus: 0 }, max_phase: 99 },
      account: { max_phase: 99 },
    };
    const result = parseSaveFile(payload, []);
    expect(result.rejected?.reason).toBe('missingBirthStats');
    expect(result.account.maxPhase).toBeNull();
  });

  it('unsupportedSaveShape ⇒ maxPhase null even though the raw payload carries a value', () => {
    const payload = { heroes: [], account: { max_phase: 99 } };
    const result = parseSaveFile(payload, []);
    expect(result.rejected?.reason).toBe('unsupportedSaveShape');
    expect(result.account.maxPhase).toBeNull();
  });
});

describe('FarmRateRow.locked — the maxPhase → row mapping (R-B15 AC-5, added at T6)', () => {
  const { heroes, account } = loadFarmRateFixture();
  const heroFacts = computeHeroFarmFacts({ heroes, account });
  const squad = computeSquadFarmFacts(heroFacts, account);

  it('maxPhase: 42 ⇒ row 42 is unlocked (false) and row 43 is locked (true)', () => {
    const rows = computeFarmRateTable(squad, { maxPhase: 42 });
    expect(rows.find((r) => r.phase === 42)!.locked).toBe(false);
    expect(rows.find((r) => r.phase === 43)!.locked).toBe(true);
  });

  it('maxPhase omitted ⇒ every row locked: false', () => {
    const rows = computeFarmRateTable(squad);
    expect(rows.every((r) => r.locked === false)).toBe(true);
  });

  it('maxPhase: null ⇒ every row locked: false (explicit null, same as omitted)', () => {
    const rows = computeFarmRateTable(squad, { maxPhase: null });
    expect(rows.every((r) => r.locked === false)).toBe(true);
  });
});
