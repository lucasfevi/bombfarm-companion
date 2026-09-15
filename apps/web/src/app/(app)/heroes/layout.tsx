import { sectionMetadata } from '@/shared/lib/site-metadata';

/**
 * Server layout for `/heroes` — static, untranslated metadata, the shape every other section
 * layout uses; the page is a client slot that cannot export `metadata` itself.
 */
export const metadata = sectionMetadata('heroes');

export default function HeroesLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
