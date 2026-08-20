import { SessionToken } from './session.js';

/**
 * Pure INI parse for `session.cfg` (LAR-11 parse half). Adapted from the internal automation
 * prototype's API client with two deliberate changes: this returns a result union
 * instead of throwing (the desktop needs a *status* to report, not an exception to catch), and
 * the token is wrapped in `SessionToken` at the moment of parse — no plain string of it exists
 * above this module (asserted by `session-cfg.type.test.ts`... folded into `session.type.test.ts`
 * per the test coverage matrix).
 *
 * String in, result out — no filesystem here. `apps/desktop/src/main/game-api/session-token-file.ts`
 * owns the `readFileSync` half (`AD-024`).
 */
export type SessionCfgParseReason = 'no_auth_section' | 'no_token' | 'no_account_id';

export type SessionCfgParseResult =
  | { readonly ok: true; readonly accountId: string; readonly token: SessionToken }
  | { readonly ok: false; readonly reason: SessionCfgParseReason };

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
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  return value;
}

export function parseSessionCfg(text: string): SessionCfgParseResult {
  const lines = text.split(/\r?\n/);
  let sawAuthSection = false;
  let inAuth = false;
  const fields: Record<string, string> = {};

  for (const rawLine of lines) {
    const line = stripComment(rawLine).trim();
    if (line.length === 0) continue;

    const sectionMatch = /^\[([^\]]+)\]$/.exec(line);
    if (sectionMatch) {
      const isAuth = (sectionMatch[1] ?? '').trim().toLowerCase() === 'auth';
      inAuth = isAuth;
      if (isAuth) sawAuthSection = true;
      continue;
    }

    if (!inAuth) continue;

    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = stripQuotes(line.slice(eq + 1).trim());
    fields[key] = value;
  }

  if (!sawAuthSection) {
    return { ok: false, reason: 'no_auth_section' };
  }

  const rawToken = fields.token;
  if (typeof rawToken !== 'string' || rawToken.length === 0) {
    return { ok: false, reason: 'no_token' };
  }

  const accountId = fields.account_id;
  if (typeof accountId !== 'string' || accountId.length === 0) {
    return { ok: false, reason: 'no_account_id' };
  }

  return { ok: true, accountId, token: SessionToken.create(rawToken) };
}
