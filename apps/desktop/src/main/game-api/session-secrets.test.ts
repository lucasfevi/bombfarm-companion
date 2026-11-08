import { describe, expect, it } from 'vitest';
import type { GrantedConsent } from '@bombfarm/game-api';
import { readSessionSecrets, type FsPort } from './session-token-file.js';

const GRANTED: GrantedConsent = { decision: 'granted', grantedAt: '2026-08-12T13:15:38.000Z', textVersion: 1 };
const TOKEN = 'a1b2c3d4e5f6a1b2c3d4';

function fsOf(text: string | Error): FsPort {
  return {
    readFileSync: () => {
      if (text instanceof Error) throw text;
      return text;
    },
    statSync: () => ({ mtimeMs: 1 }),
  };
}

describe('readSessionSecrets', () => {
  it('returns the plain token of a well-formed file, quotes or not', () => {
    const quoted = ['[auth]', 'account_id=486', `token="${TOKEN}"`].join('\n');
    const bare = ['[auth]', 'account_id=486', `token=${TOKEN}`].join('\r\n');

    expect(readSessionSecrets(GRANTED, fsOf(quoted), 'x')).toEqual([TOKEN]);
    expect(readSessionSecrets(GRANTED, fsOf(bare), 'x')).toEqual([TOKEN]);
  });

  it('still finds a token that the file repeats', () => {
    const text = ['[auth]', 'account_id=486', `token="${TOKEN}"`, `; ${TOKEN}`, `; again ${TOKEN}`].join('\n');

    expect(readSessionSecrets(GRANTED, fsOf(text), 'x')).toEqual([TOKEN]);
  });

  it('returns nothing, and does not throw, for a missing, unreadable or malformed file', () => {
    expect(readSessionSecrets(GRANTED, fsOf(new Error('ENOENT')), 'x')).toEqual([]);
    expect(readSessionSecrets(GRANTED, fsOf('[other]\nx=1'), 'x')).toEqual([]);
    expect(readSessionSecrets(GRANTED, fsOf('[auth]\naccount_id=486'), 'x')).toEqual([]);
  });

  it('never returns the account id or other fields', () => {
    const text = ['[auth]', 'account_id=486', 'steam_id=76561198012345678', `token="${TOKEN}"`].join('\n');

    const secrets = readSessionSecrets(GRANTED, fsOf(text), 'x');

    expect(secrets).toEqual([TOKEN]);
    expect(secrets.join('')).not.toContain('486');
  });
});
