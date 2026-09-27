import { describe, expect, it } from 'vitest';
import { SITE_HOST, SITE_URL } from './site-address';

describe('site address', () => {
  it('is the custom domain, not the hosting provider default', () => {
    expect(SITE_URL).toBe('https://bombfarm-companion.app');
  });

  it('prints as the bare host', () => {
    expect(SITE_HOST).toBe('bombfarm-companion.app');
  });
});
