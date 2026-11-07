import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { GrantedConsent } from '@bombfarm/game-api';
import {
  battleLogPath,
  createBattleLogReader,
  gameSettingsPath,
  nodeBattleLogFsPort,
  parseGameLanguage,
  readGameFile,
  readGameLanguage,
  statGameFile,
} from './battle-log-file.js';
import { sessionCfgPath } from './session-token-file.js';

const GRANTED: GrantedConsent = { decision: 'granted', grantedAt: '2026-08-12T13:15:38.000Z', textVersion: 1 };

/** The default folder is the one session.cfg lives in. */
const inGameFolder = (file: string): string =>
  sessionCfgPath({ isPackaged: true, env: { APPDATA: 'C:\\appdata' } }).replace(/session\.cfg$/, file);

describe('battleLogPath / gameSettingsPath', () => {
  it('resolve beside session.cfg under %APPDATA%', () => {
    const env = { APPDATA: 'C:\\appdata' };
    expect(battleLogPath({ env })).toBe(inGameFolder('battle_log.cfg'));
    expect(gameSettingsPath({ env })).toBe(inGameFolder('settings.cfg'));
  });

  it('honours BFC_BATTLE_LOG_DIR_OVERRIDE only when isPackaged is explicitly false', () => {
    const env = { APPDATA: 'C:\\appdata', BFC_BATTLE_LOG_DIR_OVERRIDE: join(tmpdir(), 'fixture-dir') };
    expect(battleLogPath({ isPackaged: false, env })).toBe(join(tmpdir(), 'fixture-dir', 'battle_log.cfg'));
    expect(gameSettingsPath({ isPackaged: false, env })).toBe(join(tmpdir(), 'fixture-dir', 'settings.cfg'));
  });

  it('ignores the override when isPackaged is true', () => {
    const env = { APPDATA: 'C:\\appdata', BFC_BATTLE_LOG_DIR_OVERRIDE: 'C:\\fixtures' };
    expect(battleLogPath({ isPackaged: true, env })).toBe(inGameFolder('battle_log.cfg'));
    expect(gameSettingsPath({ isPackaged: true, env })).toBe(inGameFolder('settings.cfg'));
  });

  it('zero-arg calls ignore the override even when it is set (fail-closed default)', () => {
    const originalAppData = process.env.APPDATA;
    const originalOverride = process.env.BFC_BATTLE_LOG_DIR_OVERRIDE;
    process.env.APPDATA = 'C:\\appdata';
    process.env.BFC_BATTLE_LOG_DIR_OVERRIDE = 'C:\\should-be-ignored';
    try {
      expect(battleLogPath()).toBe(inGameFolder('battle_log.cfg'));
      expect(gameSettingsPath()).toBe(inGameFolder('settings.cfg'));
    } finally {
      if (originalAppData === undefined) delete process.env.APPDATA;
      else process.env.APPDATA = originalAppData;
      if (originalOverride === undefined) delete process.env.BFC_BATTLE_LOG_DIR_OVERRIDE;
      else process.env.BFC_BATTLE_LOG_DIR_OVERRIDE = originalOverride;
    }
  });

  it('falls back to the real path when unpackaged but no override is set', () => {
    expect(battleLogPath({ isPackaged: false, env: { APPDATA: 'C:\\appdata' } })).toBe(
      inGameFolder('battle_log.cfg'),
    );
  });
});

describe('parseGameLanguage', () => {
  it('reads [game] language with its quotes removed', () => {
    expect(parseGameLanguage('[audio]\nlanguage="xx"\n[game]\nlanguage="pt"\n')).toBe('pt');
  });

  it('reads an unquoted value and ignores a trailing comment outside quotes', () => {
    expect(parseGameLanguage('[game]\nlanguage=en ; chosen at install\n')).toBe('en');
  });

  it('keeps a semicolon inside quotes', () => {
    expect(parseGameLanguage('[game]\nlanguage="a;b"\n')).toBe('a;b');
  });

  it('is null when the key, the section or the value is absent', () => {
    expect(parseGameLanguage('[game]\nvolume=3\n')).toBeNull();
    expect(parseGameLanguage('[other]\nlanguage="pt"\n')).toBeNull();
    expect(parseGameLanguage('[game]\nlanguage=""\n')).toBeNull();
    expect(parseGameLanguage('')).toBeNull();
  });
});

describe('reads on a real folder', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it('read, stat and language work through the override; a missing file is a named result', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bfc-battle-'));
    dirs.push(dir);
    writeFileSync(join(dir, 'settings.cfg'), '[game]\nlanguage="pt"\n');
    const env = { BFC_BATTLE_LOG_DIR_OVERRIDE: dir };
    const settings = gameSettingsPath({ isPackaged: false, env });
    const log = battleLogPath({ isPackaged: false, env });

    expect(readGameLanguage(GRANTED, nodeBattleLogFsPort, settings)).toBe('pt');
    expect(readGameFile(GRANTED, nodeBattleLogFsPort, settings)).toEqual({ ok: true, text: '[game]\nlanguage="pt"\n' });
    expect(readGameFile(GRANTED, nodeBattleLogFsPort, log)).toEqual({ ok: false, reason: 'not_found' });
    expect(statGameFile(GRANTED, nodeBattleLogFsPort, log)).toBeNull();
    expect(statGameFile(GRANTED, nodeBattleLogFsPort, settings)?.size).toBe(21);
    expect(readGameLanguage(GRANTED, nodeBattleLogFsPort, log)).toBeNull();
  });
});

describe('createBattleLogReader', () => {
  it('reads nothing at all without a granted consent', () => {
    const touched: string[] = [];
    const reader = createBattleLogReader({
      consent: () => null,
      fs: {
        statSync: (path) => {
          touched.push(path);
          return { mtimeMs: 1, size: 1 };
        },
        readFileSync: (path) => {
          touched.push(path);
          return 'x';
        },
      },
      battleLogPath: 'dir/battle_log.cfg',
      settingsPath: 'dir/settings.cfg',
    });
    expect(reader.stat()).toBeNull();
    expect(reader.read()).toBeNull();
    expect(reader.gameLanguage()).toBeNull();
    expect(touched).toEqual([]);
  });

  it('with consent: stat, text and language come from the two files, null when missing', () => {
    const files: Record<string, string> = {
      'dir/battle_log.cfg': '[acc_1]\nentries=[]\n',
      'dir/settings.cfg': '[game]\nlanguage="pt"\n',
    };
    const fs = {
      statSync: (path: string) => {
        const text = files[path];
        if (text === undefined) throw new Error('ENOENT');
        return { mtimeMs: 7, size: text.length };
      },
      readFileSync: (path: string) => {
        const text = files[path];
        if (text === undefined) throw new Error('ENOENT');
        return text;
      },
    };
    const reader = createBattleLogReader({
      consent: () => GRANTED,
      fs,
      battleLogPath: 'dir/battle_log.cfg',
      settingsPath: 'dir/settings.cfg',
    });
    expect(reader.stat()).toEqual({ mtimeMs: 7, size: 19 });
    expect(reader.read()).toBe('[acc_1]\nentries=[]\n');
    expect(reader.gameLanguage()).toBe('pt');

    const missing = createBattleLogReader({
      consent: () => GRANTED,
      fs,
      battleLogPath: 'dir/none.cfg',
      settingsPath: 'dir/none2.cfg',
    });
    expect(missing.stat()).toBeNull();
    expect(missing.read()).toBeNull();
    expect(missing.gameLanguage()).toBeNull();
  });
});
