'use client';

import { workspaceClass } from '@bombfarm/ui/panel-field.recipe';
import { useAppLang } from '@/shared/context/app-lang';
import { selectBooted, usePlannerStore } from '@/shared/stores';
import { selectFirstVisit } from '../model/home-selectors';
import { AccountCard } from './account-card';
import { FarmCard } from './farm-card';
import { HomeFirstVisit } from './home-first-visit';
import { HomeStatusStrip } from './home-status-strip';
import { InventoryCard } from './inventory-card';
import { LiveCard } from './live-card';
import { OptimizerCard } from './optimizer-card';
import { PlannerCard } from './planner-card';

const HALF_WIDTH = 'min-w-0 min-[720px]:col-span-2';
const QUARTER_WIDTH = 'min-w-0 col-span-1';

export function HomePage() {
  const { t } = useAppLang();
  const booted = usePlannerStore(selectBooted);
  const firstVisit = usePlannerStore(selectFirstVisit);

  if (!booted) return null;

  return (
    <div className={workspaceClass}>
      {firstVisit ? (
        <HomeFirstVisit />
      ) : (
        <>
          <div>
            <h1 className="m-0 text-2xl font-extrabold tracking-tight text-balance text-ink">
              {t.homeTitle}
            </h1>
            <p className="m-0 mt-1 max-w-[60ch] text-muted">{t.homeSubtitle}</p>
          </div>
          <HomeStatusStrip />
        </>
      )}
      <div
        className="grid grid-cols-1 items-stretch gap-4 min-[720px]:grid-cols-2 min-[1100px]:grid-cols-4"
        data-testid="home-grid"
      >
        <div className={HALF_WIDTH} data-testid="home-grid-planner">
          <PlannerCard />
        </div>
        <div className={HALF_WIDTH} data-testid="home-grid-farm">
          <FarmCard />
        </div>
        <div className={QUARTER_WIDTH} data-testid="home-grid-optimizer">
          <OptimizerCard />
        </div>
        <div className={QUARTER_WIDTH} data-testid="home-grid-inventory">
          <InventoryCard />
        </div>
        <div className={QUARTER_WIDTH} data-testid="home-grid-account">
          <AccountCard />
        </div>
        <div className={QUARTER_WIDTH} data-testid="home-grid-live">
          <LiveCard />
        </div>
      </div>
    </div>
  );
}
