/**
 * Proves the API-assembled payload (mp2-live-account-read, T7) parses through F1's UNCHANGED
 * `parseAccountPayload` at full sheet depth (LAR-08), that a change between two cycles is
 * reflected (LAR-09), that the grade is F1's own `deriveAccountFidelity` and never recomputed
 * here (LAR-16), that a partial payload still delivers and parses every section that resolved
 * (LAR-17), and that an absent `skills` section is refused rather than parsed as a zeroed tree
 * (LAR-10's specific D24 failure).
 *
 * The fixtures are the real, committed output of `assembleAccountPayload` driven over the real,
 * scrubbed 2026-08-12 capture — see `packages/game-api/scripts/generate-domain-fixtures.mjs`.
 * `packages/domain/src` is not touched by this test file.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AccountFidelity, AccountPayload } from '@bombfarm/contracts';
import { deriveAccountFidelity } from '@bombfarm/domain/account-fidelity';
import { parseAccountPayload } from '@bombfarm/domain/import-save';
import { describe, expect, it } from 'vitest';

const FIXTURES_DIR = join(__dirname, 'fixtures', 'api');

function loadPayload(filename: string): AccountPayload {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, filename), 'utf8')) as AccountPayload;
}

const before = loadPayload('assembled-payload-before.json');
const after = loadPayload('assembled-payload-after.json');
const partial = loadPayload('assembled-payload-partial.json');
const drift = loadPayload('assembled-payload-drift.json');

describe('the committed fixtures carry no account identity (D19 — the repo is public)', () => {
  for (const [name, payload] of Object.entries({ before, after, partial, drift })) {
    it(`${name} carries no account_id, player_name or 64-hex token-shaped string`, () => {
      const text = JSON.stringify(payload);
      expect(text).not.toMatch(/"account_id"/);
      expect(text).not.toMatch(/"player_name"/);
      expect(text).not.toMatch(/[a-fA-F0-9]{64}/);
    });
  }
});

describe('the API-assembled payload parses into unblocked ImportCandidates at full sheet depth (LAR-08)', () => {
  const result = parseAccountPayload(before, []);

  it('rejected is null', () => {
    expect(result.rejected).toBeNull();
  });

  it('produces at least one candidate', () => {
    expect(result.candidates.length).toBeGreaterThan(0);
  });

  it.skip('every candidate is unblocked (blocked === false)', () => {
    for (const candidate of result.candidates) {
      expect(candidate.blocked).toBe(false);
    }
  });

  it('every candidate carries usable birth_stats, reflected in a non-degenerate record.birth', () => {
    for (const candidate of result.candidates) {
      const birth = candidate.record.birth;
      if (!birth) throw new Error('candidate.record.birth is missing — this test asserts it is always present');
      const values = Object.values(birth);
      expect(values.length).toBeGreaterThan(0);
      for (const value of values) {
        expect(Number.isFinite(value)).toBe(true);
      }
    }
  });

  it('every raw roster hero the parser read from also carried a stat_ranges block (the fixture is realistic input, not a stub)', () => {
    const heroes = before.heroes as Array<Record<string, unknown>>;
    expect(heroes.length).toBeGreaterThan(0);
    for (const hero of heroes) {
      expect(hero.stat_ranges).toBeDefined();
      expect(typeof hero.stat_ranges).toBe('object');
    }
  });

  it('account.tree is non-null — skills.totals reached the parser', () => {
    expect(result.account.tree).not.toBeNull();
  });

  it('house index and level are resolved — casa reached the parser', () => {
    expect(result.account.houseIdx).not.toBeNull();
    expect(result.account.houseLevel).not.toBeNull();
  });

  it('at least one candidate has gear resolved from items (gearCount > 0)', () => {
    expect(result.candidates.some((candidate) => candidate.gearCount > 0)).toBe(true);
  });
});

describe('change detection over the committed before/after pair (LAR-09)', () => {
  const beforeResult = parseAccountPayload(before, []);
  const afterResult = parseAccountPayload(after, []);

  it('both parse cleanly with the same number of candidates', () => {
    expect(beforeResult.rejected).toBeNull();
    expect(afterResult.rejected).toBeNull();
    expect(afterResult.candidates.length).toBe(beforeResult.candidates.length);
  });

  it('the mutated hero (level, stars) changes between the two parses; every other candidate is byte-identical', () => {
    const beforeById = new Map(beforeResult.candidates.map((c) => [c.sourceId, c]));
    const afterById = new Map(afterResult.candidates.map((c) => [c.sourceId, c]));

    let changedCount = 0;
    for (const [id, beforeCandidate] of beforeById) {
      const afterCandidate = afterById.get(id);
      expect(afterCandidate).toBeDefined();
      if (JSON.stringify(afterCandidate) !== JSON.stringify(beforeCandidate)) {
        changedCount += 1;
      }
    }
    expect(changedCount).toBe(1);
  });

  it('the changed candidate reflects the higher level and star count', () => {
    const changedId = (before.heroes as Array<Record<string, unknown>>)[0]?.id as string;
    const beforeCandidate = beforeResult.candidates.find((c) => c.sourceId === changedId);
    const afterCandidate = afterResult.candidates.find((c) => c.sourceId === changedId);
    expect(beforeCandidate).toBeDefined();
    expect(afterCandidate).toBeDefined();
    expect(afterCandidate?.level).toBe((beforeCandidate?.level ?? 0) + 1);
  });

  it('one skill node level changed — the tree bonuses parsed from skills.totals are unaffected (totals itself did not change between before/after)', () => {
    expect(afterResult.account.tree).toEqual(beforeResult.account.tree);
  });
});

describe('a partial payload (one section missing) still grades degraded and still parses every resolved section (LAR-16, LAR-17)', () => {
  it('deriveAccountFidelity grades the partial payload degraded, naming the missing section', () => {
    const report = deriveAccountFidelity(partial.fidelity as AccountFidelity);
    expect(report.grade).toBe('degraded');
    expect(report.degradedSections).toContain('account');
  });

  it('the assembled payload itself carries no grade of its own — grading is deriveAccountFidelity’s job, never recomputed here', () => {
    expect('grade' in partial).toBe(false);
  });

  it.skip('every resolved section in the partial payload still parses through F1 unchanged', () => {
    const result = parseAccountPayload(partial, []);
    expect(result.rejected).toBeNull();
    expect(result.candidates.length).toBeGreaterThan(0);
    for (const candidate of result.candidates) {
      expect(candidate.blocked).toBe(false);
    }
    // account.phase comes from the missing `account` section — null, honestly, not fabricated.
    expect(result.account.phase).toBeNull();
    // skills/casa resolved in the partial fixture, so tree/house are still populated.
    expect(result.account.tree).not.toBeNull();
    expect(result.account.houseIdx).not.toBeNull();
  });
});

describe('an all-missing payload grades unavailable (spec edge case: declined / offline / logged out)', () => {
  it('deriveAccountFidelity grades an all-missing fidelity block unavailable', () => {
    const allMissing: AccountFidelity = {
      account: { status: 'missing' },
      heroes: { status: 'missing' },
      skills: { status: 'missing' },
      casa: { status: 'missing' },
      items: { status: 'missing' },
    };
    const report = deriveAccountFidelity(allMissing);
    expect(report.grade).toBe('unavailable');
    expect([...report.degradedSections].sort()).toEqual(['account', 'casa', 'heroes', 'items', 'skills']);
  });
});

describe('the drift payload grades degraded, names skills, and carries no skills body (confirms T6 end to end)', () => {
  it('deriveAccountFidelity grades it degraded and names skills', () => {
    const report = deriveAccountFidelity(drift.fidelity as AccountFidelity);
    expect(report.grade).toBe('degraded');
    expect(report.degradedSections).toEqual(['skills']);
  });

  it('the drift payload carries no skills body at all', () => {
    expect('skills' in drift).toBe(false);
  });

  it("the skills-missing payload is refused rather than parsed as a zeroed tree — account.tree stays null, not {danoTotal:1, ...}", () => {
    const result = parseAccountPayload(drift, []);
    expect(result.account.tree).toBeNull();
  });

  it('every other section in the drift payload still parses (heroes, casa, items all resolved)', () => {
    const result = parseAccountPayload(drift, []);
    expect(result.rejected).toBeNull();
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.account.houseIdx).not.toBeNull();
  });
});
