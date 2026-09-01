import type { Metadata } from 'next';

/**
 * `/phases` is a redirect stub kept alive for links shared before the rename. Indexing it, or
 * giving it a share card, would put a URL that immediately bounces in front of people.
 */
export const metadata: Metadata = {
  title: 'Farm — Bomb Farm Companion',
  robots: { index: false, follow: true },
  alternates: { canonical: '/farm' },
};

export default function PhasesLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
