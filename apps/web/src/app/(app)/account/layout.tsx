import type { Metadata } from 'next';

/**
 * Server layout for `/account` — static, untranslated `<title>`, same reasoning as `/farm`:
 * a static export emits one HTML document per route, and the page below is a client component
 * that cannot export `metadata` at all.
 */
export const metadata: Metadata = {
  title: 'Account — Bomb Farm Companion',
};

export default function AccountLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
