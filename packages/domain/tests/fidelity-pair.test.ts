import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseAccountPayload } from '@bombfarm/domain/import-save';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { frameLiveCapture, loadFidelityPair, scrubPersonalFields, type FrameStamp } from './helpers/fidelity-pair';
import { FidelityGateError } from './helpers/fidelity-gate-error';

const FIXTURES_DIR = join(__dirname, 'fixtures', 'fidelity-gate');

function loadJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

interface FidelityPairManifestForTest {
  schemaVersion: 1;
  accountLabel: string;
  export: { file: string; gameBuild: string; capturedAt: string; scrubbed: string[] };
  live: { file: string; source: string; gameBuild: string; capturedAt: string; scrubbed: string[] };
  expected: { heroes: number; items: number; statComparisons: number };
}

const STAMP: FrameStamp = { capturedAt: '2026-08-13T14:26:40.000Z' };

// MFR-13: this file must carry no reference to the sibling fixture corpus directory.
// The unscrubbed source export lives only outside this repo and must not be committed to
// this public repo, so the two assertions that used to diff export-capture.json against a
// same-account copy of the pre-scrub source are replaced by the self-contained conjunction
// proof this file's design describes: idempotence under scrubPersonalFields, the raw-text
// field-name check (below), the exact top-level key set, and the retained raw account fields.
// The source SHA-256 is recorded by hand in the provenance README beside the fixture corpus,
// for anyone who wants to re-derive and diff outside the repo.
describe('T1 — the scrubbed capture pair and the framing helper', () => {
  const exportRaw = loadJson(join(FIXTURES_DIR, 'export-capture.json'));
  const liveRaw = loadJson(join(FIXTURES_DIR, 'live-capture.json'));
  const exportText = readFileSync(join(FIXTURES_DIR, 'export-capture.json'), 'utf8');
  const liveText = readFileSync(join(FIXTURES_DIR, 'live-capture.json'), 'utf8');

  it('export-capture.json carries exactly the expected top-level keys and retains every raw account field except the two scrubbed', () => {
    expect(Object.keys(exportRaw).sort()).toEqual(
      ['account', 'casa', 'export_version', 'generated_at', 'heroes', 'items', 'skills'].sort(),
    );
    const exportAccount = exportRaw.account as Record<string, unknown>;
    for (const key of ['gold', 'phase', 'max_phase', 'bag_tabs', 'bag_capacity', 'items_count', 'locked']) {
      expect(exportAccount[key], key).toBeDefined();
    }
    expect(exportAccount.account_id).toBeUndefined();
    expect(exportAccount.player_name).toBeUndefined();
  });

  it('live-capture.json is exactly frameLiveCapture(export-capture.json, stamp)', () => {
    const regenerated = frameLiveCapture(exportRaw, STAMP);
    expect(JSON.stringify(liveRaw)).toBe(JSON.stringify(regenerated));
  });

  it('frameLiveCapture drops export_version and generated_at, keeps all five section keys, attaches a resolved fidelity block', () => {
    const framed = frameLiveCapture(exportRaw, STAMP) as unknown as Record<string, unknown>;
    expect(framed.export_version).toBeUndefined();
    expect(framed.generated_at).toBeUndefined();
    for (const section of ['account', 'heroes', 'skills', 'casa', 'items']) {
      expect(framed[section]).toBeDefined();
    }
    const fidelity = framed.fidelity as Record<string, { status: string; capturedAt: string }>;
    expect(Object.keys(fidelity).sort()).toEqual(['account', 'casa', 'heroes', 'items', 'skills']);
    for (const section of Object.keys(fidelity)) {
      expect(fidelity[section]).toEqual({ status: 'resolved', capturedAt: STAMP.capturedAt });
    }
  });

  it('neither committed file contains "account_id" or "player_name" anywhere in raw text', () => {
    expect(exportText).not.toContain('account_id');
    expect(exportText).not.toContain('player_name');
    expect(liveText).not.toContain('account_id');
    expect(liveText).not.toContain('player_name');
  });

  it('every float in live-capture.json survives a JSON.stringify -> JSON.parse round trip exactly', () => {
    const roundTripped = JSON.parse(JSON.stringify(liveRaw));
    expect(roundTripped).toEqual(liveRaw);
    expect(JSON.stringify(roundTripped)).toBe(JSON.stringify(liveRaw));
  });

  it('scrubPersonalFields(exportCapture) is idempotent — the committed file is already fully scrubbed', () => {
    // Idempotence under the deterministic scrub is the in-repo half of the conjunction proof:
    // if the committed file already carries neither field, running the scrub again changes
    // nothing. Combined with the raw-text check below and the recorded source SHA-256, this is
    // the strongest honest proof available without the unscrubbed source in this repo.
    const scrubbed = scrubPersonalFields(exportRaw);
    expect(scrubbed).toEqual(exportRaw);
  });

  it('pair.json validates against the manifest schema with live.source "export-derived" and real gameBuild/capturedAt', () => {
    const manifest = loadJson(join(FIXTURES_DIR, 'pair.json')) as unknown as FidelityPairManifestForTest;
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.live.source).toBe('export-derived');
    expect(typeof manifest.export.gameBuild).toBe('string');
    expect(manifest.export.gameBuild.length).toBeGreaterThan(0);
    expect(typeof manifest.export.capturedAt).toBe('string');
    expect(() => new Date(manifest.export.capturedAt).toISOString()).not.toThrow();
    expect(typeof manifest.live.gameBuild).toBe('string');
    expect(manifest.live.gameBuild.length).toBeGreaterThan(0);
    expect(typeof manifest.live.capturedAt).toBe('string');
    expect(() => new Date(manifest.live.capturedAt).toISOString()).not.toThrow();
  });

  it('pair.json expected counts are measured from the real committed pair, not guessed', () => {
    const manifest = loadJson(join(FIXTURES_DIR, 'pair.json')) as unknown as FidelityPairManifestForTest;
    const liveResult = parseAccountPayload(liveRaw, []);
    const exportResult = parseAccountPayload(exportRaw, []);

    expect(liveResult.rejected).toBeNull();
    expect(exportResult.rejected).toBeNull();
    expect(manifest.expected.heroes).toBe(liveResult.candidates.length);
    expect(manifest.expected.heroes).toBe(exportResult.candidates.length);
    expect(manifest.expected.items).toBe(liveResult.inventory.length);
    expect(manifest.expected.items).toBe(exportResult.inventory.length);
    // 3 SheetStats blocks (naked, gearedOverride, birth) x 8 SHEET_KEYS, per hero.
    expect(manifest.expected.statComparisons).toBe(manifest.expected.heroes * 3 * 8);
  });
});

describe('T2 — the fail-loud loader', () => {
  it('throws fixtureMissing against an absent directory', () => {
    const missingDir = join(tmpdir(), 'fidelity-gate-does-not-exist-' + Date.now());
    expect(existsSync(missingDir)).toBe(false);
    expectCode(() => loadFidelityPair(missingDir), 'fixtureMissing');
  });

  it('resolves the committed pair with no argument', () => {
    const pair = loadFidelityPair();
    expect(pair.manifest.live.source).toBe('export-derived');
    expect(pair.exportPayload.heroes?.length).toBe(5);
    expect(pair.livePayload.heroes?.length).toBe(5);
  });

  describe('against a scratch mkdtemp directory', () => {
    let dir: string;

    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), 'fidelity-gate-'));
    });
    afterEach(() => {
      rmSync(dir, { recursive: true, force: true });
    });

    function writeManifest(overrides: Record<string, unknown> = {}, base?: Record<string, unknown>): void {
      const manifest =
        base ?? {
          schemaVersion: 1,
          accountLabel: 'temp account',
          export: {
            file: 'export-capture.json',
            gameBuild: '2026.07.31',
            capturedAt: '2026-07-31T13:52:13.000Z',
            scrubbed: ['account_id', 'player_name'],
          },
          live: {
            file: 'live-capture.json',
            source: 'export-derived',
            gameBuild: '2026.07.31',
            capturedAt: '2026-07-31T13:52:13.000Z',
            scrubbed: ['account_id', 'player_name'],
          },
          expected: { heroes: 1, items: 0, statComparisons: 24 },
        };
      writeFileSync(join(dir, 'pair.json'), JSON.stringify({ ...manifest, ...overrides }, null, 2));
    }

    function writeMinimalCapture(filename: string, extra: Record<string, unknown> = {}): void {
      writeFileSync(
        join(dir, filename),
        JSON.stringify(
          {
            account: { gold: '1', phase: 1 },
            heroes: [],
            skills: {},
            casa: {},
            items: [],
            ...extra,
          },
          null,
          2,
        ),
      );
    }

    it('throws fixtureMissing when pair.json is absent', () => {
      writeMinimalCapture('export-capture.json');
      writeMinimalCapture('live-capture.json');
      expectCode(() => loadFidelityPair(dir), 'fixtureMissing');
    });

    it('throws fixtureMissing when export-capture.json is absent', () => {
      writeManifest();
      writeMinimalCapture('live-capture.json');
      expectCode(() => loadFidelityPair(dir), 'fixtureMissing');
    });

    it('throws fixtureMissing when live-capture.json is absent', () => {
      writeManifest();
      writeMinimalCapture('export-capture.json');
      expectCode(() => loadFidelityPair(dir), 'fixtureMissing');
    });

    it('the fixtureMissing message names the absolute path and docs/fidelity-gate.md', () => {
      writeManifest();
      writeMinimalCapture('export-capture.json');
      const err = expectCode(() => loadFidelityPair(dir), 'fixtureMissing');
      expect(err.message).toContain(dir);
      expect(err.message).toContain('docs/fidelity-gate.md');
    });

    it('throws fixtureMalformed naming the file and the parser position on invalid JSON', () => {
      writeManifest();
      writeFileSync(join(dir, 'export-capture.json'), '{ this is not json');
      writeMinimalCapture('live-capture.json');
      const err = expectCode(() => loadFidelityPair(dir), 'fixtureMalformed');
      expect(err.message).toContain('export-capture.json');
    });

    it('throws manifestInvalid when the manifest is missing a required field', () => {
      writeManifest(
        {},
        {
          schemaVersion: 1,
          accountLabel: 'temp account',
          export: {
            file: 'export-capture.json',
            gameBuild: '2026.07.31',
            capturedAt: '2026-07-31T00:00:00.000Z',
            scrubbed: ['account_id', 'player_name'],
          },
          // live section deliberately omitted entirely.
          expected: { heroes: 1, items: 0, statComparisons: 24 },
        },
      );
      writeMinimalCapture('export-capture.json');
      writeMinimalCapture('live-capture.json');
      expectCode(() => loadFidelityPair(dir), 'manifestInvalid');
    });

    it('throws manifestInvalid when live.source is an unknown token', () => {
      writeManifest({
        live: {
          file: 'live-capture.json',
          source: 'made-up-token',
          gameBuild: '2026.07.31',
          capturedAt: '2026-07-31T00:00:00.000Z',
          scrubbed: ['account_id', 'player_name'],
        },
      });
      writeMinimalCapture('export-capture.json');
      writeMinimalCapture('live-capture.json');
      expectCode(() => loadFidelityPair(dir), 'manifestInvalid');
    });

    it.each(['memory-assembled', 'api-assembled'] as const)(
      'throws manifestInvalid when live.source is "%s" without readerVersion/fingerprints',
      (source) => {
        writeManifest({
          live: {
            file: 'live-capture.json',
            source,
            gameBuild: '2026.07.31',
            capturedAt: '2026-07-31T00:00:00.000Z',
            scrubbed: ['account_id', 'player_name'],
          },
        });
        writeMinimalCapture('export-capture.json');
        writeMinimalCapture('live-capture.json');
        expectCode(() => loadFidelityPair(dir), 'manifestInvalid');
      },
    );

    it('throws unscrubbedFixture when a capture still carries account_id', () => {
      writeManifest();
      writeMinimalCapture('export-capture.json');
      writeMinimalCapture('live-capture.json', { account: { gold: '1', phase: 1, account_id: 486 } });
      expectCode(() => loadFidelityPair(dir), 'unscrubbedFixture');
    });

    it('throws unscrubbedFixture when a capture still carries player_name', () => {
      writeManifest();
      writeMinimalCapture('export-capture.json');
      writeMinimalCapture('live-capture.json', { account: { gold: '1', phase: 1, player_name: 'Black' } });
      expectCode(() => loadFidelityPair(dir), 'unscrubbedFixture');
    });

    it('throws fixtureUnreadable when a required file is a directory instead of a readable file', () => {
      writeManifest();
      writeMinimalCapture('live-capture.json');
      // A directory where a file is expected fails to read as text — same failure family as an
      // EACCES-unreadable file, without depending on OS-specific permission manipulation.
      mkdirSync(join(dir, 'export-capture.json'));
      expectCode(() => loadFidelityPair(dir), 'fixtureUnreadable');
    });
  });
});

function expectCode(fn: () => unknown, code: string): FidelityGateError {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(FidelityGateError);
    expect((err as FidelityGateError).code).toBe(code);
    return err as FidelityGateError;
  }
  throw new Error(`expected fn to throw FidelityGateError(${code}), but it did not throw`);
}
