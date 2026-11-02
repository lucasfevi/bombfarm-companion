import { describe, expect, it } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { signedOutPremiumView, type LicenceState, type PremiumLicenceView, type PremiumView } from '@bombfarm/contracts';
import { CopyProvider } from '../../lib/copy';
import { PremiumLicenceLine } from './premium-licence-line';
import { PremiumScreenView } from './premium-view';

type Locale = 'en' | 'pt-BR';

const LAST = '2026-10-01T12:00:00.000Z';
const NEXT = '2026-11-01T12:00:00.000Z';
// Dates as each locale formats them (long form), written out rather than computed.
const DATES = {
  en: { last: 'October 1, 2026', next: 'November 1, 2026' },
  'pt-BR': { last: '1 de outubro de 2026', next: '1 de novembro de 2026' },
} as const;

function licence(state: LicenceState, rest: Partial<PremiumLicenceView> = {}): PremiumLicenceView {
  return { state, moveInFlight: false, moveFailed: false, removalDone: true, ...rest };
}

function withCopy(locale: Locale, child: ReactElement): string {
  return renderToStaticMarkup(createElement(CopyProvider, { locale, children: child }));
}

function renderLine(l: PremiumLicenceView | null, locale: Locale, supportUrl?: string | null): string {
  return withCopy(
    locale,
    createElement(PremiumLicenceLine, {
      licence: l,
      onUseHere: () => {},
      ...(supportUrl === undefined ? {} : { supportUrl }),
    }),
  );
}

function plain(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

const lineText = (html: string) => {
  const m = /data-testid="premium-licence-line"[^>]*>(.*?)<\/p>/s.exec(html);
  return m === null ? null : plain(m[1] ?? '');
};

const buttonTag = (html: string) => /<button[^>]*data-testid="premium-use-here"[^>]*>/.exec(html)?.[0] ?? '';
const isDisabled = (tag: string) => /\sdisabled(=|\s|>)/.test(tag);

const USE_HERE = { en: 'Use Premium on this PC', 'pt-BR': 'Usar o Premium neste PC' } as const;

interface Row {
  state: LicenceState;
  rest: Partial<PremiumLicenceView>;
  line: Record<Locale, string>;
  button: 'enabled' | 'disabled' | 'none';
}

const ROWS: Row[] = [
  { state: 'holds', rest: {}, line: { en: 'Premium is on this PC.', 'pt-BR': 'O Premium está neste PC.' }, button: 'none' },
  {
    state: 'elsewhere',
    rest: { holderName: 'Workshop' },
    line: { en: 'Premium is on another PC (Workshop).', 'pt-BR': 'O Premium está em outro PC (Workshop).' },
    button: 'enabled',
  },
  {
    state: 'unconfirmed',
    rest: { reason: 'network' },
    line: {
      en: "Can't confirm your Premium — check your connection.",
      'pt-BR': 'Não foi possível confirmar seu Premium — verifique sua conexão.',
    },
    button: 'none',
  },
  {
    state: 'mismatch',
    rest: {},
    line: {
      en: "This copy of the app isn't the PC that holds your Premium.",
      'pt-BR': 'Esta cópia do app não é o PC que tem o seu Premium.',
    },
    button: 'enabled',
  },
  {
    state: 'moved',
    rest: { holderName: 'Workshop' },
    line: {
      en: "Premium moved to Workshop. It's been removed from this PC.",
      'pt-BR': 'O Premium foi para Workshop. Ele foi removido deste PC.',
    },
    button: 'none',
  },
  {
    state: 'released',
    rest: {},
    line: { en: 'Support removed Premium from this PC.', 'pt-BR': 'O suporte removeu o Premium deste PC.' },
    button: 'enabled',
  },
  {
    state: 'ended',
    rest: {},
    line: {
      en: "Premium has ended. It's been removed from this PC.",
      'pt-BR': 'O Premium terminou. Ele foi removido deste PC.',
    },
    button: 'none',
  },
  {
    state: 'move_limit',
    rest: { lastMoveAt: LAST, nextMoveAt: NEXT },
    line: {
      en: `You moved Premium on ${DATES.en.last}. You can move it again on ${DATES.en.next}, or contact support.`,
      'pt-BR': `Você moveu o Premium em ${DATES['pt-BR'].last}. Você pode movê-lo de novo em ${DATES['pt-BR'].next} ou falar com o suporte.`,
    },
    button: 'disabled',
  },
];

describe('the licence line — every state in both languages', () => {
  for (const locale of ['en', 'pt-BR'] as const) {
    it.each(ROWS)(`$state shows exactly its line and button in ${locale}`, ({ state, rest, line, button }) => {
      const html = renderLine(licence(state, rest), locale);

      expect(lineText(html)).toBe(line[locale]);
      expect(html.match(/data-testid="premium-licence-line"/g)).toHaveLength(1);
      if (button === 'none') {
        expect(html).not.toContain('data-testid="premium-use-here"');
      } else {
        expect(plain(html)).toContain(USE_HERE[locale]);
        expect(isDisabled(buttonTag(html))).toBe(button === 'disabled');
        expect(buttonTag(html)).not.toBe('');
      }
      expect(html).not.toContain('data-testid="premium-licence-move-failed"');
    });
  }

  it.each(['signed_out', 'inactive'] as const)('%s shows no licence line', (state) => {
    for (const locale of ['en', 'pt-BR'] as const) {
      expect(renderLine(licence(state), locale)).toBe('');
    }
  });

  it('shows nothing without a licence view', () => {
    expect(renderLine(null, 'en')).toBe('');
  });
});

describe('the removal states before the removal is done', () => {
  it.each([
    ['moved', 'Premium moved to Workshop.', 'O Premium foi para Workshop.'],
    ['ended', 'Premium has ended.', 'O Premium terminou.'],
  ] as const)('%s shows only its first sentence', (state, en, ptBR) => {
    const l = licence(state, { holderName: 'Workshop', removalDone: false });

    expect(lineText(renderLine(l, 'en'))).toBe(en);
    expect(lineText(renderLine(l, 'pt-BR'))).toBe(ptBR);
  });

  it('shows the full line once the removal is done', () => {
    expect(lineText(renderLine(licence('moved', { holderName: 'Workshop', removalDone: true }), 'en'))).toContain(
      "It's been removed from this PC.",
    );
  });
});

describe('the Use Premium on this PC button', () => {
  it('is disabled while a Move is in flight, and enabled otherwise', () => {
    const tagFor = (inFlight: boolean) =>
      buttonTag(renderLine(licence('elsewhere', { holderName: 'W', moveInFlight: inFlight }), 'en'));

    expect(isDisabled(tagFor(true))).toBe(true);
    expect(isDisabled(tagFor(false))).toBe(false);
  });

  it('shows the failure line when the last Move failed, in both languages', () => {
    const l = licence('elsewhere', { holderName: 'W', moveFailed: true });

    expect(plain(renderLine(l, 'en'))).toContain("Couldn't move Premium — try again.");
    expect(plain(renderLine(l, 'pt-BR'))).toContain('Não foi possível mover o Premium — tente de novo.');
  });
});

describe('contact support in the move limit line', () => {
  const l = licence('move_limit', { lastMoveAt: LAST, nextMoveAt: NEXT });

  it('is plain text while there is no support address', () => {
    for (const locale of ['en', 'pt-BR'] as const) {
      expect(renderLine(l, locale)).not.toContain('<a ');
      expect(renderLine(l, locale, null)).not.toContain('<a ');
    }
  });

  it('becomes a link on exactly those words once an address is set', () => {
    const en = renderLine(l, 'en', 'https://example.test/support');
    const pt = renderLine(l, 'pt-BR', 'https://example.test/support');

    expect(en).toMatch(/<a [^>]*href="https:\/\/example\.test\/support"[^>]*>contact support<\/a>/);
    expect(pt).toMatch(/<a [^>]*href="https:\/\/example\.test\/support"[^>]*>falar com o suporte<\/a>/);
    expect(lineText(en)).toBe(ROWS.find((r) => r.state === 'move_limit')?.line.en);
  });
});

describe('the licence line on the Premium tab', () => {
  const view = (l: PremiumLicenceView | null): PremiumView => ({
    ...signedOutPremiumView,
    session: 'signed-in',
    visible: true,
    status: {
      active: true,
      kinds: ['subscription'],
      until: '2026-12-01T12:00:00.000Z',
      awaitingPaymentUntil: null,
      graceUntil: '2026-10-30T12:00:00.000Z',
      cancellationAt: null,
      paymentFailed: false,
      pendingFirstPayment: false,
      disputeHold: false,
    },
    playingAccount: { state: 'other', reason: 'other_account' },
    licence: l,
  });
  const screen = (v: PremiumView) =>
    withCopy(
      'en',
      createElement(PremiumScreenView, {
        view: v,
        notice: null,
        onSignIn: () => {},
        onRefresh: () => {},
        onManage: () => {},
        onUseHere: () => {},
      }),
    );

  it('sits after the paused notice and the payment banners, which keep their place', () => {
    const html = screen(view(licence('holds')));

    const paused = html.indexOf('premium-banner-paused-other_account');
    const grace = html.indexOf('premium-banner-grace');
    const line = html.indexOf('data-testid="premium-licence-line"');
    expect(paused).toBeGreaterThan(-1);
    expect(grace).toBeGreaterThan(paused);
    expect(line).toBeGreaterThan(grace);
  });

  it.each(['elsewhere', 'unconfirmed', 'mismatch', 'moved', 'released', 'ended', 'move_limit', 'inactive'] as const)(
    'hides the paused notice in %s but keeps the payment banner',
    (state) => {
      const html = screen(view(licence(state)));

      expect(html).not.toContain('premium-banner-paused');
      expect(html).toContain('premium-banner-grace');
    },
  );

  it('hides the paused notice when there is no licence view', () => {
    expect(screen(view(null))).not.toContain('premium-banner-paused');
  });
});
