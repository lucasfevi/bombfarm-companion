/**
 * The first-run referral notice. No DOM-rendering idiom in this project (node environment, no
 * jsdom — see next-point-ranking.test.ts), so the flag is proved as a unit and the wiring by
 * source-scanning the two files that carry it.
 */
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STRINGS } from '@/shared/i18n';
import { REFERRAL_CODE } from '@/shared/referral';
import {
  REFERRAL_NOTICE_HIDDEN_KEY,
  readReferralNoticeHidden,
  writeReferralNoticeHidden,
} from '@/app/_shell/referral-notice-storage';
import { WEB_PACKAGE_ROOT } from './helpers/web-package-root';

function memoryLocalStorage(opts?: { throwOnGet?: boolean; throwOnSet?: boolean }) {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => {
      if (opts?.throwOnGet) throw new Error('SecurityError');
      return store.get(key) ?? null;
    },
    setItem: (key: string, value: string) => {
      if (opts?.throwOnSet) throw new Error('QuotaExceededError');
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  };
}

function read(relativePath: string): string {
  return readFileSync(`${WEB_PACKAGE_ROOT}/${relativePath}`, 'utf8');
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('referral notice flag', () => {
  it('a browser that has never seen the notice is not hidden, so the notice shows once', () => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
    expect(readReferralNoticeHidden()).toBe(false);
  });

  it('dismissing writes the flag, and every later load reads it back as hidden', () => {
    const storage = memoryLocalStorage();
    vi.stubGlobal('localStorage', storage);
    writeReferralNoticeHidden();
    expect(storage.getItem(REFERRAL_NOTICE_HIDDEN_KEY)).toBe('1');
    expect(readReferralNoticeHidden()).toBe(true);
  });

  it('a store that cannot be read counts as hidden rather than showing the notice every load', () => {
    vi.stubGlobal('localStorage', memoryLocalStorage({ throwOnGet: true }));
    expect(readReferralNoticeHidden()).toBe(true);
  });

  it('a store that refuses the write dismisses for this session instead of throwing', () => {
    vi.stubGlobal('localStorage', memoryLocalStorage({ throwOnSet: true }));
    expect(() => writeReferralNoticeHidden()).not.toThrow();
  });

  it('uses a chrome-namespaced key, not one of the bf-hp-* planner-data keys', () => {
    expect(REFERRAL_NOTICE_HIDDEN_KEY).toBe('bf_referral_notice_hidden');
    expect(REFERRAL_NOTICE_HIDDEN_KEY.startsWith('bf-hp-')).toBe(false);
  });
});

describe('referral notice wiring', () => {
  const notice = read('src/app/_shell/referral-notice.tsx');
  const shell = read('src/app/_shell/app-shell-inner.tsx');

  it('renders the code from the shared constant, never inlined', () => {
    expect(notice).toContain('REFERRAL_CODE');
    expect(notice).not.toContain(REFERRAL_CODE);
  });

  it('copies through the shared hook rather than a second clipboard path', () => {
    expect(notice).toContain('useReferralCopy');
    expect(notice).not.toContain('navigator.clipboard');
  });

  it('dismisses on a successful copy only, so the manual-selection fallback stays on screen', () => {
    expect(notice).toContain('if (await copy()) onDismiss();');
  });

  it('sits below the topbar and above the quick guide, on every route', () => {
    const header = shell.indexOf('<SiteHeader');
    const noticeAt = shell.indexOf('<ReferralNotice');
    const guide = shell.indexOf('<GuideSection');
    expect(header).toBeGreaterThan(-1);
    expect(noticeAt).toBeGreaterThan(header);
    expect(guide).toBeGreaterThan(noticeAt);
    // The guide is planner-only (`onSectionPage`); the notice is shown once for the browser,
    // so gating it on a route would hide it from a first visit that lands on Farm or Account.
    expect(shell).toContain('{showReferralNotice ? <ReferralNotice');
  });

  it('persists the dismissal through the flag module, not an inline localStorage call', () => {
    expect(shell).toContain('writeReferralNoticeHidden()');
    expect(shell).toContain('readReferralNoticeHidden()');
  });

  it('is seeded as already-dismissed for e2e, so no other spec renders it', () => {
    const seed = read('e2e/fixtures/seed.ts');
    expect(seed).toContain(REFERRAL_NOTICE_HIDDEN_KEY);
    expect(seed).toContain('referralNoticeHidden: state.referralNoticeHidden !== false');
  });
});

describe('referral notice copy', () => {
  it('states the mutual reward, the stage it lands at and what is in it, in both languages', () => {
    for (const lang of ['en', 'pt'] as const) {
      expect(STRINGS[lang].referralNoticeReward).toContain('151');
      expect(STRINGS[lang].referralNoticeReward).toMatch(/we both|a gente ganha/i);
    }
    // The cage is the game's own term — "Cage" in EN, "Jaula" in PT (i18n.md rule 2).
    expect(STRINGS.en.referralNoticeReward).toMatch(/at least one Hero Cage/i);
    expect(STRINGS.pt.referralNoticeReward).toMatch(/pelo menos uma Jaula de Herói/i);
  });

  it('names the app rather than "the planner", and asks in the title', () => {
    for (const lang of ['en', 'pt'] as const) {
      expect(STRINGS[lang].referralNoticeTitle).toContain('BombFarm Companion');
      expect(STRINGS[lang].referralNoticeBody).toContain('BombFarm Companion');
    }
  });

  it('says what to do with the code and that the game accepts one per account', () => {
    expect(STRINGS.en.referralNoticeBody).toMatch(/invite screen/i);
    expect(STRINGS.en.referralNoticeBody).toMatch(/one referral code/i);
    expect(STRINGS.pt.referralNoticeBody).toMatch(/tela de convite/i);
    expect(STRINGS.pt.referralNoticeBody).toMatch(/um código de indicação só/i);
  });

  it('reads as one unmuted paragraph — the reward sentence continues the body', () => {
    const notice = read('src/app/_shell/referral-notice.tsx');
    expect(notice).toContain('{t.referralNoticeBody} {t.referralNoticeReward}');
    expect(notice).not.toContain('text-muted');
  });
});
