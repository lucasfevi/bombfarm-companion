import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { CONSENT_TEXT_VERSION, consentTextFor } from '@bombfarm/game-api';

/**
 * The free app's first-run consent text must stay byte-identical when Premium work lands.
 * The digests were recorded from the text as it stands; changing a single character of either
 * locale (title, clause, or button label) fails here, and a deliberate change re-records them
 * together with the text version.
 */
const RECORDED = {
  version: 6,
  en: 'd6e3dadb171d60cac3bb4feabd98f8d40835af25a93e2ed1ba7ce783b0c95b8b',
  'pt-BR': 'c1aaabd53540c6f26228aea65a6c6b68b0cee91db7246238d62cf302ac49ab98',
} as const;

const digest = (locale: 'en' | 'pt-BR') =>
  createHash('sha256').update(JSON.stringify(consentTextFor(locale)), 'utf8').digest('hex');

describe('the free app consent text is unchanged', () => {
  it('is still the recorded text version', () => {
    expect(CONSENT_TEXT_VERSION).toBe(RECORDED.version);
  });

  it.each(['en', 'pt-BR'] as const)('%s matches its recorded digest byte for byte', (locale) => {
    expect(digest(locale)).toBe(RECORDED[locale]);
  });
});
