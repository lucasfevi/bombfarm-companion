/**
 * The support link, in the three shapes the app shows it: an icon-only pill in the top bar, a row
 * in that bar's overflow menu once the pill no longer fits, and a labelled button in Settings.
 * All three point at the one URL held here.
 *
 * No IPC and no `shell.openExternal` call of its own — `applyExternalNavigationPolicy`
 * (`src/main/external-navigation.ts`) already answers `window-open` for any `https:` target by
 * handing it to the default browser and refusing the new window, so a plain anchor is the whole
 * implementation. `target="_blank"` picks that path deliberately: without it the click arrives as
 * `will-navigate`, which the same policy also redirects, but only after the renderer has already
 * been asked to leave the page it is the only copy of.
 */
import { Icon, Menu, Tooltip, buttonRecipe } from '@bombfarm/ui';
import { useCopy } from '../lib/copy';

const COFFEE_URL = 'https://buymeacoffee.com/lucasfevi';

const EXTERNAL_LINK_PROPS = {
  href: COFFEE_URL,
  target: '_blank',
  rel: 'noreferrer',
} as const;

/** Top-bar shape — the glyph alone, named for assistive tech and explained by the tooltip. */
export function CoffeeIconLink() {
  const t = useCopy();

  return (
    <Tooltip.Provider delay={200} closeDelay={80}>
      <Tooltip.Root>
        <Tooltip.Trigger
          render={
            <a
              {...EXTERNAL_LINK_PROPS}
              aria-label={t.shellCoffeeLabel}
              data-testid="shell-coffee"
              className={buttonRecipe({ variant: 'coffee' })}
            />
          }
        >
          <Icon name="coffee" size="sm" />
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner sideOffset={6}>
            <Tooltip.Popup>
              <p className="m-0">{t.shellCoffeeLabel}</p>
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

/** Overflow shape — the same anchor as a menu row, where the label replaces the tooltip. */
export function CoffeeMenuItem() {
  const t = useCopy();

  return (
    <Menu.Item render={<a {...EXTERNAL_LINK_PROPS} data-testid="shell-overflow-coffee" />}>
      <Icon name="coffee" size="sm" />
      {t.shellCoffeeLabel}
    </Menu.Item>
  );
}

/** Settings shape — the glyph beside its label, where there is room to say what it is for. */
export function CoffeeButtonLink() {
  const t = useCopy();

  return (
    <a
      {...EXTERNAL_LINK_PROPS}
      data-testid="settings-support-coffee"
      className={buttonRecipe({ variant: 'coffee-full' })}
    >
      <Icon name="coffee" size="sm" />
      {t.settingsSupportCoffeeAction}
    </a>
  );
}
