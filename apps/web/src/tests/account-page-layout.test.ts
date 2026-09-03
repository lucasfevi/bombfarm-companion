import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AccountPage } from '@/features/account';
import { STRINGS } from '@/shared/i18n';

const html = renderToStaticMarkup(createElement(AccountPage));

function at(testId: string): number {
  return html.indexOf(`data-testid="${testId}"`);
}

/** The markup between one region marker and the next, so a region's own extent can be read. */
function between(from: string, to: string): string {
  return html.slice(at(from), at(to));
}

describe('the Account page — where its four regions sit', () => {
  it('sets holdings and identity side by side, in the shared layout rather than one of its own', () => {
    const summary = between('account-screen-summary', 'account-screen-panels');

    expect(summary).toContain('data-testid="account-holdings"');
    expect(summary).toContain(STRINGS.pt.panelAccount);
  });

  it('leaves House and tree paired below, out of the row the two above share', () => {
    const summary = between('account-screen-summary', 'account-screen-panels');
    const panels = html.slice(at('account-screen-panels'));

    expect(summary).not.toContain(STRINGS.pt.panelHouse);
    expect(panels).toContain(STRINGS.pt.panelHouse);
    expect(panels).toContain(STRINGS.pt.panelTree);
  });
});
