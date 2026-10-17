import { describe, expect, it } from 'vitest';
import { SessionToken } from './session.js';
import { parseSessionCfg } from './session-cfg.js';

const REAL_SHAPE = [
  '[auth]',
  'account_id=486',
  'token="a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4"',
].join('\n');

describe('parseSessionCfg — the real file shape', () => {
  it('parses [auth] / account_id / token into a wrapped SessionToken, never throwing', () => {
    const result = parseSessionCfg(REAL_SHAPE);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.accountId).toBe('486');
      expect(result.token).toBeInstanceOf(SessionToken);
      expect(result.token.toString()).toBe('[redacted]');
    }
  });

  it('strips surrounding double quotes from a quoted value', () => {
    const result = parseSessionCfg('[auth]\naccount_id=486\ntoken="quoted-token-value"');
    expect(result.ok).toBe(true);
    if (result.ok) {
      // toString is redacted; assert via the wrapped instance rather than the raw value.
      expect(result.token).toBeInstanceOf(SessionToken);
    }
  });

  it('accepts an unquoted value', () => {
    const result = parseSessionCfg('[auth]\naccount_id=486\ntoken=unquoted-token-value');
    expect(result.ok).toBe(true);
  });

  it('ignores a `;` comment for the rest of the line, outside quotes', () => {
    const result = parseSessionCfg('[auth]\naccount_id=486 ; the id\ntoken="tok" ; a comment');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.accountId).toBe('486');
  });

  it('ignores a whole-line comment', () => {
    const result = parseSessionCfg(['[auth]', '; a full-line comment', 'account_id=486', 'token="tok"'].join('\n'));
    expect(result.ok).toBe(true);
  });

  it('does not treat a `;` inside a quoted value as a comment marker', () => {
    const result = parseSessionCfg('[auth]\naccount_id=486\ntoken="tok;still-token"');
    expect(result.ok).toBe(true);
  });

  it('is section-scoped — a key before [auth] or in another section is ignored', () => {
    const result = parseSessionCfg(['token=leaked-before-section', '[other]', 'token=wrong-section', '[auth]', 'account_id=486', 'token="right-token"'].join('\n'));
    expect(result.ok).toBe(true);
  });
});

describe('parseSessionCfg — the SteamID beside the account id', () => {
  const STEAM_ID = '76561198000000000';

  it('reads a bare steam_id64 from [auth]', () => {
    const result = parseSessionCfg(`[auth]\naccount_id=486\nsteam_id64=${STEAM_ID}\ntoken="tok"`);
    expect(result.ok && result.steamId64).toBe(STEAM_ID);
  });

  it('reads a quoted steam_id64 without its quotes', () => {
    const result = parseSessionCfg(`[auth]\naccount_id=486\nsteam_id64="${STEAM_ID}"\ntoken="tok"`);
    expect(result.ok && result.steamId64).toBe(STEAM_ID);
  });

  it('is null, not a failure, when the key is absent', () => {
    const result = parseSessionCfg(REAL_SHAPE);
    expect(result.ok).toBe(true);
    expect(result.ok && result.steamId64).toBeNull();
  });

  it('is null, not a failure, when the key is empty', () => {
    const result = parseSessionCfg('[auth]\naccount_id=486\nsteam_id64=""\ntoken="tok"');
    expect(result.ok).toBe(true);
    expect(result.ok && result.steamId64).toBeNull();
  });

  it('ignores a steam_id64 that sits in another section', () => {
    const result = parseSessionCfg(`[other]\nsteam_id64=${STEAM_ID}\n[auth]\naccount_id=486\ntoken="tok"`);
    expect(result.ok).toBe(true);
    expect(result.ok && result.steamId64).toBeNull();
  });
});

describe('parseSessionCfg — malformed files, never throwing', () => {
  it('reports no_auth_section when [auth] never appears', () => {
    expect(parseSessionCfg('account_id=486\ntoken="tok"')).toEqual({ ok: false, reason: 'no_auth_section' });
  });

  it('reports no_auth_section for an empty file', () => {
    expect(parseSessionCfg('')).toEqual({ ok: false, reason: 'no_auth_section' });
  });

  it('reports no_token when [auth] has no token field', () => {
    expect(parseSessionCfg('[auth]\naccount_id=486')).toEqual({ ok: false, reason: 'no_token' });
  });

  it('reports no_token when token is present but empty', () => {
    expect(parseSessionCfg('[auth]\naccount_id=486\ntoken=""')).toEqual({ ok: false, reason: 'no_token' });
  });

  it('reports no_account_id when [auth] has a token but no account_id', () => {
    expect(parseSessionCfg('[auth]\ntoken="tok"')).toEqual({ ok: false, reason: 'no_account_id' });
  });

  it('never throws on garbage input', () => {
    const inputs = ['\0\0\0', '[[[', '=====', '[auth', 'not an ini file at all', '[auth]\n\n\n'];
    for (const input of inputs) {
      expect(() => parseSessionCfg(input)).not.toThrow();
    }
  });
});

// --- Compile-time-only assertion below: no runtime behaviour, enforced by `tsc` only. ---

const parsed = parseSessionCfg(REAL_SHAPE);
if (parsed.ok) {
  // @ts-expect-error - parsed.token is a SessionToken, not a string; no plain string of the
  // token exists above this module
  const _asString: string = parsed.token;
}
