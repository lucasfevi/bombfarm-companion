import { readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { GrantedConsent, SessionCfgParseReason, SessionToken } from '@bombfarm/game-api';
import { parseSessionCfg } from '@bombfarm/game-api';

/**
 * The gated fs read (LAR-11, `AD-024`'s split applied to fs instead of koffi). Takes a
 * `GrantedConsent`, so calling it for anything but a granted player is a compile error — the
 * type half of "never open `session.cfg` before consent". Never throws: every failure mode
 * (missing file, unreadable, malformed content) is a distinct named result.
 */
export interface FsPort {
  readFileSync(path: string): string;
  statSync(path: string): { readonly mtimeMs: number };
}

const nodeFsPort: FsPort = {
  readFileSync: (path) => readFileSync(path, 'utf8'),
  statSync: (path) => statSync(path),
};

export function sessionCfgPath(): string {
  const appData = process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming');
  return join(appData, 'Godot', 'app_userdata', 'BombFarm', 'session.cfg');
}

export type SessionTokenFileReason = 'not_found' | 'unreadable' | SessionCfgParseReason;

export type SessionTokenFileResult =
  | { readonly ok: true; readonly accountId: string; readonly token: SessionToken; readonly mtimeMs: number }
  | { readonly ok: false; readonly reason: SessionTokenFileReason };

/**
 * `_consent` is read only by the type system — a `ConsentRecord` that is not statically known to
 * be `granted` cannot be passed here at all (`LAR-01` enforcement half). The value itself carries
 * no information this function needs at runtime.
 */
export function readSessionToken(
  _consent: GrantedConsent,
  fs: FsPort = nodeFsPort,
  filePath: string = sessionCfgPath(),
): SessionTokenFileResult {
  let mtimeMs: number;
  try {
    mtimeMs = fs.statSync(filePath).mtimeMs;
  } catch {
    return { ok: false, reason: 'not_found' };
  }

  let text: string;
  try {
    text = fs.readFileSync(filePath);
  } catch {
    return { ok: false, reason: 'unreadable' };
  }

  const parsed = parseSessionCfg(text);
  if (!parsed.ok) {
    return { ok: false, reason: parsed.reason };
  }

  return { ok: true, accountId: parsed.accountId, token: parsed.token, mtimeMs };
}
