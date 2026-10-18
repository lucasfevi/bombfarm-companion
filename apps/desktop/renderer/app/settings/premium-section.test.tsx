import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { signedOutPremiumView, type PremiumReportOutcome, type PremiumView } from '@bombfarm/contracts';
import { CopyProvider } from '../../lib/copy';
import { en } from '../../lib/copy/en';
import { ptBR } from '../../lib/copy/pt-BR';
import { PremiumSectionView } from './premium-section';

const signedIn: PremiumView = {
  ...signedOutPremiumView,
  session: 'signed-in',
  me: { methods: ['discord', 'steam'], steamVerified: true, gameAccountLinked: true, admitted: false },
};

function render(view: PremiumView, locale: 'en' | 'pt-BR' = 'en'): string {
  return renderToStaticMarkup(
    createElement(CopyProvider, {
      locale,
      children: createElement(PremiumSectionView, { view, onSignIn: () => {}, onCancel: () => {}, onSignOut: () => {} }),
    }),
  );
}

function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ');
}

describe('the Premium section of Settings', () => {
  it('shows Sign in when signed out, whatever the tab visibility', () => {
    for (const visible of [false, true]) {
      const html = render({ ...signedOutPremiumView, visible });
      expect(html).toContain('data-testid="settings-premium-sign-in"');
      expect(text(html)).toContain(en.settingsPremiumSectionTitle);
      expect(text(html)).toContain(en.settingsPremiumSignInAction);
      expect(text(html)).toContain(en.settingsPremiumSignInHelp);
    }
  });

  it('shows the hint and Cancel while signing in', () => {
    const html = render({ ...signedOutPremiumView, session: 'signing-in' });

    expect(html).toContain('data-testid="settings-premium-cancel"');
    expect(html).not.toContain('data-testid="settings-premium-sign-in"');
    expect(text(html)).toContain('Finish signing in in your browser');
    expect(text(html)).toContain('Cancel');
  });

  it('shows the sign-in methods and Sign out when signed in', () => {
    const html = render(signedIn);

    expect(html).toContain('data-testid="settings-premium-sign-out"');
    expect(text(html)).toContain('Signed in with Discord, Steam');
    expect(text(html)).toContain('Sign out');
  });

  it('says only that the player is signed in when no methods are known yet', () => {
    const html = text(render({ ...signedIn, me: null }));

    expect(html).toContain(`${en.settingsPremiumSignInLabel} ${en.settingsPremiumSignedIn}`);
    expect(html).not.toContain('Signed in with');
  });

  it('tells the player their sign-in ended', () => {
    const html = render({ ...signedOutPremiumView, ended: 'expired' });

    expect(text(html)).toContain('Your sign-in ended — sign in again');
    expect(html).toContain('aria-hidden="false"');
  });

  it('says the sign-in lasts until the app closes when it is not remembered', () => {
    expect(text(render({ ...signedIn, rememberedAcrossRestarts: false }))).toContain(
      "You're signed in until the app closes",
    );
  });

  it('keeps an empty hidden slot for messages when there is nothing to say', () => {
    const html = render(signedOutPremiumView);

    expect(html).toContain('data-testid="settings-premium-message"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('invisible');
  });

  it.each([
    ['timed-out', 'Sign-in timed out'],
    ['declined', 'Sign-in was cancelled on the website'],
    ['refused', "Sign-in didn't complete — try again"],
    ['unreachable', "Couldn't reach the server — try again"],
    ['bad-response', 'Something went wrong — try again'],
    ['port-unavailable', "Couldn't start sign-in on this PC"],
    ['browser-unavailable', "Couldn't open your browser"],
  ] as const)('says why an attempt that ended %s ended', (end, sentence) => {
    expect(text(render({ ...signedOutPremiumView, lastSignInEnd: end }))).toContain(sentence);
  });

  it('says nothing about an attempt the player cancelled', () => {
    expect(render({ ...signedOutPremiumView, lastSignInEnd: 'cancelled' })).toContain('invisible');
  });

  it.each<[string, PremiumReportOutcome, string]>([
    ['linked', { kind: 'linked' }, 'Game account 4242 is linked'],
    [
      'a Steam mismatch',
      { kind: 'refused', reason: 'steam_mismatch' },
      'This game account is signed in with a different Steam account than the one on your Premium sign-in',
    ],
    [
      'no Steam on the sign-in',
      { kind: 'refused', reason: 'no_steam_id' },
      'Connect Steam on the Premium page first, then come back',
    ],
    [
      'an account linked to someone else',
      { kind: 'refused', reason: 'game_account_taken' },
      'This game account is already linked to someone else — contact support',
    ],
    ['any other refusal', { kind: 'refused', reason: 'unknown' }, "Couldn't link the game account — it will try again"],
    ['a failed send', { kind: 'failed' }, "Couldn't link the game account — it will try again"],
    [
      'a game account without a Steam id',
      { kind: 'not-sent', reason: 'no-steam-id' },
      "Your game account couldn't be read yet",
    ],
    ['no game account', { kind: 'not-sent', reason: 'no-game-account' }, "Your game account couldn't be read yet"],
  ])('says the game account outcome for %s', (_name, report, sentence) => {
    expect(text(render({ ...signedIn, report, reportedAccountId: '4242' }))).toContain(sentence);
  });

  it('shows no game account row before anything was reported or when signed out', () => {
    expect(text(render(signedIn))).not.toContain(en.settingsPremiumGameAccountLabel);
    expect(
      text(render({ ...signedOutPremiumView, report: { kind: 'linked' }, reportedAccountId: '4242' })),
    ).not.toContain(en.settingsPremiumGameAccountLabel);
  });

  it('leaves the game account line out rather than print an empty id when the linked account id is unknown', () => {
    const html = text(render({ ...signedIn, report: { kind: 'linked' }, reportedAccountId: null }));

    expect(html).not.toContain(en.settingsPremiumGameAccountLabel);
    expect(html).not.toContain('is linked');
  });

  it('speaks Portuguese under the Portuguese locale and leaks no English', () => {
    const html = text(render({ ...signedIn, report: { kind: 'linked' }, reportedAccountId: '4242' }, 'pt-BR'));

    expect(html).toContain('Conectado com Discord, Steam');
    expect(html).toContain('A conta do jogo 4242 está vinculada');
    expect(html).toContain(ptBR.settingsPremiumSignOutAction);
    expect(html).not.toContain(en.settingsPremiumSignOutAction);
  });
});
