import { sectionMetadata } from '@/shared/lib/site-metadata';

/**
 * Server layout for `/inventory` — static, untranslated metadata. A static export emits one HTML
 * document per route (no per-request locale metadata), and the page below is a client component
 * that cannot export `metadata` at all. The page body stays `t.*`-driven and bilingual.
 */
export const metadata = sectionMetadata('inventory');

export default function InventoryLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
