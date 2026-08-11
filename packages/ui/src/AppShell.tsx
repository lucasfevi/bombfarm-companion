import type { PropsWithChildren, ReactNode } from 'react';
import { Icon, type IconName } from './icon';
import { Chip } from './chip';
import {
  appShellHeaderClass,
  appShellMainRecipe,
  appShellNavClass,
  appShellNavItemRecipe,
  appShellNavLabelClass,
  appShellRootRecipe,
  appShellStatusBarClass,
} from './AppShell.recipe';

export interface AppShellNavItem {
  id: string;
  label: string;
  icon: IconName;
  /** P2 (SHL-09) — rendered as a count next to the label. */
  badge?: number;
}

export interface AppShellProps extends PropsWithChildren {
  title?: string;
  /** Flavor badge — kept from M0; the desktop Playwright smoke test asserts `data-testid="flavor-badge"`. */
  badge?: string | null;
  /** Omitted/empty renders no nav landmark (SHL-04) — desktop is still a single page today. */
  items?: AppShellNavItem[];
  activeId?: string;
  onNavigate?: (id: string) => void;
  /** Status-bar slots — absent ones render nothing (no empty boxes, no layout shift). */
  status?: ReactNode;
  /** Reserved for M4 pricing passes; renders nothing until a caller passes it. */
  progress?: ReactNode;
  version?: ReactNode;
}

/**
 * AppShell — sidebar nav + content area + status bar (DESIGN_SYSTEM §3). The
 * only shell any desktop surface needs. Root is a viewport-height grid;
 * `<main>` is the sole `overflow-y: auto` region so the window itself never
 * scrolls (§4). Nav is controlled (`activeId` + `onNavigate`) and data-driven
 * (`items`) rather than a hardcoded route list.
 */
export function AppShell({
  title = 'Bomb Farm Companion',
  badge,
  items = [],
  activeId,
  onNavigate,
  status,
  progress,
  version,
  children,
}: AppShellProps) {
  const hasNav = items.length > 0;

  return (
    <div className={appShellRootRecipe({ withNav: hasNav })}>
      <header className={appShellHeaderClass}>
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
          {badge ? (
            <span
              data-testid="flavor-badge"
              className="rounded border border-line bg-bg-2 px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-muted"
            >
              {badge}
            </span>
          ) : null}
        </div>
      </header>

      {hasNav ? (
        <nav aria-label="Main" className={appShellNavClass}>
          <ul className="flex flex-col gap-1">
            {items.map((item) => {
              const active = item.id === activeId;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-current={active ? 'page' : undefined}
                    onClick={() => onNavigate?.(item.id)}
                    className={appShellNavItemRecipe({ active })}
                  >
                    <Icon name={item.icon} size="md" className="shrink-0" />
                    <span className={appShellNavLabelClass}>{item.label}</span>
                    {typeof item.badge === 'number' ? (
                      <Chip variant="small" className="ml-auto">
                        {item.badge}
                      </Chip>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}

      <main className={appShellMainRecipe({ withNav: hasNav })}>{children}</main>

      <footer className={appShellStatusBarClass}>
        {status ? <div className="flex items-center gap-2">{status}</div> : null}
        {progress ? <div className="flex items-center gap-2">{progress}</div> : null}
        {version ? <div className="ml-auto flex items-center gap-2">{version}</div> : null}
      </footer>
    </div>
  );
}
