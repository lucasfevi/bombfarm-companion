// Privacy guard: no committed fixture may carry player identity. `docs/SAVE_EXPORT.md`
// classifies `account_id` and `player_name` as personal-but-not-secret — the save export
// carries no auth token, so this is not a credential leak, but the repo is public and there
// is no reason for the values to be in it.
//
// Already enforced this for its own capture pair (`loadFidelityPair` throws
// `unscrubbedFixture`), which left the legacy `sheet-math` fixtures as the inconsistent
// case. This walks the whole fixtures tree instead of a named list, so a
// future capture dropped into any fixture directory is covered without editing this test.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PERSONAL_FIELDS } from './helpers/fidelity-pair';

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(here, 'fixtures');

// `fidelity-gate/pair.json` is a *manifest*, not a capture: it names the two fields in its
// `scrubbed` provenance list to attest the scrub happened. That is the one legitimate
// mention in the tree, and the second test below pins it so this exemption stays honest.
const MANIFEST_FILES = new Set(['pair.json']);

// The 2026-09-14 exports REPLACE the two fields with placeholders instead of removing them, so
// the export fingerprint's `allowance` escape is witnessed present and not just absent. A
// placeholder carries no identity, but only these exact values pass: the check below runs on
// the parsed `account` object, so a real id, a blank string, or a placeholder anywhere else in
// the file is still an offender. Adding a capture with a new placeholder means registering it
// here, in the open.
const REGISTERED_PLACEHOLDERS: Readonly<Record<(typeof PERSONAL_FIELDS)[number], ReadonlySet<unknown>>> = {
  account_id: new Set([900001, 900002]),
  player_name: new Set(['Fixture Alpha', 'Fixture Beta']),
};

function carriesOnlyRegisteredPlaceholder(content: string, field: (typeof PERSONAL_FIELDS)[number]): boolean {
  const parsed: unknown = JSON.parse(content);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return false;
  const account = (parsed as Record<string, unknown>).account;
  if (typeof account !== 'object' || account === null) return false;
  const value = (account as Record<string, unknown>)[field];
  if (!REGISTERED_PLACEHOLDERS[field].has(value)) return false;
  const withoutAccountField = structuredClone(parsed) as Record<string, Record<string, unknown>>;
  delete withoutAccountField.account[field];
  return !JSON.stringify(withoutAccountField).includes(field);
}

function listCaptureFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listCaptureFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.json') && !MANIFEST_FILES.has(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

describe('committed fixtures carry no player identity', () => {
  it('no capture JSON under packages/domain/tests/fixtures mentions a personal field', () => {
    const files = listCaptureFiles(FIXTURES_DIR);
    // Guards the guard: a bad path would make this pass vacuously (`suites green without
    // executing` — a repeat failure mode in this repo).
    expect(files.length, `no fixture JSON found under ${FIXTURES_DIR}`).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      for (const field of PERSONAL_FIELDS) {
        // The fidelity pair's `assertScrubbed` semantics: the field *name* must not appear at
        // all. The one exception is a registered placeholder on `account` itself; a blank
        // string or an unregistered value is a failure here, by design.
        if (content.includes(field) && !carriesOnlyRegisteredPlaceholder(content, field)) {
          offenders.push(`${relative(FIXTURES_DIR, file)} (${field})`);
        }
      }
    }

    const message =
      offenders.length > 0
        ? `Committed fixtures still carry personal fields: ${offenders.join(', ')}. Remove the ` +
          `account.${PERSONAL_FIELDS.join(' / account.')} keys entirely, or replace them with a ` +
          `placeholder registered in this file, before committing a capture — see docs/fidelity-gate.md.`
        : 'no offenders';
    expect(offenders, message).toEqual([]);
  });

  it('a registered placeholder passes only on account itself, and nothing else does', () => {
    const scrubbed = (account: Record<string, unknown>, rest: Record<string, unknown> = {}) =>
      JSON.stringify({ account, heroes: [], ...rest });
    expect(carriesOnlyRegisteredPlaceholder(scrubbed({ account_id: 900002, phase: 1 }), 'account_id')).toBe(true);
    expect(carriesOnlyRegisteredPlaceholder(scrubbed({ player_name: 'Fixture Alpha' }), 'player_name')).toBe(true);
    expect(carriesOnlyRegisteredPlaceholder(scrubbed({ account_id: 12345 }), 'account_id')).toBe(false);
    expect(carriesOnlyRegisteredPlaceholder(scrubbed({ account_id: '900002' }), 'account_id')).toBe(false);
    expect(carriesOnlyRegisteredPlaceholder(scrubbed({ player_name: '' }), 'player_name')).toBe(false);
    expect(carriesOnlyRegisteredPlaceholder(scrubbed({ player_name: 'Fixture Alpha' }, { note: 'player_name' }), 'player_name')).toBe(false);
    expect(carriesOnlyRegisteredPlaceholder(JSON.stringify({ player_name: 'Fixture Alpha' }), 'player_name')).toBe(false);
  });

  it('the exempted pair manifest mentions the fields only as a scrub attestation', () => {
    // The one file the walk skips must earn the exemption: it may name the fields in its
    // `scrubbed` provenance lists and nowhere else. Without this, `MANIFEST_FILES` would be
    // a hole a future capture could be parked in by naming it `pair.json`.
    const manifest = readFileSync(join(FIXTURES_DIR, 'fidelity-gate', 'pair.json'), 'utf8');
    const parsed = JSON.parse(manifest) as {
      export: { scrubbed: string[] };
      live: { scrubbed: string[] };
    };
    expect(parsed.export.scrubbed).toEqual([...PERSONAL_FIELDS]);
    expect(parsed.live.scrubbed).toEqual([...PERSONAL_FIELDS]);

    // Strip the two attestation lists; whatever is left must be free of the field names.
    const withoutAttestation = structuredClone(parsed) as Record<string, unknown>;
    delete (withoutAttestation.export as { scrubbed?: unknown }).scrubbed;
    delete (withoutAttestation.live as { scrubbed?: unknown }).scrubbed;
    const residue = JSON.stringify(withoutAttestation);
    for (const field of PERSONAL_FIELDS) {
      expect(residue, `pair.json mentions "${field}" outside its scrubbed attestation lists`).not.toContain(field);
    }
  });
});
