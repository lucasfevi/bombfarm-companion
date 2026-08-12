import { describe, expect, it } from 'vitest';
import type { GrantedConsent } from '@bombfarm/game-api';
import { SessionToken } from '@bombfarm/game-api';
import { readSessionToken, sessionCfgPath, type FsPort } from './session-token-file.js';

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

describe('sessionCfgPath — resolves exactly %APPDATA%/Godot/app_userdata/BombFarm/session.cfg (LAR-11)', () => {
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
    // the unasked/declined cases (LAR-01/LAR-04): those cases never call readSessionToken at
    // all, so a throwing port there is never reached. Here, called correctly with a GrantedConsent,
    // readSessionToken must still degrade a throwing port to a named result rather than throw.
    const fs = throwingFsPort();
    expect(() => readSessionToken(GRANTED, fs, sessionCfgPath())).not.toThrow();
    expect(readSessionToken(GRANTED, fs, sessionCfgPath())).toEqual({ ok: false, reason: 'not_found' });
  });
});
