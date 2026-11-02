/**
 * The Premium licence lines are approved wording: each string is compared here, character for
 * character, with the text written out in full — never derived from the copy table under test.
 * `{name}` stands for the holder's computer name, `{date}`-style placeholders for locale dates.
 */
import { describe, expect, it } from 'vitest';
import { en } from './en';
import { ptBR } from './pt-BR';
import { sub } from './index';

const EXPECTED: Record<string, { en: string; ptBR: string }> = {
  premiumLicenceHolds: { en: 'Premium is on this PC.', ptBR: 'O Premium está neste PC.' },
  premiumLicenceElsewhere: {
    en: 'Premium is on another PC ({name}).',
    ptBR: 'O Premium está em outro PC ({name}).',
  },
  premiumLicenceUnconfirmed: {
    en: "Can't confirm your Premium — check your connection.",
    ptBR: 'Não foi possível confirmar seu Premium — verifique sua conexão.',
  },
  premiumLicenceMismatch: {
    en: "This copy of the app isn't the PC that holds your Premium.",
    ptBR: 'Esta cópia do app não é o PC que tem o seu Premium.',
  },
  premiumLicenceMoved: {
    en: "Premium moved to {name}. It's been removed from this PC.",
    ptBR: 'O Premium foi para {name}. Ele foi removido deste PC.',
  },
  premiumLicenceMovedPending: { en: 'Premium moved to {name}.', ptBR: 'O Premium foi para {name}.' },
  premiumLicenceReleased: {
    en: 'Support removed Premium from this PC.',
    ptBR: 'O suporte removeu o Premium deste PC.',
  },
  premiumLicenceEnded: {
    en: "Premium has ended. It's been removed from this PC.",
    ptBR: 'O Premium terminou. Ele foi removido deste PC.',
  },
  premiumLicenceEndedPending: { en: 'Premium has ended.', ptBR: 'O Premium terminou.' },
  premiumLicenceMoveLimit: {
    en: 'You moved Premium on {date}. You can move it again on {next}, or contact support.',
    ptBR: 'Você moveu o Premium em {date}. Você pode movê-lo de novo em {next} ou falar com o suporte.',
  },
  premiumLicenceUseHere: { en: 'Use Premium on this PC', ptBR: 'Usar o Premium neste PC' },
  premiumLicenceMoveFailed: {
    en: "Couldn't move Premium — try again.",
    ptBR: 'Não foi possível mover o Premium — tente de novo.',
  },
};

describe('Premium licence copy', () => {
  it.each(Object.entries(EXPECTED))('%s reads back exactly in both languages', (key, want) => {
    expect((en as Record<string, string>)[key]).toBe(want.en);
    expect((ptBR as Record<string, string>)[key]).toBe(want.ptBR);
  });

  it('has no licence key beyond the approved set', () => {
    const keys = (table: object) => Object.keys(table).filter((k) => k.startsWith('premiumLicence')).sort();
    expect(keys(en)).toEqual(Object.keys(EXPECTED).sort());
    expect(keys(ptBR)).toEqual(Object.keys(EXPECTED).sort());
  });

  it('fills the name and the two dates through sub()', () => {
    expect(sub(en.premiumLicenceElsewhere, { name: 'Workshop' })).toBe('Premium is on another PC (Workshop).');
    expect(sub(ptBR.premiumLicenceMoveLimit, { date: 'the first day', next: 'the last day' })).toBe(
      'Você moveu o Premium em the first day. Você pode movê-lo de novo em the last day ou falar com o suporte.',
    );
  });
});
