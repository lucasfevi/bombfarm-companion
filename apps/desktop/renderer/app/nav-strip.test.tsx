import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppShell } from '@bombfarm/ui';
import { STRINGS } from '../lib/copy';
import { navItemsFor } from './nav-items';
import { stripIdForScreen } from './nav-screen';

function activeProps(screenId: string): { activeId?: string } {
  const activeId = stripIdForScreen(screenId);
  return activeId === undefined ? {} : { activeId };
}

function currentTabs(screenId: string): string[] {
  const html = renderToStaticMarkup(
    createElement(AppShell, {
      items: navItemsFor(STRINGS.en, { premium: false }),
      ...activeProps(screenId),
      children: 'body',
    }),
  );
  return [...html.matchAll(/<button[^>]*aria-current="page"[^>]*>(.*?)<\/button>/g)].map((match) =>
    (match[1] ?? '').replace(/<[^>]+>/g, '').trim(),
  );
}

describe('the tab strip for the screen on show', () => {
  it('marks Progression current on the Skill Tree screen', () => {
    expect(currentTabs('skills')).toEqual(['Progression']);
  });

  it('marks Progression current on the Collections screen', () => {
    expect(currentTabs('collections')).toEqual(['Progression']);
  });

  it('marks no tab current on the Settings screen', () => {
    expect(currentTabs('settings')).toEqual([]);
  });

  it('marks Farm current on the Farm screen', () => {
    expect(currentTabs('farm')).toEqual(['Farm']);
  });
});
