import { describe, expect, it } from 'vitest';
import { fingerprint } from './fingerprint.js';

// 32 salt bytes (255 down to 224) as base64url, the form the server hands out.
const SALT = '__79_Pv6-fj39vX08_Lx8O_u7ezr6uno5-bl5OPi4eA';
const GUID = '11111111-2222-3333-4444-555555555555';
// HMAC-SHA256(key = the salt's 32 bytes, message = the guid as UTF-8), computed outside the module.
const KNOWN = '6ff6dca1ff89abedd586d59f08ce502a0671607f5082d1a15e84d2d7ea7ff52b';

describe('fingerprint', () => {
  it('matches the fixed HMAC-SHA256 vector', () => {
    expect(fingerprint(SALT, GUID)).toBe(KNOWN);
  });

  it('is 64 lowercase hex characters', () => {
    expect(fingerprint(SALT, GUID)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('differs with the salt, so two users on one PC never share a fingerprint', () => {
    const other = '0AECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8';
    expect(fingerprint(other, GUID)).not.toBe(KNOWN);
  });

  it('differs with the machine id', () => {
    expect(fingerprint(SALT, '11111111-2222-3333-4444-555555555556')).not.toBe(KNOWN);
  });

  it('does not contain the raw machine id', () => {
    expect(fingerprint(SALT, GUID)).not.toContain(GUID.replace(/-/g, ''));
  });
});
