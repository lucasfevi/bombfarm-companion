import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CONSENT_TEXT_VERSION, initialConsent, type ConsentRecord } from '@bombfarm/game-api';
import { createPremiumTrackingGame, trackingExtensionPath } from './premium-tracking-game.js';

const TOKEN = 'game-token-0123456789abcdef';
const GRANTED: ConsentRecord = { decision: 'granted', grantedAt: '2026-08-12T13:15:38.000Z', textVersion: CONSENT_TEXT_VERSION };

let dir = '';
const saved = { token: process.env.BFC_TOKEN_PATH_OVERRIDE, log: process.env.BFC_BATTLE_LOG_DIR_OVERRIDE };

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'bfc-trackgame-'));
  writeFileSync(join(dir, 'session.cfg'), ['[auth]', 'account_id=486', `token="${TOKEN}"`].join('\n'));
  writeFileSync(join(dir, 'battle_log.cfg'), '[acc_486]\nentries=[]\n');
  writeFileSync(join(dir, 'settings.cfg'), '[game]\nlanguage="pt_BR"\n');
  process.env.BFC_TOKEN_PATH_OVERRIDE = join(dir, 'session.cfg');
  process.env.BFC_BATTLE_LOG_DIR_OVERRIDE = dir;
});

afterEach(() => {
  for (const [name, value] of [
    ['BFC_TOKEN_PATH_OVERRIDE', saved.token],
    ['BFC_BATTLE_LOG_DIR_OVERRIDE', saved.log],
  ] as const) {
    if (value === undefined) Reflect.deleteProperty(process.env, name);
    else process.env[name] = value;
  }
  rmSync(dir, { recursive: true, force: true });
});

function game(consent: ConsentRecord) {
  return createPremiumTrackingGame({ readConsent: () => consent, isPackaged: false, resourcesPath: 'R', mainDir: 'M' });
}

describe('the game side of the tracking capabilities', () => {
  it('reads the credential and the battle log for a player who granted consent', () => {
    const facts = game(GRANTED);

    expect(facts.gameSecrets()).toEqual([TOKEN]);
    expect(facts.battleLog.source.stat()).not.toBeNull();
    expect(facts.battleLog.source.read()).toContain('[acc_486]');
    expect(facts.battleLog.source.gameLanguage()).toBe('pt_BR');
  });

  it('reads nothing before consent is granted', () => {
    const facts = game(initialConsent());

    expect(facts.gameSecrets()).toEqual([]);
    expect(facts.battleLog.source.stat()).toBeNull();
    expect(facts.battleLog.source.read()).toBeNull();
    expect(facts.battleLog.source.gameLanguage()).toBeNull();
  });

  it('follows consent as it changes, with no caching of the answer', () => {
    let consent: ConsentRecord = initialConsent();
    const facts = createPremiumTrackingGame({ readConsent: () => consent, isPackaged: false, resourcesPath: 'R', mainDir: 'M' });
    expect(facts.gameSecrets()).toEqual([]);
    consent = GRANTED;
    expect(facts.gameSecrets()).toEqual([TOKEN]);
    consent = initialConsent();
    expect(facts.gameSecrets()).toEqual([]);
  });
});

describe('where the signed DuckDB extension is', () => {
  it('is beside the app when packaged, and in the build folder otherwise', () => {
    expect(trackingExtensionPath({ isPackaged: true, resourcesPath: join('C:', 'res'), mainDir: 'M' })).toBe(
      join('C:', 'res', 'duckdb', 'httpfs.duckdb_extension'),
    );
    expect(trackingExtensionPath({ isPackaged: false, resourcesPath: 'R', mainDir: join('app', 'dist', 'main') })).toBe(
      join('app', 'build', 'duckdb', 'httpfs.duckdb_extension'),
    );
  });
});
