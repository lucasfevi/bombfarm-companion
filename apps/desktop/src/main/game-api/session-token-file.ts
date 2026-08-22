import { readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { win32 } from 'node:path';
import type { GrantedConsent, SessionCfgParseReason, SessionToken } from '@bombfarm/game-api';
import { parseSessionCfg } from '@bombfarm/game-api';

/**
 * The gated fs read (LAR-11, the same one-module split `AD-024` applies to network access,
 * applied here to fs instead). Takes a
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

export interface SessionCfgPathDeps {
  /** Electron's real `app.isPackaged` — the only thing that may unlock the override below, and
   *  never derived from any environment variable (so it cannot be spoofed by setting one). Every
   *  caller that does not explicitly thread the real value — every unit test, and
   *  `readSessionToken`'s own zero-arg default parameter below — leaves this at its default of
   *  `true`, i.e. production/fail-closed behaviour: the real %APPDATA% path, unconditionally.
   *  `apps/desktop/src/main/index.ts` is the one production caller that threads the real flag,
   *  taken from `resolveAppEnv().isPackaged` (`env.ts`), the same source `BFC_USER_DATA_DIR`
   *  already trusts for the same reason. */
  readonly isPackaged?: boolean;
  readonly env?: NodeJS.ProcessEnv;
}

/**
 * Test-only escape hatch (T-fix-4) for `apps/desktop/tests/smoke/consent-modal.spec.mjs`, which
 * cannot inject a `filePath` the way every unit test does (it drives the real Electron `main`
 * process end to end, which always calls `readSessionToken` with its zero-arg default). Without
 * this, that suite's first scenario accepts consent and the very next account-refresh cycle would
 * open whichever real `%APPDATA%/Godot/app_userdata/BombFarm/session.cfg` exists on the machine
 * running the suite — a real credential, used for a real authenticated request, as a side effect
 * of running tests.
 *
 * `BFC_TOKEN_PATH_OVERRIDE` is honoured only when `deps.isPackaged === false` — see the field's
 * own doc comment for how a packaged production build is guaranteed to never honour it regardless
 * of what is set in its environment.
 */
export function sessionCfgPath(deps: SessionCfgPathDeps = {}): string {
  const env = deps.env ?? process.env;
  const isPackaged = deps.isPackaged ?? true;
  if (!isPackaged && env.BFC_TOKEN_PATH_OVERRIDE) {
    return env.BFC_TOKEN_PATH_OVERRIDE;
  }
  // %APPDATA%\Godot\app_userdata\BombFarm\session.cfg is a Windows-only path by definition — it is
  // where the Godot game (Windows-only) writes its session file. `path.win32.join` is used
  // (instead of the platform-dependent `path.join`) so the separator is always `\`, deterministic
  // on every host this may run on (including ubuntu-latest CI), rather than silently producing a
  // POSIX-flavoured path on non-Windows hosts.
  const appData = env.APPDATA ?? win32.join(homedir(), 'AppData', 'Roaming');
  return win32.join(appData, 'Godot', 'app_userdata', 'BombFarm', 'session.cfg');
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
