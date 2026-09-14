import Link from 'next/link';
import { buttonRecipe, cn } from '@bombfarm/ui';
import type { Strings } from '@/shared/i18n';
import { SITE_SECTION_HREF } from '@/shared/lib/site-sections';

export function OptimizerPlanLink({ t }: { t: Strings }) {
  return (
    <Link
      className={cn(buttonRecipe({ variant: 'primary' }), 'mt-auto flex h-auto w-full items-center justify-center py-3 text-sm')}
      href={SITE_SECTION_HREF.optimizer}
      data-testid="home-optimizer-see-plan"
    >
      {t.homeCardOptimizerSeeFullPlan}
    </Link>
  );
}
