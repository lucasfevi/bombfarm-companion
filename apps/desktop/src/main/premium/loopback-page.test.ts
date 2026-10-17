import { describe, expect, it } from 'vitest';
import { LOOPBACK_PAGE } from './loopback-page.js';

describe('the sign-in finished page', () => {
  it.each([
    'You are signed in',
    'Return to the desktop app. You can close this tab.',
    'Você está conectado',
    'Volte para o app de desktop. Você pode fechar esta aba.',
  ])('says %j', (sentence) => {
    expect(LOOPBACK_PAGE).toContain(sentence);
  });

  it('is static: no script, no link, no external resource', () => {
    expect(LOOPBACK_PAGE).not.toMatch(/<script/i);
    expect(LOOPBACK_PAGE).not.toMatch(/href/i);
    expect(LOOPBACK_PAGE).not.toMatch(/\bsrc\s*=/i);
    expect(LOOPBACK_PAGE).not.toMatch(/https?:\/\//i);
  });

  it('declares UTF-8 and styles itself inline', () => {
    expect(LOOPBACK_PAGE).toMatch(/<meta charset="utf-8">/);
    expect(LOOPBACK_PAGE).toMatch(/<style>/);
  });
});
