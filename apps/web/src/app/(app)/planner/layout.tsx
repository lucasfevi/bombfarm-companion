import { sectionMetadata } from '@/shared/lib/site-metadata';

/**
 * Server layout for `/planner` — static, untranslated metadata, the shape every other section
 * layout uses; the page is a client slot that cannot export `metadata` itself.
 */
export const metadata = sectionMetadata('planner');

export default function PlannerLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
