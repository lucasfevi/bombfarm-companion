import type { Metadata } from 'next';

/**
 * Server layout for `/inventory` — static, untranslated `<title>`, same reasoning as `/account`:
 * a static export emits one HTML document per route, and the page below is a client component
 * that cannot export `metadata` at all.
 */
export const metadata: Metadata = {
  title: 'Inventory — Bomb Farm Companion',
};

export default function InventoryLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
