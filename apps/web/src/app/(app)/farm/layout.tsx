import type { Metadata } from 'next';

/**
 * Server layout for `/farm` — static, untranslated `<title>`. A static export
 * emits one HTML document per route (no per-request locale metadata), and the page below
 * this layout is a client component that cannot export `metadata` at all. "Farm" is chosen
 * deliberately so it reads fine untranslated; the in-page heading and nav
 * label stay `t.*`-driven and bilingual.
 */
export const metadata: Metadata = {
  title: 'Farm — Bomb Farm Companion',
};

export default function FarmLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
