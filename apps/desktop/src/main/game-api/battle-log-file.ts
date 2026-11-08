import { readFileSync, statSync, watch } from 'node:fs';
import { dirname, join, win32 } from 'node:path';
import type { GrantedConsent } from '@bombfarm/game-api';
import { sessionCfgPath, type SessionCfgPathDeps } from './session-token-file.js';

/**
 * The gated fs read for the two game files beside `session.cfg`: `battle_log.cfg` and
 * `settings.cfg`. Like the token read, every read takes a `GrantedConsent`, so calling one for
 * anything but a granted player is a compile error. Never throws: a failure is a named result.
 */
export interface BattleLogFsPort {
  readFileSync(path: string): string;
  statSync(path: string): { readonly mtimeMs: number; readonly size: number };
}

export const nodeBattleLogFsPort: BattleLogFsPort = {
  readFileSync: (path) => readFileSync(path, 'utf8'),
  statSync: (path) => statSync(path),
};

/**
 * `BFC_BATTLE_LOG_DIR_OVERRIDE` is a test-only escape hatch, honoured only when
 * `deps.isPackaged === false` (the same rule as `sessionCfgPath`): a packaged build never honours
 * it, whatever its environment holds.
 */
function gameFilePath(file: string, deps: SessionCfgPathDeps): string {
  const env = deps.env ?? process.env;
  const isPackaged = deps.isPackaged ?? true;
  if (!isPackaged && env.BFC_BATTLE_LOG_DIR_OVERRIDE) return join(env.BFC_BATTLE_LOG_DIR_OVERRIDE, file);
  // The game's folder is the one `session.cfg` lives in; the token override never applies here.
  return win32.join(win32.dirname(sessionCfgPath({ isPackaged: true, env })), file);
}

export function battleLogPath(deps: SessionCfgPathDeps = {}): string {
  return gameFilePath('battle_log.cfg', deps);
}

export function gameSettingsPath(deps: SessionCfgPathDeps = {}): string {
  return gameFilePath('settings.cfg', deps);
}

export type GameFileResult =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly reason: 'not_found' | 'unreadable' };

export interface FileStat {
  readonly mtimeMs: number;
  readonly size: number;
}

/** `null` when the file is missing or cannot be stat'ed. */
export function statGameFile(_consent: GrantedConsent, fs: BattleLogFsPort, filePath: string): FileStat | null {
  try {
    const { mtimeMs, size } = fs.statSync(filePath);
    return { mtimeMs, size };
  } catch {
    return null;
  }
}

export function readGameFile(_consent: GrantedConsent, fs: BattleLogFsPort, filePath: string): GameFileResult {
  try {
    fs.statSync(filePath);
  } catch {
    return { ok: false, reason: 'not_found' };
  }
  try {
    return { ok: true, text: fs.readFileSync(filePath) };
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
}

/** `;` starts a comment for the remainder of a line, but only outside a quoted value. */
function stripComment(line: string): string {
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ';' && !inQuotes) return line.slice(0, i);
  }
  return line;
}

function stripQuotes(value: string): string {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) return value.slice(1, -1);
  return value;
}

/** The `[game] language` value of `settings.cfg` text, quotes removed; `null` when absent or empty. */
export function parseGameLanguage(text: string): string | null {
  let inGame = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = stripComment(rawLine).trim();
    if (line.length === 0) continue;
    const section = /^\[([^\]]+)\]$/.exec(line);
    if (section) {
      inGame = (section[1] ?? '').trim().toLowerCase() === 'game';
      continue;
    }
    if (!inGame) continue;
    const eq = line.indexOf('=');
    if (eq === -1 || line.slice(0, eq).trim() !== 'language') continue;
    const value = stripQuotes(line.slice(eq + 1).trim());
    return value.length > 0 ? value : null;
  }
  return null;
}

export function readGameLanguage(consent: GrantedConsent, fs: BattleLogFsPort, filePath: string): string | null {
  const file = readGameFile(consent, fs, filePath);
  return file.ok ? parseGameLanguage(file.text) : null;
}

/** An early wake for the tailer: calls `wake` when anything in the file's folder changes. */
export function watchGameFolder(filePath: string, wake: () => void): () => void {
  try {
    const watcher = watch(dirname(filePath), () => {
      wake();
    });
    watcher.on('error', () => {});
    return () => {
      watcher.close();
    };
  } catch {
    return () => {};
  }
}

/** What `createBattleLogReader` returns; the shape the tailer's source port asks for. */
export interface BattleLogReader {
  stat(): FileStat | null;
  read(): string | null;
  gameLanguage(): string | null;
}

export interface BattleLogReaderDeps {
  /** The granted consent, or `null` while the player has not granted it: then nothing is read. */
  consent(): GrantedConsent | null;
  readonly fs: BattleLogFsPort;
  readonly battleLogPath: string;
  readonly settingsPath: string;
}

/** The consent-gated reads of the two game files, as plain values for code that knows no game API. */
export function createBattleLogReader(deps: BattleLogReaderDeps): BattleLogReader {
  return {
    stat() {
      const consent = deps.consent();
      return consent === null ? null : statGameFile(consent, deps.fs, deps.battleLogPath);
    },
    read() {
      const consent = deps.consent();
      if (consent === null) return null;
      const file = readGameFile(consent, deps.fs, deps.battleLogPath);
      return file.ok ? file.text : null;
    },
    gameLanguage() {
      const consent = deps.consent();
      return consent === null ? null : readGameLanguage(consent, deps.fs, deps.settingsPath);
    },
  };
}
