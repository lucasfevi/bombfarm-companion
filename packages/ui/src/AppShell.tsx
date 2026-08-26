import type { CSSProperties, PropsWithChildren, ReactNode } from 'react';
import { AppNav } from './app-nav';
import {
  appShellActionsClass,
  appShellBrandClass,
  appShellBrandNameClass,
  appShellBrandTagClass,
  appShellHeaderClass,
  appShellMainClass,
  appShellRootClass,
  appShellStatusBarClass,
} from './AppShell.recipe';

export interface AppShellNavItem {
  id: string;
  label: string;
}

export interface AppShellProps extends PropsWithChildren {
  title?: string;
  /** Flavor badge — kept from M0; the desktop Playwright smoke test asserts `data-testid="flavor-badge"`. */
  badge?: string | null;
  /** Omitted/empty renders no nav landmark (SHL-04). */
  items?: AppShellNavItem[];
  activeId?: string;
  onNavigate?: (id: string) => void;
  /** Right-hand header slot — e.g. the desktop's PT/EN `SegmentedToggle`. */
  actions?: ReactNode;
  /** Status-bar slots — absent ones render nothing (no empty boxes, no layout shift). */
  status?: ReactNode;
  /** Reserved for M4 pricing passes; renders nothing until a caller passes it. */
  progress?: ReactNode;
  version?: ReactNode;
  /**
   * Reserved for the desktop's custom title bar (a later task). Applies
   * `-webkit-app-region: drag` to the header and `no-drag` to its interactive regions (brand, nav,
   * actions) so the OS can still move the window by its chrome. No caller passes this yet.
   */
  draggable?: boolean;
  /** Reserved alongside `draggable` — right padding (px) held clear for OS caption buttons. */
  overlayInset?: number;
}

/** `-webkit-app-region` has no Tailwind utility and isn't a standard CSS property TypeScript knows. */
interface AppRegionStyle extends CSSProperties {
  WebkitAppRegion?: 'drag' | 'no-drag';
}

const NO_DRAG_STYLE: AppRegionStyle = { WebkitAppRegion: 'no-drag' };

/**
 * AppShell — sticky top bar (brand + nav pill + actions) over a single scrolling `<main>`, plus a
 * slim status strip. Same top-bar shape as the web's `SiteHeader`, built from the shared `AppNav`
 * pill rather than the desktop's former icon-rail sidebar. Nav is controlled (`activeId` +
 * `onNavigate`) and data-driven (`items`) rather than a hardcoded route list.
 */
export function AppShell({
  title = 'Bomb Farm Companion',
  badge,
  items = [],
  activeId,
  onNavigate,
  actions,
  status,
  progress,
  version,
  draggable = false,
  overlayInset,
  children,
}: AppShellProps) {
  const navItems = items.map((item) => ({ id: item.id, label: item.label, active: item.id === activeId }));

  let headerStyle: AppRegionStyle | undefined;
  if (draggable || overlayInset) {
    headerStyle = {};
    if (draggable) headerStyle.WebkitAppRegion = 'drag';
    if (overlayInset) headerStyle.paddingRight = overlayInset;
  }
  const interactiveStyle = draggable ? NO_DRAG_STYLE : undefined;

  return (
    <div className={appShellRootClass}>
      <header className={appShellHeaderClass} style={headerStyle}>
        <div className="flex min-w-0 items-center gap-4">
          <div className={appShellBrandClass} style={interactiveStyle}>
            <div className={appShellBrandNameClass}>{title}</div>
            {badge ? (
              <span data-testid="flavor-badge" className={appShellBrandTagClass}>
                {badge}
              </span>
            ) : null}
          </div>
          {navItems.length > 0 ? (
            <div style={interactiveStyle}>
              <AppNav items={navItems} onSelect={onNavigate} />
            </div>
          ) : null}
        </div>

        {actions ? (
          <div className={appShellActionsClass} style={interactiveStyle}>
            {actions}
          </div>
        ) : null}
      </header>

      <main className={appShellMainClass}>{children}</main>

      <footer className={appShellStatusBarClass}>
        {status ? <div className="flex items-center gap-2">{status}</div> : null}
        {progress ? <div className="flex items-center gap-2">{progress}</div> : null}
        {version ? <div className="ml-auto flex items-center gap-2">{version}</div> : null}
      </footer>
    </div>
  );
}
