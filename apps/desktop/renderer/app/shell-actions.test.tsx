// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { Icon, type ShellDensity } from '@bombfarm/ui';
import { CopyProvider } from '../lib/copy';
import { SHELL_ICON_BUTTON_CLASS, ShellActions } from './shell-actions';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const source = readFileSync(join(__dirname, 'shell-actions.tsx'), 'utf8');

/** Every control the bar can carry, by the id the smoke suite and the player's click both use. */
const BAR_CONTROLS = ['open-mini', 'shell-referral', 'shell-coffee'];

const DENSITIES: ShellDensity[] = ['full', 'icon-tabs', 'brand-mark', 'actions-collapsed'];

function render(density: ShellDensity, granted = true, settingsActive = false, locale: 'en' | 'pt-BR' = 'en') {
  return renderToStaticMarkup(
    createElement(CopyProvider, {
      locale,
      children: createElement(ShellActions, {
        density,
        granted,
        locale,
        onLocaleChange: () => {},
        settingsActive,
        onOpenSettings: () => {},
      }),
    }),
  );
}

function gear(html: string): string {
  return html.match(/<button[^>]*data-testid="shell-settings"[^>]*>/)?.[0] ?? '';
}

describe('ShellActions', () => {
  it('spells every action out beside the tabs while the bar is wide enough', () => {
    const html = render('full');
    for (const id of BAR_CONTROLS) expect(html, id).toContain(`data-testid="${id}"`);
    expect(html).toContain('aria-label="Language"');
    expect(html).not.toContain('data-testid="shell-overflow"');
  });

  it('keeps every action a control until the tabs and the brand have both given way', () => {
    for (const density of ['icon-tabs', 'brand-mark'] as const) {
      const html = render(density);
      for (const id of BAR_CONTROLS) expect(html, `${density}/${id}`).toContain(`data-testid="${id}"`);
      expect(html, density).toContain('aria-label="Language"');
      expect(html, density).not.toContain('data-testid="shell-overflow"');
    }
  });

  it('replaces the whole cluster but the gear with one overflow button at the narrowest width', () => {
    const html = render('actions-collapsed');
    expect(html).toContain('data-testid="shell-overflow"');
    for (const id of BAR_CONTROLS) expect(html, id).not.toContain(`data-testid="${id}"`);
    expect(html).not.toContain('aria-label="Language"');
  });

  it('names the overflow button, which is a glyph and would otherwise be unreadable', () => {
    expect(render('actions-collapsed')).toContain('aria-label="More actions"');
    expect(render('actions-collapsed', true, false, 'pt-BR')).toContain('aria-label="Mais ações"');
  });

  it('withholds the mini-window opener until access is granted, in both shapes', () => {
    expect(render('full', false)).not.toContain('data-testid="open-mini"');
    // The collapsed shape mounts no popup until it is opened, so the source is what carries the
    // gate — asserted against the module in page-open-mini-wiring.test.tsx.
    expect(render('actions-collapsed', false)).toContain('data-testid="shell-overflow"');
  });

  it('ends the cluster with the Settings gear at every density, as its own button outside the overflow menu', () => {
    for (const density of DENSITIES) {
      const html = render(density);
      expect(gear(html), density).not.toBe('');
      expect(html.lastIndexOf('data-testid="shell-settings"'), density).toBeGreaterThan(
        html.lastIndexOf('data-testid="shell-overflow"'),
      );
      if (density !== 'actions-collapsed') {
        expect(html.lastIndexOf('data-testid="shell-settings"'), density).toBeGreaterThan(
          html.lastIndexOf('aria-label="Language"'),
        );
      }
    }
    expect(source).not.toMatch(/Menu\.Item[^>]*shell-settings/);
  });

  it('names the gear Settings in English and Configurações in Portuguese, at every density', () => {
    for (const density of DENSITIES) {
      expect(gear(render(density)), density).toContain('aria-label="Settings"');
      expect(gear(render(density, true, false, 'pt-BR')), density).toContain('aria-label="Configurações"');
    }
  });

  it('draws the cog glyph in the gear', () => {
    const html = render('full');
    const afterGear = html.slice(html.indexOf('data-testid="shell-settings"'));
    expect(afterGear).toContain(renderToStaticMarkup(createElement(Icon, { name: 'cog', size: 'sm' })));
  });

  it('sizes the gear as a square icon button, so the glyph sits in the middle of it', () => {
    const classes = (gear(render('full')).match(/class="([^"]*)"/)?.[1] ?? '').split(' ');
    for (const cls of SHELL_ICON_BUTTON_CLASS.split(' ')) expect(classes, cls).toContain(cls);
    expect(SHELL_ICON_BUTTON_CLASS).toContain('size-[30px]');
    // The default button's padding is what made it wider than tall.
    expect(classes).not.toContain('px-2.5');
    expect(classes).not.toContain('py-1.5');
  });

  it('marks the gear current only while Settings is on show, at every density', () => {
    for (const density of DENSITIES) {
      expect(gear(render(density, true, true)), density).toContain('aria-current="page"');
      expect(gear(render(density, true, true)), density).toContain('data-active="true"');
      expect(gear(render(density, true, false)), density).not.toContain('aria-current');
      expect(gear(render(density, true, false)), density).not.toContain('data-active');
    }
  });

  it('withholds the gear before access is granted, at every density', () => {
    for (const density of DENSITIES) expect(render(density, false), density).not.toContain('shell-settings');
  });
});

describe('the Settings gear in a live tree', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
      await Promise.resolve();
    });
    container.remove();
  });

  async function mount(onOpenSettings: () => void, density: ShellDensity = 'full') {
    await act(async () => {
      root.render(
        createElement(CopyProvider, {
          locale: 'en',
          children: createElement(ShellActions, {
            density,
            granted: true,
            locale: 'en',
            onLocaleChange: () => {},
            settingsActive: false,
            onOpenSettings,
          }),
        }),
      );
      await Promise.resolve();
    });
    const button = container.querySelector<HTMLElement>('[data-testid="shell-settings"]');
    if (!button) throw new Error('no gear');
    return button;
  }

  async function press(button: HTMLElement): Promise<void> {
    await act(async () => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
  }

  it('opens Settings when pressed', async () => {
    const onOpenSettings = vi.fn();
    await press(await mount(onOpenSettings));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('opens Settings when pressed in the collapsed bar too', async () => {
    const onOpenSettings = vi.fn();
    await press(await mount(onOpenSettings, 'actions-collapsed'));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });
});
