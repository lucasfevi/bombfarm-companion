import { describe, expect, it } from 'vitest';
import { challengeFor, createPkce, createState } from './pkce.js';

const BASE64URL_43 = /^[A-Za-z0-9_-]{43}$/;

describe('challengeFor', () => {
  it('derives the S256 challenge of the verifier in RFC 7636 appendix B', () => {
    expect(challengeFor('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });
});

describe('createPkce', () => {
  it('turns 32 random bytes into a 43 character base64url verifier and its S256 challenge', () => {
    const { verifier, challenge } = createPkce(() => Buffer.alloc(32, 0xfb));
    expect(verifier).toMatch(BASE64URL_43);
    expect(verifier).toBe(Buffer.alloc(32, 0xfb).toString('base64url'));
    expect(challenge).toBe(challengeFor(verifier));
    expect(challenge).toMatch(BASE64URL_43);
  });

  it('asks for exactly 32 bytes', () => {
    const sizes: number[] = [];
    createPkce((size) => {
      sizes.push(size);
      return Buffer.alloc(size, 1);
    });
    expect(sizes).toEqual([32]);
  });

  it('produces a different pair on each call with the real randomness', () => {
    const first = createPkce();
    const second = createPkce();
    expect(first.verifier).not.toBe(second.verifier);
    expect(first.challenge).not.toBe(second.challenge);
    expect(first.verifier).toMatch(BASE64URL_43);
  });
});

describe('createState', () => {
  it('is 43 characters of base64url from 32 bytes', () => {
    const sizes: number[] = [];
    const state = createState((size) => {
      sizes.push(size);
      return Buffer.alloc(size, 0xff);
    });
    expect(sizes).toEqual([32]);
    expect(state).toMatch(BASE64URL_43);
  });

  it('differs between calls with the real randomness', () => {
    expect(createState()).not.toBe(createState());
  });
});
