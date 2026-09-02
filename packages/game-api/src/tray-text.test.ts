import { describe, expect, it } from 'vitest';
import { TRAY_TEXT, trayTextFor } from './tray-text.js';

describe('TRAY_TEXT', () => {
  it('has English Show, Mini, and Quit labels', () => {
    expect(TRAY_TEXT.en.show).toBe('Show');
    expect(TRAY_TEXT.en.mini).toBe('Mini');
    expect(TRAY_TEXT.en.quit).toBe('Quit');
  });

  it('has Portuguese Show, Mini, and Quit labels', () => {
    expect(TRAY_TEXT['pt-BR'].show).toBe('Mostrar');
    expect(TRAY_TEXT['pt-BR'].mini).toBe('Mini');
    expect(TRAY_TEXT['pt-BR'].quit).toBe('Sair');
  });

  it('defines mini in both locales', () => {
    expect(TRAY_TEXT.en).toHaveProperty('mini');
    expect(TRAY_TEXT['pt-BR']).toHaveProperty('mini');
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
