import { describe, expect, it } from 'vitest';
import type { ConsentRecord, GrantedConsent } from '@bombfarm/game-api';
import { SessionToken } from '@bombfarm/game-api';
import { readGameIdentity, readSessionToken, sessionCfgPath, type FsPort, type GameIdentity } from './session-token-file.js';

const GRANTED: GrantedConsent = { decision: 'granted', grantedAt: '2026-08-12T13:15:38.000Z', textVersion: 1 };

const REAL_SHAPE = ['[auth]', 'account_id=486', 'token="a1b2c3d4e5f6a1b2c3d4"'].join('\n');

function throwingFsPort(): FsPort {
  return {
    readFileSync: () => {
      throw new Error('FsPort.readFileSync must never be called for this scenario');
    },
    statSync: () => {
      throw new Error('FsPort.statSync must never be called for this scenario');
    },
  };
}

function fakeFsPort(files: Record<string, { text: string; mtimeMs: number }>): FsPort {
  return {
    readFileSync: (path) => {
      const entry = files[path];
      if (!entry) throw new Error(`ENOENT: no such file ${path}`);
      return entry.text;
    },
    statSync: (path) => {
      const entry = files[path];
      if (!entry) throw new Error(`ENOENT: no such file ${path}`);
      return { mtimeMs: entry.mtimeMs };
    },
  };
}

describe('sessionCfgPath — resolves exactly %APPDATA%/Godot/app_userdata/BombFarm/session.cfg', () => {
  it('uses process.env.APPDATA when set', () => {
    const original = process.env.APPDATA;
    process.env.APPDATA = 'C:\\Users\\tester\\AppData\\Roaming';
    try {
      const resolved = sessionCfgPath();
      expect(resolved).toBe('C:\\Users\\tester\\AppData\\Roaming\\Godot\\app_userdata\\BombFarm\\session.cfg');
    } finally {
      if (original === undefined) delete process.env.APPDATA;
      else process.env.APPDATA = original;
    }
  });

  it('zero-arg sessionCfgPath() ignores BFC_TOKEN_PATH_OVERRIDE even when it is set (fail-closed default)', () => {
    // The production/zero-arg shape: readSessionToken(consent) -> filePath defaults to
    // sessionCfgPath() with no deps, i.e. isPackaged defaults to true, so the override below is
    // never honoured no matter what is in the real process.env (T-fix-4).
    const originalAppData = process.env.APPDATA;
    const originalOverride = process.env.BFC_TOKEN_PATH_OVERRIDE;
    process.env.APPDATA = 'C:\\Users\\tester\\AppData\\Roaming';
    process.env.BFC_TOKEN_PATH_OVERRIDE = 'C:\\temp\\should-be-ignored\\session.cfg';
    try {
      expect(sessionCfgPath()).toBe('C:\\Users\\tester\\AppData\\Roaming\\Godot\\app_userdata\\BombFarm\\session.cfg');
    } finally {
      if (originalAppData === undefined) delete process.env.APPDATA;
      else process.env.APPDATA = originalAppData;
      if (originalOverride === undefined) delete process.env.BFC_TOKEN_PATH_OVERRIDE;
      else process.env.BFC_TOKEN_PATH_OVERRIDE = originalOverride;
    }
  });

  it('honours BFC_TOKEN_PATH_OVERRIDE only when isPackaged is explicitly false', () => {
    const env = { APPDATA: 'C:\\appdata', BFC_TOKEN_PATH_OVERRIDE: 'C:\\fixtures\\session.cfg' };
    expect(sessionCfgPath({ isPackaged: false, env })).toBe('C:\\fixtures\\session.cfg');
  });

  it('ignores BFC_TOKEN_PATH_OVERRIDE when isPackaged is true — a packaged build cannot be redirected', () => {
    const env = { APPDATA: 'C:\\appdata', BFC_TOKEN_PATH_OVERRIDE: 'C:\\fixtures\\session.cfg' };
    expect(sessionCfgPath({ isPackaged: true, env })).toBe('C:\\appdata\\Godot\\app_userdata\\BombFarm\\session.cfg');
  });

  it('falls back to the real path when unpackaged but no override is set', () => {
    const env = { APPDATA: 'C:\\appdata' };
    expect(sessionCfgPath({ isPackaged: false, env })).toBe('C:\\appdata\\Godot\\app_userdata\\BombFarm\\session.cfg');
  });

  it('readSessionToken passes exactly the resolved sessionCfgPath() to the FsPort', () => {
    const path = sessionCfgPath();
    const fs = fakeFsPort({ [path]: { text: REAL_SHAPE, mtimeMs: 1000 } });
    const seenPaths: string[] = [];
    const spyPort: FsPort = {
      readFileSync: (p) => {
        seenPaths.push(p);
        return fs.readFileSync(p);
      },
      statSync: (p) => {
        seenPaths.push(p);
        return fs.statSync(p);
      },
    };

    const result = readSessionToken(GRANTED, spyPort, path);

    expect(result.ok).toBe(true);
    expect(seenPaths).toEqual([path, path]);
  });
});

describe('readSessionToken — every failure mode is a distinct named result, nothing throws', () => {
  const path = 'C:\\fake\\session.cfg';

  it('not_found when the file does not exist', () => {
    const fs = fakeFsPort({});
    expect(readSessionToken(GRANTED, fs, path)).toEqual({ ok: false, reason: 'not_found' });
  });

  it('unreadable when stat succeeds but the read throws', () => {
    const fs: FsPort = {
      statSync: () => ({ mtimeMs: 1000 }),
      readFileSync: () => {
        throw new Error('EACCES');
      },
    };
    expect(readSessionToken(GRANTED, fs, path)).toEqual({ ok: false, reason: 'unreadable' });
  });

  it('no_auth_section, no_token, no_account_id each pass through from parseSessionCfg unchanged', () => {
    const cases: Array<{ text: string; reason: string }> = [
      { text: 'account_id=486\ntoken="tok"', reason: 'no_auth_section' },
      { text: '[auth]\naccount_id=486', reason: 'no_token' },
      { text: '[auth]\ntoken="tok"', reason: 'no_account_id' },
    ];
    for (const { text, reason } of cases) {
      const fs = fakeFsPort({ [path]: { text, mtimeMs: 1000 } });
      expect(readSessionToken(GRANTED, fs, path)).toEqual({ ok: false, reason });
    }
  });

  it('ok, with the token wrapped and mtimeMs recorded', () => {
    const fs = fakeFsPort({ [path]: { text: REAL_SHAPE, mtimeMs: 424242 } });
    const result = readSessionToken(GRANTED, fs, path);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.accountId).toBe('486');
      expect(result.token).toBeInstanceOf(SessionToken);
      expect(result.mtimeMs).toBe(424242);
    }
  });

  it('never throws across every scenario above', () => {
    const fs = fakeFsPort({});
    expect(() => readSessionToken(GRANTED, fs, path)).not.toThrow();
  });
});

describe('readSessionToken — absorbs a throwing FsPort into a named result, never propagates the throw', () => {
  it('a statSync/readFileSync that throws still resolves to not_found, not an uncaught exception', () => {
    // Documents the "throws if invoked" port pattern the account-refresh suite relies on for
    // the unasked/declined cases: those cases never call readSessionToken at
    // all, so a throwing port there is never reached. Here, called correctly with a GrantedConsent,
    // readSessionToken must still degrade a throwing port to a named result rather than throw.
    const fs = throwingFsPort();
    expect(() => readSessionToken(GRANTED, fs, sessionCfgPath())).not.toThrow();
    expect(readSessionToken(GRANTED, fs, sessionCfgPath())).toEqual({ ok: false, reason: 'not_found' });
  });
});

describe('readSessionToken — the SteamID beside the account id', () => {
  const path = 'C:/fake/session.cfg';

  it('carries steam_id64 through, and null when the file has none', () => {
    const withSteam = fakeFsPort({
      [path]: { text: '[auth]\naccount_id=486\nsteam_id64=76561198000000000\ntoken="tok"', mtimeMs: 1 },
    });
    const withoutSteam = fakeFsPort({ [path]: { text: REAL_SHAPE, mtimeMs: 1 } });
    const first = readSessionToken(GRANTED, withSteam, path);
    const second = readSessionToken(GRANTED, withoutSteam, path);
    expect(first.ok && first.steamId64).toBe('76561198000000000');
    expect(second.ok && second.steamId64).toBeNull();
  });
});

describe('readGameIdentity — the two ids and never the token', () => {
  const path = 'C:/fake/session.cfg';

  it('returns exactly the account id and the SteamID', () => {
    const fs = fakeFsPort({
      [path]: { text: '[auth]\naccount_id=486\nsteam_id64="76561198000000000"\ntoken="tok"', mtimeMs: 1 },
    });
    const identity = readGameIdentity(GRANTED, fs, path);
    expect(identity).toEqual({ accountId: '486', steamId64: '76561198000000000' });
    expect(Object.keys(identity ?? {}).sort()).toEqual(['accountId', 'steamId64']);
  });

  it('returns a null SteamID when the file has none', () => {
    const fs = fakeFsPort({ [path]: { text: REAL_SHAPE, mtimeMs: 1 } });
    expect(readGameIdentity(GRANTED, fs, path)).toEqual({ accountId: '486', steamId64: null });
  });

  it('returns null when the file is missing, unreadable or malformed', () => {
    const unreadable: FsPort = {
      statSync: () => ({ mtimeMs: 1 }),
      readFileSync: () => {
        throw new Error('EACCES');
      },
    };
    const malformed = fakeFsPort({ [path]: { text: '[auth]\naccount_id=486', mtimeMs: 1 } });
    expect(readGameIdentity(GRANTED, fakeFsPort({}), path)).toBeNull();
    expect(readGameIdentity(GRANTED, unreadable, path)).toBeNull();
    expect(readGameIdentity(GRANTED, malformed, path)).toBeNull();
  });

  it('has a result type of exactly the two ids', () => {
    const exact: [keyof GameIdentity] extends ['accountId' | 'steamId64']
      ? ['accountId' | 'steamId64'] extends [keyof GameIdentity]
        ? true
        : never
      : never = true;
    expect(exact).toBe(true);
  });

  it('cannot be called without a granted consent', () => {
    const declined: ConsentRecord = { decision: 'declined', textVersion: 1 };
    // @ts-expect-error a consent that is not statically granted is refused at compile time
    expect(readGameIdentity(declined, fakeFsPort({}), path)).toBeNull();
  });
});
