'use client';

import Link from 'next/link';

export function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-[3px] px-3 py-1.5 text-[11px] font-bold tracking-[0.07em] uppercase no-underline transition-[color,background,box-shadow] ${
        active
          ? 'bg-[color-mix(in_oklch,var(--accent)_18%,var(--surface))] text-ink shadow-[0_1px_0_color-mix(in_oklch,var(--line)_80%,transparent),inset_0_0_0_1px_color-mix(in_oklch,var(--accent)_35%,var(--line))]'
          : 'text-muted hover:bg-[color-mix(in_oklch,var(--line)_28%,transparent)] hover:text-ink'
      }`}
      aria-current={active ? 'page' : undefined}
    >
      {children}
    </Link>
  );
}
