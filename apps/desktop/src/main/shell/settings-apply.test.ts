import { DEFAULT_SETTINGS, type AppSettings } from '@bombfarm/contracts';
import { describe, expect, it, vi } from 'vitest';
import { applyAlwaysOnTopMain, applyLocale } from './settings-apply.js';

const BASE: AppSettings = {
  schemaVersion: 2,
  locale: 'en',
  alwaysOnTopMain: true,
  alwaysOnTopMini: true,
};

describe('applyLocale', () => {
  it('spreads the current object and forces schemaVersion 2', () => {
    const persist = vi.fn((settings: AppSettings) => ({
      settings,
      persisted: true,
      reason: null,
    }));

    const result = applyLocale({ current: BASE, next: 'pt-BR', persist });

    expect(result.settings).toEqual({
      schemaVersion: 2,
      locale: 'pt-BR',
      alwaysOnTopMain: true,
      alwaysOnTopMini: true,
    });
    expect(persist).toHaveBeenCalledWith(result.settings);
  });

  it('returns applied settings with persisted false when the write fails', () => {
    const persist = vi.fn(() => ({
      settings: { ...BASE, locale: 'pt-BR' as const },
      persisted: false,
      reason: 'not_writable' as const,
    }));

    const result = applyLocale({ current: BASE, next: 'pt-BR', persist });

    expect(result.settings.locale).toBe('pt-BR');
    expect(result.settings.alwaysOnTopMain).toBe(true);
    expect(result.settings.alwaysOnTopMini).toBe(true);
    expect(result.persisted).toBe(false);
    expect(result.reason).toBe('not_writable');
  });
});

describe('applyAlwaysOnTopMain', () => {
  it('calls setAlwaysOnTop with normal level and persists the spread object', () => {
    const setAlwaysOnTop = vi.fn();
    const persist = vi.fn((settings: AppSettings) => ({
      settings,
      persisted: true,
      reason: null,
    }));

    const result = applyAlwaysOnTopMain({
      current: { ...DEFAULT_SETTINGS, locale: 'pt-BR' },
      enabled: true,
      setAlwaysOnTop,
      persist,
    });

    expect(setAlwaysOnTop).toHaveBeenCalledWith(true, 'normal');
    expect(result.settings).toEqual({
      schemaVersion: 2,
      locale: 'pt-BR',
      alwaysOnTopMain: true,
      alwaysOnTopMini: false,
    });
    expect(persist).toHaveBeenCalledWith(result.settings);
  });

  it('returns applied settings with persisted false when the write fails', () => {
    const setAlwaysOnTop = vi.fn();
    const persist = vi.fn(() => ({
      settings: { ...DEFAULT_SETTINGS, alwaysOnTopMain: true },
      persisted: false,
      reason: 'no_store' as const,
    }));

    const result = applyAlwaysOnTopMain({
      current: DEFAULT_SETTINGS,
      enabled: true,
      setAlwaysOnTop,
      persist,
    });

    expect(setAlwaysOnTop).toHaveBeenCalledWith(true, 'normal');
    expect(result.settings.alwaysOnTopMain).toBe(true);
    expect(result.persisted).toBe(false);
    expect(result.reason).toBe('no_store');
  });

  it('is a no-op for a non-boolean enabled argument', () => {
    const setAlwaysOnTop = vi.fn();
    const persist = vi.fn();

    const result = applyAlwaysOnTopMain({
      current: BASE,
      enabled: 'yes',
      setAlwaysOnTop,
      persist,
    });

    expect(result).toEqual({ settings: BASE, persisted: true, reason: null });
    expect(setAlwaysOnTop).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });

  it('preserves alwaysOnTopMini when toggling main', () => {
    const setAlwaysOnTop = vi.fn();
    const persist = vi.fn((settings: AppSettings) => ({
      settings,
      persisted: true,
      reason: null,
    }));

    const result = applyAlwaysOnTopMain({
      current: BASE,
      enabled: false,
      setAlwaysOnTop,
      persist,
    });

    expect(result.settings.alwaysOnTopMini).toBe(true);
    expect(result.settings.alwaysOnTopMain).toBe(false);
  });
});
