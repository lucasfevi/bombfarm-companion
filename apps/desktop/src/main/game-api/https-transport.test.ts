import { describe, expect, it } from 'vitest';
import { companionUserAgent, withUserAgent } from './https-transport.js';

describe('companionUserAgent', () => {
  it('names the product and the running version', () => {
    expect(companionUserAgent('0.14.0')).toBe('Bomb Farm Companion/0.14.0');
  });

  it('carries whatever version the app reports, so a release is distinguishable on the wire', () => {
    expect(companionUserAgent('1.2.3')).toBe('Bomb Farm Companion/1.2.3');
  });
});

describe('withUserAgent — what the socket actually sends', () => {
  const built = {
    Authorization: 'Bearer token',
    Accept: 'application/json',
    Host: 'app.bombfarm.net',
    Connection: 'close',
  } as const;

  it('adds the identity beside every header the request already carries, changing none of them', () => {
    expect(withUserAgent(built, 'UA/1')).toEqual({ ...built, 'User-Agent': 'UA/1' });
  });

  it('the account path is never anonymous — node:https sends no user-agent of its own', () => {
    expect(withUserAgent(built, 'UA/1')['User-Agent']).toBe('UA/1');
  });

  it('does not mutate the headers it was given', () => {
    const headers = { ...built };
    withUserAgent(headers, 'UA/1');
    expect(headers).toEqual(built);
  });
});
