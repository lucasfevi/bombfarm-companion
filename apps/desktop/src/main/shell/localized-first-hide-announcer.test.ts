import type { AppLocale } from '@bombfarm/contracts';
import { describe, expect, it, vi } from 'vitest';
import { createLocalizedFirstHideAnnouncer } from './localized-first-hide-announcer.js';

describe('createLocalizedFirstHideAnnouncer', () => {
  it('uses the locale in force when the notice is announced, not when it was built', () => {
    let locale: AppLocale = 'en';
    const shown: Array<{ title: string; body: string }> = [];
    const announcer = createLocalizedFirstHideAnnouncer({
      notice: { isSupported: () => true, show: (n) => void shown.push(n) },
      latch: { hasShown: () => false, markShown: vi.fn() },
      show: vi.fn(),
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      getLocale: () => locale,
    });
    locale = 'pt-BR';
    expect(announcer.announceIfFirst(true)).toBe('announced');
    expect(shown[0]?.title).toBe('O Bomb Farm Companion continua em execução');
    expect(shown[0]?.body).toContain('área de notificação');
  });
});
