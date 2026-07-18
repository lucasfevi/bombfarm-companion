import type { PropsWithChildren } from 'react';

export interface AppShellProps extends PropsWithChildren {
  title?: string;
}

export function AppShell({ title = 'Bomb Farm Companion', children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[var(--bf-bg)] text-[var(--bf-fg)] font-sans">
      <header className="border-b border-white/10 px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      </header>
      <main className="px-6 py-6">{children}</main>
    </div>
  );
}
