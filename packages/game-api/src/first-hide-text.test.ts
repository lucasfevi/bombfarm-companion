import { describe, expect, it } from 'vitest';
import { FIRST_HIDE_TEXT, firstHideTextFor } from './first-hide-text.js';

describe('FIRST_HIDE_TEXT', () => {
  it('has a non-empty title and body in both locales', () => {
    for (const locale of ['en', 'pt-BR'] as const) {
      expect(FIRST_HIDE_TEXT[locale].title.trim()).not.toBe('');
      expect(FIRST_HIDE_TEXT[locale].body.trim()).not.toBe('');
    }
  });

  it('English says the companion is still running and points to the notification area icon', () => {
    const { title, body } = FIRST_HIDE_TEXT.en;
    expect(title).toMatch(/still running/i);
    expect(body).toMatch(/icon/i);
    expect(body).toMatch(/notification area/i);
  });

  it('Portuguese says the companion is still running and points to the notification area icon', () => {
    const { title, body } = FIRST_HIDE_TEXT['pt-BR'];
    expect(title).toMatch(/continua em execução/i);
    expect(body).toMatch(/ícone/i);
    expect(body).toMatch(/área de notificação/i);
  });

  it('is not byte-identical across locales', () => {
    expect(FIRST_HIDE_TEXT['pt-BR'].title).not.toBe(FIRST_HIDE_TEXT.en.title);
    expect(FIRST_HIDE_TEXT['pt-BR'].body).not.toBe(FIRST_HIDE_TEXT.en.body);
  });
});

describe('firstHideTextFor', () => {
  it('returns the entry for each locale', () => {
    expect(firstHideTextFor('en')).toBe(FIRST_HIDE_TEXT.en);
    expect(firstHideTextFor('pt-BR')).toBe(FIRST_HIDE_TEXT['pt-BR']);
  });
});
