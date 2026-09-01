import { describe, expect, it } from 'vitest';
import { TRAY_TEXT, trayTextFor } from './tray-text.js';

describe('TRAY_TEXT', () => {
  it('has English Show and Quit labels', () => {
    expect(TRAY_TEXT.en.show).toBe('Show');
    expect(TRAY_TEXT.en.quit).toBe('Quit');
  });

  it('has Portuguese Show and Quit labels', () => {
    expect(TRAY_TEXT['pt-BR'].show).toBe('Mostrar');
    expect(TRAY_TEXT['pt-BR'].quit).toBe('Sair');
  });

  it('does not define a mini label', () => {
    expect(TRAY_TEXT.en).not.toHaveProperty('mini');
    expect(TRAY_TEXT['pt-BR']).not.toHaveProperty('mini');
  });

  it('is not byte-identical across locales', () => {
    expect(TRAY_TEXT['pt-BR'].show).not.toBe(TRAY_TEXT.en.show);
    expect(TRAY_TEXT['pt-BR'].quit).not.toBe(TRAY_TEXT.en.quit);
  });
});

describe('trayTextFor', () => {
  it('returns the en entry for "en"', () => {
    expect(trayTextFor('en')).toBe(TRAY_TEXT.en);
  });

  it('returns the pt-BR entry for "pt-BR"', () => {
    expect(trayTextFor('pt-BR')).toBe(TRAY_TEXT['pt-BR']);
  });
});
