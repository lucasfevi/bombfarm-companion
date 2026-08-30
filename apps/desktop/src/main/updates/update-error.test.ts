import { describe, expect, it } from 'vitest';
import { classifyUpdateError, updateErrorMessage } from './update-error.js';

describe('classifyUpdateError', () => {
  it.each([
    ['net::ERR_INTERNET_DISCONNECTED', 'offline'],
    ['getaddrinfo ENOTFOUND github.com', 'offline'],
    ['connect ECONNREFUSED 140.82.121.4:443', 'offline'],
    ['read ECONNRESET', 'offline'],
    ['HttpError: 403 API rate limit exceeded', 'rate-limited'],
    ['Unexpected 429 from the update server', 'rate-limited'],
    ['HttpError: 404 Not Found', 'no-release'],
    ['No published versions on GitHub', 'no-release'],
    ['Cannot find channel "beta-mac.yml" update info', 'no-release'],
  ] as const)('reads %s as %s', (message, reason) => {
    expect(classifyUpdateError(new Error(message))).toBe(reason);
  });

  it('falls back to unknown rather than guessing at an unrecognised message', () => {
    expect(classifyUpdateError(new Error('sha512 checksum mismatch'))).toBe('unknown');
  });

  it('classifies a thrown non-Error without throwing itself', () => {
    expect(classifyUpdateError('net::ERR_NAME_NOT_RESOLVED')).toBe('offline');
    expect(classifyUpdateError(undefined)).toBe('unknown');
    expect(classifyUpdateError({ status: 404 })).toBe('unknown');
  });
});

describe('updateErrorMessage', () => {
  it('keeps the original text for the log, whatever was thrown', () => {
    expect(updateErrorMessage(new Error('boom'))).toBe('boom');
    expect(updateErrorMessage('boom')).toBe('boom');
    expect(updateErrorMessage(404)).toBe('404');
  });
});
