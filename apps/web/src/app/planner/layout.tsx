import type { Metadata } from 'next';

/**
 * `/planner` is a redirect stub kept alive for links shared before the rename. Indexing it, or
 * giving it a share card, would put a URL that immediately bounces in front of people.
 */
export const metadata: Metadata = {
  title: 'Heroes — Bomb Farm Companion',
  robots: { index: false, follow: true },
  alternates: { canonical: '/heroes' },
};

export default function PlannerLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
