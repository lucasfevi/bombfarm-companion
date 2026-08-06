import type { PropsWithChildren } from 'react';

export interface AppShellProps extends PropsWithChildren {
  title?: string;
  badge?: string | null;
}

export function AppShell({ title = 'Bomb Farm Companion', badge, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[var(--bf-bg)] text-[var(--bf-fg)] font-sans">
      <header className="border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
          {badge ? (
            <span
              data-testid="flavor-badge"
              className="rounded border border-white/20 bg-white/10 px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-bf-muted"
            >
              {badge}
            </span>
          ) : null}
        </div>
      </header>
      <main className="px-6 py-6">{children}</main>
    </div>
  );
}
