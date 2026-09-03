import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ShellDensity } from '@bombfarm/ui';
import { CopyProvider } from '../lib/copy';
import { ShellActions } from './shell-actions';

/** Every control the bar can carry, by the id the smoke suite and the player's click both use. */
const BAR_CONTROLS = ['open-mini', 'shell-referral', 'shell-coffee'];

function render(density: ShellDensity, granted = true) {
  return renderToStaticMarkup(
    createElement(CopyProvider, {
      locale: 'en',
      children: createElement(ShellActions, {
        density,
        granted,
        locale: 'en',
        onLocaleChange: () => {},
      }),
    }),
  );
}

describe('ShellActions', () => {
  it('spells every action out beside the tabs while the bar is wide enough', () => {
    const html = render('full');
    for (const id of BAR_CONTROLS) expect(html, id).toContain(`data-testid="${id}"`);
    expect(html).toContain('aria-label="Language"');
    expect(html).not.toContain('data-testid="shell-overflow"');
  });

  it('replaces the whole cluster with one overflow button below the first width', () => {
    const html = render('actions-collapsed');
    expect(html).toContain('data-testid="shell-overflow"');
    for (const id of BAR_CONTROLS) expect(html, id).not.toContain(`data-testid="${id}"`);
    expect(html).not.toContain('aria-label="Language"');
  });

  it('stays collapsed at the narrowest width rather than coming back beside the glyph tabs', () => {
    const html = render('icon-tabs');
    expect(html).toContain('data-testid="shell-overflow"');
    for (const id of BAR_CONTROLS) expect(html, id).not.toContain(`data-testid="${id}"`);
  });

  it('names the overflow button, which is a glyph and would otherwise be unreadable', () => {
    expect(render('actions-collapsed')).toContain('aria-label="More actions"');
    expect(
      renderToStaticMarkup(
        createElement(CopyProvider, {
          locale: 'pt-BR',
          children: createElement(ShellActions, {
            density: 'actions-collapsed',
            granted: true,
            locale: 'pt-BR',
            onLocaleChange: () => {},
          }),
        }),
      ),
    ).toContain('aria-label="Mais ações"');
  });

  it('withholds the mini-window opener until access is granted, in both shapes', () => {
    expect(render('full', false)).not.toContain('data-testid="open-mini"');
    // The collapsed shape mounts no popup until it is opened, so the source is what carries the
    // gate — asserted against the module in page-open-mini-wiring.test.tsx.
    expect(render('actions-collapsed', false)).toContain('data-testid="shell-overflow"');
  });
});
