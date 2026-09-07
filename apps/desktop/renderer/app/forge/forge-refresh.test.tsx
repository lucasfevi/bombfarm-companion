import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AccountReadRefusal } from '@bombfarm/contracts';
import type { AccountReadRequestState } from '../../lib/account/use-account-read-request';
import { CopyProvider } from '../../lib/copy';
import { en } from '../../lib/copy/en';
import { ForgeRefresh } from './forge-refresh';

function render(
  overrides: { stale?: boolean; capturedAt?: string | null; state?: AccountReadRequestState } = {},
): string {
  return renderToStaticMarkup(
    createElement(CopyProvider, {
      locale: 'en',
      children: createElement(ForgeRefresh, {
        capturedAt: overrides.capturedAt === undefined ? new Date().toISOString() : overrides.capturedAt,
        stale: overrides.stale ?? false,
        state: overrides.state ?? { kind: 'idle' },
        onRefresh: () => {},
      }),
    }),
  );
}

function tagOf(html: string, testid: string): string {
  return new RegExp(`<[a-z]+[^>]*data-testid="${testid}"[^>]*>`).exec(html)?.[0] ?? '';
}

/** The rendered text of an element, without the class list — which carries both `disabled:` state
 *  variants and a `120ms` duration token, and would answer to a search for either. */
function textOf(html: string, testid: string): string {
  return new RegExp(`<[a-z]+[^>]*data-testid="${testid}"[^>]*>([^<]*)<`).exec(html)?.[1] ?? '';
}

function isDisabled(html: string, testid: string): boolean {
  return / disabled=""/.test(tagOf(html, testid));
}

describe('ForgeRefresh', () => {
  it('says nothing above the button while the read is current', () => {
    const html = render();
    expect(html).not.toContain('data-testid="forge-stale-label"');
    expect(tagOf(html, 'forge-refresh')).not.toContain('border-warn');
  });

  it('stands the out-of-date label above the button in bold, and borders the button itself', () => {
    const html = render({ stale: true });
    const label = tagOf(html, 'forge-stale-label');
    expect(label).toContain('font-bold');
    expect(label).toContain('uppercase');
    // It takes a row of its own here — nothing shares this button's baseline any more.
    expect(label).not.toContain('absolute');
    expect(tagOf(html, 'forge-refresh')).toContain('border-warn');
    expect(html).toContain(en.farmRefreshStale);
  });

  it('prints no read age of its own — the age is what the button says when asked', () => {
    const html = render();
    expect(html).not.toContain('Account read');
    expect(html).not.toContain('data-testid="forge-read-age"');
    // The design system's tooltip, never the native attribute that lint rejects.
    expect(tagOf(html, 'forge-refresh')).toContain('data-slot="tooltip-trigger"');
    expect(tagOf(html, 'forge-refresh')).not.toContain('title=');
  });

  it('offers no tooltip at all when there is no capture to date the read by', () => {
    const html = render({ capturedAt: null });
    expect(html).toContain('data-testid="forge-refresh"');
    expect(tagOf(html, 'forge-refresh')).not.toContain('tooltip-trigger');
  });

  it('idle offers a press and says nothing about a read that is not happening', () => {
    const html = render();
    expect(isDisabled(html, 'forge-refresh')).toBe(false);
    expect(textOf(html, 'forge-refresh')).toBe(en.farmRefresh);
    expect(html).not.toContain('data-testid="forge-refresh-refusal"');
  });

  it('says it is reading while the read is in flight, and refuses a second press meanwhile', () => {
    const html = render({ state: { kind: 'working' } });
    expect(textOf(html, 'forge-refresh')).toBe(en.forgeRefreshWorking);
    expect(isDisabled(html, 'forge-refresh')).toBe(true);
  });

  it('drops the out-of-date border while it is reading — the press it was asking for is happening', () => {
    const html = render({ stale: true, state: { kind: 'working' } });
    expect(html).toContain('data-testid="forge-stale-label"');
    expect(tagOf(html, 'forge-refresh')).not.toContain('border-warn');
  });

  it('says the floor refused the press in plain words, with no millisecond figure in sight', () => {
    const html = render({ state: { kind: 'refused', reason: 'rate_limited' } });
    expect(textOf(html, 'forge-refresh-refusal')).toBe(en.accountReadRecent);
    expect(textOf(html, 'forge-refresh-refusal')).not.toMatch(/\d/);
    // Refused is not working: the button is pressable again the moment the floor reopens.
    expect(isDisabled(html, 'forge-refresh')).toBe(false);
  });

  it.each<[AccountReadRefusal, string]>([
    ['offline', en.accountReadFixture],
    ['not_consented', en.accountReadNotConsented],
    ['game_not_running', en.accountReadGameNotRunning],
    ['token_unavailable', en.forgeStartTokenUnavailable],
    ['unavailable', en.forgeStartUnavailable],
  ])('says why a read cannot happen at all: %s', (reason, expected) => {
    const html = render({ state: { kind: 'refused', reason } });
    expect(textOf(html, 'forge-refresh-refusal')).toBe(expected);
    expect(tagOf(html, 'forge-refresh-refusal')).toContain('text-warn');
  });
});
