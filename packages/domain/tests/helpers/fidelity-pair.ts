/**
 * MP2 F4 — the fidelity-gate loader and the deterministic export→live framing helper.
 *
 * `frameLiveCapture` / `scrubPersonalFields` (T1) are pure, non-throwing transforms used both
 * to build the committed `live-capture.json` and, pre-F2, to prove that file is exactly what
 * the framing function produces from the committed export (design §1.1, `AD-026`).
 *
 * `loadFidelityPair` (T2) is the fail-loud entry point: every failure mode throws a typed
 * `FidelityGateError` (`design.md` §4.1) — there is no "return null/undefined" branch for a
 * caller to forget to check (`AD-025`'s pattern applied here).
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { AccountFidelity, AccountPayload } from '@bombfarm/contracts';
import { ACCOUNT_SECTIONS } from '@bombfarm/domain/account-fidelity';
import { FidelityGateError } from './fidelity-gate-error';

const DEFAULT_FIXTURES_DIR = join(__dirname, '..', 'fixtures', 'fidelity-gate');
const PAIR_MANIFEST_FILE = 'pair.json';
const DOCS_LINK = 'docs/fidelity-gate.md';

/**
 * The provenance token this design ladders strictness off (`design.md` §1.2, `AD-026`).
 *
 * `api-assembled` was added when MP2 F2 shipped as an API source rather than the memory reader
 * the ladder was first written for. `memory-assembled` is deliberately kept, not renamed: it is
 * a merged tripwire whose meaning would be rewritten retroactively by a rename, and telemetry is
 * still memory-sourced, so it keeps a real future subject.
 */
export type LiveSource = 'export-derived' | 'memory-assembled' | 'api-assembled';

const KNOWN_LIVE_SOURCES: readonly LiveSource[] = ['export-derived', 'memory-assembled', 'api-assembled'];

/** Tokens that assert an origin genuinely independent of the export. */
const INDEPENDENT_LIVE_SOURCES: readonly LiveSource[] = ['memory-assembled', 'api-assembled'];

export interface FidelityPairManifest {
  readonly schemaVersion: 1;
  readonly accountLabel: string;
  readonly export: {
    readonly file: string;
    readonly gameBuild: string;
    readonly capturedAt: string;
    readonly scrubbed: readonly string[];
  };
  readonly live: {
    readonly file: string;
    readonly source: LiveSource;
    readonly gameBuild: string;
    readonly capturedAt: string;
    readonly scrubbed: readonly string[];
    readonly readerVersion?: string;
    readonly fingerprints?: Readonly<Record<string, string>>;
  };
  readonly expected: {
    readonly heroes: number;
    readonly items: number;
    readonly statComparisons: number;
  };
}

export interface FidelityPair {
  readonly manifest: FidelityPairManifest;
  readonly exportPayload: AccountPayload;
  readonly livePayload: AccountPayload;
}

/**
 * Personal fields scrubbed from every committed capture (`docs/SAVE_EXPORT.md`, spec.md).
 * Exported so the repo-wide fixture guard (`fixtures-scrubbed.test.ts`) enforces the same
 * list F4's own pair is held to — one source of truth, not two drifting copies.
 */
export const PERSONAL_FIELDS = ['account_id', 'player_name'] as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Removes `account.account_id` and `account.player_name` — nothing else. Leaves every other
 * key, including every other `account` field, untouched. Non-destructive: returns a new object,
 * never mutates `o`.
 */
export function scrubPersonalFields(o: Record<string, unknown>): Record<string, unknown> {
  const account = o.account;
  if (!isObject(account)) {
    return { ...o };
  }
  const scrubbedAccount = { ...account };
  delete scrubbedAccount.account_id;
  delete scrubbedAccount.player_name;
  return { ...o, account: scrubbedAccount };
}

/** Stamp applied to every section of the synthesised `fidelity` block. */
export interface FrameStamp {
  readonly capturedAt: string;
}

/**
 * Deterministic export → live framing (design §1.1): lifts the five `AccountPayload` sections
 * out of a scrubbed export object, drops the two file-only keys (`export_version`,
 * `generated_at` — ACS-06), and attaches a five-section `fidelity` block stamped `resolved` at
 * `stamp.capturedAt`. Calling this twice on the same input produces byte-identical output
 * (T1's `Done when` — the regeneration proof for the committed `live-capture.json`).
 */
export function frameLiveCapture(exportObject: Record<string, unknown>, stamp: FrameStamp): AccountPayload {
  const scrubbed = scrubPersonalFields(exportObject);

  const fidelity = ACCOUNT_SECTIONS.reduce<Record<string, { status: 'resolved'; capturedAt: string }>>(
    (acc, section) => {
      acc[section] = { status: 'resolved', capturedAt: stamp.capturedAt };
      return acc;
    },
    {},
  ) as AccountFidelity;

  return {
    account: scrubbed.account as AccountPayload['account'],
    heroes: scrubbed.heroes as AccountPayload['heroes'],
    skills: scrubbed.skills as AccountPayload['skills'],
    casa: scrubbed.casa as AccountPayload['casa'],
    items: scrubbed.items as AccountPayload['items'],
    fidelity,
  };
}

// ---------------------------------------------------------------------------------------------
// T2 — the fail-loud loader
// ---------------------------------------------------------------------------------------------

function readJsonFile(absPath: string): unknown {
  if (!existsSync(absPath)) {
    throw new FidelityGateError(
      'fixtureMissing',
      `Missing fixture file "${absPath}". See ${DOCS_LINK} for how to produce the fidelity-gate capture pair.`,
      { path: absPath },
    );
  }
  let text: string;
  try {
    text = readFileSync(absPath, 'utf8');
  } catch (err) {
    const code = isObject(err) && typeof err.code === 'string' ? err.code : 'UNKNOWN';
    throw new FidelityGateError('fixtureUnreadable', `Could not read fixture file "${absPath}" (errno ${code}).`, {
      path: absPath,
      errno: code,
    });
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    const position = err instanceof Error ? err.message : String(err);
    throw new FidelityGateError('fixtureMalformed', `Fixture file "${absPath}" is not valid JSON: ${position}`, {
      path: absPath,
      parseError: position,
    });
  }
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new FidelityGateError('manifestInvalid', `pair.json manifest field "${field}" must be a non-empty string.`, {
      field,
      value,
    });
  }
  return value;
}

function requireScrubbedList(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value) || value.length === 0 || !value.every((v) => typeof v === 'string')) {
    throw new FidelityGateError('manifestInvalid', `pair.json manifest field "${field}" must be a non-empty string array.`, {
      field,
      value,
    });
  }
  return value;
}

function requireNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new FidelityGateError('manifestInvalid', `pair.json manifest field "${field}" must be a finite number.`, {
      field,
      value,
    });
  }
  return value;
}

/** Validates and narrows a raw manifest object; throws `manifestInvalid` on the first defect. */
function parseManifest(raw: unknown): FidelityPairManifest {
  if (!isObject(raw)) {
    throw new FidelityGateError('manifestInvalid', 'pair.json manifest must be a JSON object.', { raw });
  }
  if (raw.schemaVersion !== 1) {
    throw new FidelityGateError(
      'manifestInvalid',
      `pair.json manifest field "schemaVersion" must be 1, got ${JSON.stringify(raw.schemaVersion)}.`,
      { field: 'schemaVersion', value: raw.schemaVersion },
    );
  }
  const accountLabel = requireString(raw.accountLabel, 'accountLabel');

  const exportRaw = raw.export;
  if (!isObject(exportRaw)) {
    throw new FidelityGateError('manifestInvalid', 'pair.json manifest field "export" must be an object.', { field: 'export' });
  }
  const exportSection = {
    file: requireString(exportRaw.file, 'export.file'),
    gameBuild: requireString(exportRaw.gameBuild, 'export.gameBuild'),
    capturedAt: requireString(exportRaw.capturedAt, 'export.capturedAt'),
    scrubbed: requireScrubbedList(exportRaw.scrubbed, 'export.scrubbed'),
  };

  const liveRaw = raw.live;
  if (!isObject(liveRaw)) {
    throw new FidelityGateError('manifestInvalid', 'pair.json manifest field "live" must be an object.', { field: 'live' });
  }
  const source = liveRaw.source;
  if (!KNOWN_LIVE_SOURCES.includes(source as LiveSource)) {
    throw new FidelityGateError(
      'manifestInvalid',
      `pair.json manifest field "live.source" must be one of ${KNOWN_LIVE_SOURCES.join(', ')}, got ${JSON.stringify(source)}.`,
      { field: 'live.source', value: source, accepted: KNOWN_LIVE_SOURCES },
    );
  }
  const liveSource = source as LiveSource;
  const liveSection: FidelityPairManifest['live'] = {
    file: requireString(liveRaw.file, 'live.file'),
    source: liveSource,
    gameBuild: requireString(liveRaw.gameBuild, 'live.gameBuild'),
    capturedAt: requireString(liveRaw.capturedAt, 'live.capturedAt'),
    scrubbed: requireScrubbedList(liveRaw.scrubbed, 'live.scrubbed'),
    ...(liveRaw.readerVersion !== undefined ? { readerVersion: requireString(liveRaw.readerVersion, 'live.readerVersion') } : {}),
    ...(liveRaw.fingerprints !== undefined ? { fingerprints: liveRaw.fingerprints as Record<string, string> } : {}),
  };
  if (INDEPENDENT_LIVE_SOURCES.includes(liveSource)) {
    requireString(liveRaw.readerVersion, 'live.readerVersion');
    if (!isObject(liveRaw.fingerprints) || Object.keys(liveRaw.fingerprints).length === 0) {
      throw new FidelityGateError(
        'manifestInvalid',
        `pair.json manifest field "live.fingerprints" is required and must be non-empty when live.source is "${liveSource}".`,
        { field: 'live.fingerprints', value: liveRaw.fingerprints },
      );
    }
  }

  const expectedRaw = raw.expected;
  if (!isObject(expectedRaw)) {
    throw new FidelityGateError('manifestInvalid', 'pair.json manifest field "expected" must be an object.', { field: 'expected' });
  }
  const expected = {
    heroes: requireNumber(expectedRaw.heroes, 'expected.heroes'),
    items: requireNumber(expectedRaw.items, 'expected.items'),
    statComparisons: requireNumber(expectedRaw.statComparisons, 'expected.statComparisons'),
  };

  return { schemaVersion: 1, accountLabel, export: exportSection, live: liveSection, expected };
}

function assertScrubbed(payload: unknown, label: string): void {
  const text = JSON.stringify(payload);
  for (const field of PERSONAL_FIELDS) {
    if (text.includes(field)) {
      throw new FidelityGateError(
        'unscrubbedFixture',
        `${label} capture still carries the "${field}" field — it must be scrubbed before it can be committed.`,
        { label, field },
      );
    }
  }
}

/**
 * Reads `pair.json` plus both captures from `dir` (default: the committed fixture directory),
 * validates the manifest, and returns a fully-typed `FidelityPair`. Every failure mode throws a
 * `FidelityGateError` — there is no falsy/partial return value (`AD-025`).
 */
export function loadFidelityPair(dir: string = DEFAULT_FIXTURES_DIR): FidelityPair {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    throw new FidelityGateError(
      'fixtureMissing',
      `Fidelity-gate fixture directory "${dir}" does not exist. See ${DOCS_LINK} for how to produce the capture pair.`,
      { dir },
    );
  }

  const manifestPath = join(dir, PAIR_MANIFEST_FILE);
  const manifestRaw = readJsonFile(manifestPath);
  const manifest = parseManifest(manifestRaw);

  const exportPath = join(dir, manifest.export.file);
  const exportRaw = readJsonFile(exportPath);
  assertScrubbed(exportRaw, 'export');

  const livePath = join(dir, manifest.live.file);
  const liveRaw = readJsonFile(livePath);
  assertScrubbed(liveRaw, 'live');

  if (!isObject(exportRaw)) {
    throw new FidelityGateError('fixtureMalformed', `Export capture "${exportPath}" did not parse to a JSON object.`, { path: exportPath });
  }
  if (!isObject(liveRaw)) {
    throw new FidelityGateError('fixtureMalformed', `Live capture "${livePath}" did not parse to a JSON object.`, { path: livePath });
  }

  // The export-capture file carries the two file-only keys (`export_version`, `generated_at`,
  // ACS-06); the AccountPayload type never declares them, so they simply ride along at runtime
  // (same contract `toAccountPayload` relies on in `import-save.ts`).
  const exportPayload = exportRaw as unknown as AccountPayload;
  const livePayload = liveRaw as unknown as AccountPayload;

  return { manifest, exportPayload, livePayload };
}
