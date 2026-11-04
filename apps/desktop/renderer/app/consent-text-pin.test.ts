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
  version: 7,
  en: '5bc30959d7c19f6f911fedf95dc30c534246f0052ac95538d41afef6689153b6',
  'pt-BR': '9e59e17b075b94e732fd91edc5e3fdfcc5ead2b79d0b54fb7b361881ae89de93',
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
