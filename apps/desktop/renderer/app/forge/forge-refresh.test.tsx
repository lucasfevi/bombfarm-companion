import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CopyProvider } from '../../lib/copy';
import { en } from '../../lib/copy/en';
import { ForgeRefresh } from './forge-refresh';

function render(overrides: { stale?: boolean; capturedAt?: string | null } = {}): string {
  return renderToStaticMarkup(
    createElement(CopyProvider, {
      locale: 'en',
      children: createElement(ForgeRefresh, {
        capturedAt: overrides.capturedAt === undefined ? new Date().toISOString() : overrides.capturedAt,
        stale: overrides.stale ?? false,
        onRefresh: () => {},
      }),
    }),
  );
}

function tagOf(html: string, testid: string): string {
  return new RegExp(`<[a-z]+[^>]*data-testid="${testid}"[^>]*>`).exec(html)?.[0] ?? '';
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
});
