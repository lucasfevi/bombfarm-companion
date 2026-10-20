// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { mountDom, type DomMount } from '../dom-test-harness';
import {
  detailsMenuItemStateClass,
  menuGroupLabelClass,
  menuItemClass,
  menuPopupClass,
  menuSeparatorClass,
} from '../menu.recipe';
import { DetailsMenu, Menu } from './index';

let mount: DomMount | undefined;

afterEach(() => {
  mount?.unmount();
  mount = undefined;
});

function renderMenu(open?: boolean) {
  mount = mountDom();
  mount.render(
    <DetailsMenu.Root label="Site menu" open={open}>
      <DetailsMenu.GroupLabel>Account</DetailsMenu.GroupLabel>
      <DetailsMenu.Item render={<a href="/settings" />}>Settings</DetailsMenu.Item>
      <DetailsMenu.Separator />
      <DetailsMenu.Item>Sign out</DetailsMenu.Item>
    </DetailsMenu.Root>,
  );
  return mount.container;
}

describe('DetailsMenu', () => {
  it('renders closed by default, as a details element with a labelled summary', () => {
    const root = renderMenu();
    const details = root.querySelector('details');
    expect(details?.hasAttribute('open')).toBe(false);
    const summary = details?.querySelector('summary');
    expect(summary?.getAttribute('aria-label')).toBe('Site menu');
    expect(summary?.querySelector('svg')).not.toBeNull();
  });

  it('renders open when given the open attribute', () => {
    expect(renderMenu(true).querySelector('details')?.hasAttribute('open')).toBe(true);
  });

  it('dresses the summary like the default button, with the native marker hidden', () => {
    const summary = renderMenu().querySelector('summary');
    expect(summary?.className).toContain('border-line bg-bg-2 hover:border-accent');
    expect(summary?.className).toContain('[&::-webkit-details-marker]:hidden');
    expect(summary?.className).toContain('list-none');
  });

  it('gives its popup the class string of the Menu popup', () => {
    const popup = renderMenu().querySelector('[data-slot="menu-popup"]');
    expect(popup?.className).toBe(menuPopupClass);
  });

  it('gives its popup the same classes as a rendered Menu popup', () => {
    mount = mountDom();
    mount.render(
      <Menu.Root open>
        <Menu.Trigger>Open</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.Item>One</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    );
    const rendered = document.body.querySelector('[data-slot="menu-popup"]');
    expect(rendered).not.toBeNull();
    expect(rendered?.className).toBe(menuPopupClass);
    expect(rendered?.querySelector('[role="menuitem"]')?.className).toContain(menuItemClass);
  });

  it('gives its items, separator and group label the Menu class strings', () => {
    const root = renderMenu();
    expect(root.querySelector('a')?.className).toBe(`${menuItemClass} ${detailsMenuItemStateClass}`);
    expect(root.querySelector('button')?.className).toBe(`${menuItemClass} ${detailsMenuItemStateClass}`);
    expect(root.querySelector('[role="separator"]')?.className).toBe(menuSeparatorClass);
    expect(root.querySelector('[data-slot="menu-popup"] > div')?.className).toBe(menuGroupLabelClass);
  });

  it('renders the items in the order given, as a link and a button', () => {
    const popup = renderMenu().querySelector('[data-slot="menu-popup"]');
    expect(Array.from(popup?.children ?? []).map((child) => child.tagName.toLowerCase())).toEqual([
      'div',
      'a',
      'div',
      'button',
    ]);
    expect(popup?.querySelector('a')?.getAttribute('href')).toBe('/settings');
    expect(popup?.querySelector('button')?.getAttribute('type')).toBe('button');
  });
});
