import type { Metadata } from 'next';

/**
 * Server layout for `/download` — static, untranslated metadata, matching `/farm`: a static
 * export emits one HTML document per route, and the page below is a client component that
 * cannot export `metadata` at all. The page body stays `t.*`-driven and bilingual.
 */
export const metadata: Metadata = {
  title: 'Download — Bomb Farm Companion',
  description:
    'Free Windows companion for Bomb Farm: energy, field countdowns, per-hero state, map value and measured gold and XP rates. Install steps included, Windows warning and all.',
};

export default function DownloadLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
