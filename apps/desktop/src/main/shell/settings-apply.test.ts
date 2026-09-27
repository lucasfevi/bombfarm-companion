import { DEFAULT_SETTINGS, type AppSettings } from '@bombfarm/contracts';
import { describe, expect, it, vi } from 'vitest';
import {
  applyAlwaysOnTopMain,
  applyAlwaysOnTopMini,
  applyForgeWritesEnabled,
  applyLocale,
  applyMarketQuoteCurrency,
  applyRestartGameOnExit,
  applyUsagePingEnabled,
} from './settings-apply.js';

const BASE: AppSettings = {
  schemaVersion: 4,
  locale: 'en',
  alwaysOnTopMain: true,
  alwaysOnTopMini: true,
  forgeWritesEnabled: true,
  restartGameOnExit: true,
  marketQuoteCurrency: 'BRL',
  usagePingEnabled: true,
};

describe('applyLocale', () => {
  it('spreads the current object and forces schemaVersion 3', () => {
    const persist = vi.fn((settings: AppSettings) => ({
      settings,
      persisted: true,
      reason: null,
    }));

    const result = applyLocale({ current: BASE, next: 'pt-BR', persist });

    expect(result.settings).toEqual({
      schemaVersion: 4,
      locale: 'pt-BR',
      alwaysOnTopMain: true,
      alwaysOnTopMini: true,
      forgeWritesEnabled: true,
      restartGameOnExit: true,
      marketQuoteCurrency: 'BRL',
      usagePingEnabled: true,
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
      schemaVersion: 4,
      locale: 'pt-BR',
      alwaysOnTopMain: true,
      alwaysOnTopMini: false,
      forgeWritesEnabled: false,
      restartGameOnExit: false,
      marketQuoteCurrency: 'BRL',
      usagePingEnabled: true,
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

describe('applyAlwaysOnTopMini', () => {
  it('calls setAlwaysOnTop with screen-saver level and persists schemaVersion 3', () => {
    const setAlwaysOnTop = vi.fn();
    const persist = vi.fn((settings: AppSettings) => ({
      settings,
      persisted: true,
      reason: null,
    }));

    const result = applyAlwaysOnTopMini({
      current: { ...DEFAULT_SETTINGS, locale: 'pt-BR' },
      enabled: true,
      setAlwaysOnTop,
      persist,
    });

    expect(setAlwaysOnTop).toHaveBeenCalledWith(true, 'screen-saver');
    expect(result.settings).toEqual({
      schemaVersion: 4,
      locale: 'pt-BR',
      alwaysOnTopMain: false,
      alwaysOnTopMini: true,
      forgeWritesEnabled: false,
      restartGameOnExit: false,
      marketQuoteCurrency: 'BRL',
      usagePingEnabled: true,
    });
    expect(persist).toHaveBeenCalledWith(result.settings);
  });

  it('does not call main setAlwaysOnTop through this handler', () => {
    const setAlwaysOnTop = vi.fn();
    const persist = vi.fn((settings: AppSettings) => ({
      settings,
      persisted: true,
      reason: null,
    }));

    applyAlwaysOnTopMini({
      current: DEFAULT_SETTINGS,
      enabled: true,
      setAlwaysOnTop,
      persist,
    });

    expect(setAlwaysOnTop).toHaveBeenCalledWith(true, 'screen-saver');
    expect(setAlwaysOnTop).not.toHaveBeenCalledWith(true, 'normal');
  });
});

describe('applyForgeWritesEnabled', () => {
  it('persists the spread object with the flag applied and touches no window', () => {
    const persist = vi.fn((settings: AppSettings) => ({
      settings,
      persisted: true,
      reason: null,
    }));

    const result = applyForgeWritesEnabled({ current: { ...DEFAULT_SETTINGS, locale: 'pt-BR' }, enabled: true, persist });

    expect(result.settings).toEqual({
      schemaVersion: 4,
      locale: 'pt-BR',
      alwaysOnTopMain: false,
      alwaysOnTopMini: false,
      forgeWritesEnabled: true,
      restartGameOnExit: false,
      marketQuoteCurrency: 'BRL',
      usagePingEnabled: true,
    });
    expect(persist).toHaveBeenCalledWith(result.settings);
  });

  it('turning it off persists false and leaves every other setting alone', () => {
    const persist = vi.fn((settings: AppSettings) => ({
      settings,
      persisted: true,
      reason: null,
    }));

    const result = applyForgeWritesEnabled({ current: BASE, enabled: false, persist });

    expect(result.settings).toEqual({ ...BASE, forgeWritesEnabled: false });
  });

  it('returns applied settings with persisted false when the write fails', () => {
    const persist = vi.fn(() => ({
      settings: { ...DEFAULT_SETTINGS, forgeWritesEnabled: true },
      persisted: false,
      reason: 'no_store' as const,
    }));

    const result = applyForgeWritesEnabled({ current: DEFAULT_SETTINGS, enabled: true, persist });

    expect(result.settings.forgeWritesEnabled).toBe(true);
    expect(result.persisted).toBe(false);
    expect(result.reason).toBe('no_store');
  });

  it('is a no-op for a non-boolean enabled argument — the switch cannot be turned on by a string', () => {
    const persist = vi.fn();

    const result = applyForgeWritesEnabled({ current: DEFAULT_SETTINGS, enabled: 'true', persist });

    expect(result).toEqual({ settings: DEFAULT_SETTINGS, persisted: true, reason: null });
    expect(persist).not.toHaveBeenCalled();
  });
});

describe('applyRestartGameOnExit', () => {
  it('persists the spread object with the flag applied and calls setEnabled', () => {
    const setEnabled = vi.fn();
    const persist = vi.fn((settings: AppSettings) => ({
      settings,
      persisted: true,
      reason: null,
    }));

    const result = applyRestartGameOnExit({
      current: { ...DEFAULT_SETTINGS, locale: 'pt-BR' },
      enabled: true,
      setEnabled,
      persist,
    });

    expect(setEnabled).toHaveBeenCalledWith(true);
    expect(result.settings).toEqual({
      schemaVersion: 4,
      locale: 'pt-BR',
      alwaysOnTopMain: false,
      alwaysOnTopMini: false,
      forgeWritesEnabled: false,
      restartGameOnExit: true,
      marketQuoteCurrency: 'BRL',
      usagePingEnabled: true,
    });
    expect(persist).toHaveBeenCalledWith(result.settings);
  });

  it('turning it off persists false, leaves every other setting alone, and calls setEnabled', () => {
    const setEnabled = vi.fn();
    const persist = vi.fn((settings: AppSettings) => ({
      settings,
      persisted: true,
      reason: null,
    }));

    const result = applyRestartGameOnExit({ current: BASE, enabled: false, setEnabled, persist });

    expect(setEnabled).toHaveBeenCalledWith(false);
    expect(result.settings).toEqual({ ...BASE, restartGameOnExit: false });
  });

  it('is a no-op for a non-boolean enabled argument — the switch cannot be turned on by a string', () => {
    const setEnabled = vi.fn();
    const persist = vi.fn();

    const result = applyRestartGameOnExit({ current: DEFAULT_SETTINGS, enabled: 'true', setEnabled, persist });

    expect(result).toEqual({ settings: DEFAULT_SETTINGS, persisted: true, reason: null });
    expect(setEnabled).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });
});

describe('applyMarketQuoteCurrency', () => {
  it('persists the spread object with the currency applied and every other setting alone', () => {
    const persist = vi.fn((settings: AppSettings) => ({
      settings,
      persisted: true,
      reason: null,
    }));

    const result = applyMarketQuoteCurrency({ current: BASE, next: 'USD', persist });

    expect(result.settings).toEqual({ ...BASE, marketQuoteCurrency: 'USD' });
    expect(persist).toHaveBeenCalledWith(result.settings);
  });

  it('returns applied settings with persisted false when the write fails', () => {
    const persist = vi.fn(() => ({
      settings: { ...DEFAULT_SETTINGS, marketQuoteCurrency: 'EUR' as const },
      persisted: false,
      reason: 'not_writable' as const,
    }));

    const result = applyMarketQuoteCurrency({ current: DEFAULT_SETTINGS, next: 'EUR', persist });

    expect(result.settings.marketQuoteCurrency).toBe('EUR');
    expect(result.persisted).toBe(false);
    expect(result.reason).toBe('not_writable');
  });

  it('is a no-op for a code the desktop cannot fetch in — nothing is persisted, the current setting stands', () => {
    const persist = vi.fn();

    for (const next of ['SEK', 'brl', 7, null, undefined]) {
      const result = applyMarketQuoteCurrency({ current: DEFAULT_SETTINGS, next, persist });
      expect(result).toEqual({ settings: DEFAULT_SETTINGS, persisted: true, reason: null });
    }
    expect(persist).not.toHaveBeenCalled();
  });
});

describe('applyUsagePingEnabled', () => {
  it('turning it off persists false, leaves every other setting alone, and tells the ping', () => {
    const setEnabled = vi.fn();
    const persist = vi.fn((settings: AppSettings) => ({ settings, persisted: true, reason: null }));

    const result = applyUsagePingEnabled({ current: BASE, enabled: false, setEnabled, persist });

    expect(setEnabled).toHaveBeenCalledWith(false);
    expect(result.settings).toEqual({ ...BASE, usagePingEnabled: false });
    expect(persist).toHaveBeenCalledWith(result.settings);
  });

  it('turning it back on persists true and tells the ping', () => {
    const setEnabled = vi.fn();
    const persist = vi.fn((settings: AppSettings) => ({ settings, persisted: true, reason: null }));

    const result = applyUsagePingEnabled({
      current: { ...BASE, usagePingEnabled: false },
      enabled: true,
      setEnabled,
      persist,
    });

    expect(setEnabled).toHaveBeenCalledWith(true);
    expect(result.settings.usagePingEnabled).toBe(true);
  });

  it('is a no-op for a non-boolean enabled argument — the switch cannot be flipped by a string', () => {
    const setEnabled = vi.fn();
    const persist = vi.fn();

    const result = applyUsagePingEnabled({ current: DEFAULT_SETTINGS, enabled: 'false', setEnabled, persist });

    expect(result).toEqual({ settings: DEFAULT_SETTINGS, persisted: true, reason: null });
    expect(setEnabled).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });
});
