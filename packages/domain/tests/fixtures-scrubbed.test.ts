// Privacy guard: no committed fixture may carry player identity. `docs/SAVE_EXPORT.md`
// classifies `account_id` and `player_name` as personal-but-not-secret — the save export
// carries no auth token, so this is not a credential leak, but the repo is public and there
// is no reason for the values to be in it.
//
// Already enforced this for its own capture pair (`loadFidelityPair` throws
// `unscrubbedFixture`), which left the legacy `sheet-math` fixtures as the inconsistent
// case (F4 design.md R-6). This walks the whole fixtures tree instead of a named list, so a
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
        // F4's `assertScrubbed` semantics: the field *name* must not appear at all. The
        // scrub deletes the key rather than blanking the value, so a placeholder such as
        // `"player_name": ""` is a failure here too, by design.
        if (content.includes(field)) {
          offenders.push(`${relative(FIXTURES_DIR, file)} (${field})`);
        }
      }
    }

    const message =
      offenders.length > 0
        ? `Committed fixtures still carry personal fields: ${offenders.join(', ')}. Remove the ` +
          `account.${PERSONAL_FIELDS.join(' / account.')} keys entirely before committing a capture ` +
          `— see docs/fidelity-gate.md.`
        : 'no offenders';
    expect(offenders, message).toEqual([]);
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
