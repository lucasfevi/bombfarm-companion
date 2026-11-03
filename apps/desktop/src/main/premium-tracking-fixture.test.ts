import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { PREMIUM_CAPABILITIES, type PremiumManifest } from '@bombfarm/contracts';
import {
  BATTLE_LOG_FILES,
  LINKED_PAIR,
  OTHER_ACCOUNT_ID,
  OTHER_SECTION_MARKER,
  TRACKING_CAPABILITIES,
  stageBattleLogFolder,
  trackingBundle,
} from '../../tests/fixtures/premium/tracking-fixtures.mjs';
import { parseGameLanguage } from './game-api/battle-log-file.js';
import { extractSection, isCompleteSection } from './premium/tracking/battle-log-tailer.js';

const BUNDLE_DIR = join(__dirname, '..', '..', 'tests', 'fixtures', 'premium', 'tracking-bundle');
const WORKER = readFileSync(join(BUNDLE_DIR, 'worker', 'index.cjs'), 'utf8');
const UI = readFileSync(join(BUNDLE_DIR, 'ui', 'index.js'), 'utf8');

const scratch: string[] = [];
const scratchDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'bfc-tracking-fixture-'));
  scratch.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('the tracking fixture bundle', () => {
  it('asks for all eight capabilities and the Live slot, for the 1.2 host', () => {
    const { manifestBytes, files } = trackingBundle();
    const manifest = JSON.parse(Buffer.from(manifestBytes).toString('utf8')) as PremiumManifest;
    expect(manifest.capabilities).toEqual([...PREMIUM_CAPABILITIES, 'live.section']);
    expect([...TRACKING_CAPABILITIES]).toEqual([...manifest.capabilities]);
    expect(manifest.hostApi).toBe('>=1.2.0 <2.0.0');
    expect(manifest.flavors).toEqual(['dev']);
    for (const file of manifest.files) {
      const bytes = files.get(file.path);
      expect(bytes?.length).toBe(file.size);
      expect(createHash('sha256').update(bytes ?? new Uint8Array()).digest('hex')).toBe(file.sha256);
    }
  });

  it('holds no table, schema or query beyond the one throwaway table', () => {
    const statements = [...`${WORKER}\n${UI}`.matchAll(/\b(?:FROM|INTO|TABLE(?:\s+IF\s+NOT\s+EXISTS)?|UPDATE|JOIN)\s+([A-Za-z_][\w.]*)/g)];
    expect(statements.length).toBeGreaterThan(0);
    expect(new Set(statements.map((match) => match[1]))).toEqual(new Set(['t']));
    expect(WORKER).not.toMatch(/\b(?:ALTER|DROP|CREATE VIEW|CREATE INDEX|CREATE SEQUENCE|MERGE)\b/);
  });

  it('writes with plain statements the db gate accepts: no comments inside any SQL string', () => {
    const sql = [...`${WORKER}\n${UI}`.matchAll(/sql:\s*'([^']*)'/g)].map((match) => match[1]);
    expect(sql.length).toBeGreaterThan(0);
    for (const statement of sql) expect(statement).not.toMatch(/--|\/\*|\*\//);
  });

  it('carries the marker the packaging gate already refuses in a beta or prod build', () => {
    expect(UI).toContain('bfc-premium-fixture-marker');
  });
});

describe('the tracking game folder', () => {
  it('has the licensed account section, one other, and a settings file with a language', () => {
    const dir = stageBattleLogFolder(scratchDir());
    expect([...BATTLE_LOG_FILES]).toEqual(['battle_log.cfg', 'settings.cfg']);
    const log = readFileSync(join(dir, 'battle_log.cfg'), 'utf8');
    expect(extractSection(log, LINKED_PAIR.accountId)).toContain('played=12');
    expect(isCompleteSection(extractSection(log, LINKED_PAIR.accountId) ?? '')).toBe(true);
    expect(extractSection(log, LINKED_PAIR.accountId)).not.toContain(OTHER_SECTION_MARKER);
    expect(extractSection(log, OTHER_ACCOUNT_ID)).toContain(OTHER_SECTION_MARKER);
    expect(parseGameLanguage(readFileSync(join(dir, 'settings.cfg'), 'utf8'))).toBe('en');
  });
});
