'use client';

import { Panel } from '@bombfarm/ui';
import { panelHClass, panelTitleClass } from '@bombfarm/ui/panel-field.recipe';
import type { Strings } from '@/shared/i18n';
import { usePlannerStore, selectHeroes, selectScopeByHeroId } from '@/shared/stores';
import type { ScopeState } from '@/shared/stores/gear-plan/types';
import { defaultScopeForHero } from '@/shared/stores/gear-plan/types';
import { ScopeRow } from './scope-row';

export function ScopeList({ t }: { t: Strings }) {
  const heroes = usePlannerStore(selectHeroes);
  const scopeByHeroId = usePlannerStore(selectScopeByHeroId);
  const setScope = usePlannerStore((state) => state.setScope);
  const optimizeCount = heroes.filter(
    (hero) => (scopeByHeroId[hero.id] ?? defaultScopeForHero(hero.battleAllowed)) === 'optimize',
  ).length;

  return (
    <Panel>
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.gearPlanScopeSectionTitle}</h2>
      </div>
      <p className="m-0 mb-2 text-[12px] text-muted">{t.gearPlanScopeListTip}</p>
      {optimizeCount === 0 ? (
        <p className="m-0 text-sm text-warn">{t.gearPlanScopeNothingInScope}</p>
      ) : null}
      <div className="overflow-hidden rounded-sm border border-line">
        {heroes.map((hero) => (
          <ScopeRow
            key={hero.id}
            hero={hero}
            scope={scopeByHeroId[hero.id] ?? defaultScopeForHero(hero.battleAllowed)}
            t={t}
            onScope={(scope: ScopeState) => setScope(hero.id, scope)}
          />
        ))}
      </div>
    </Panel>
  );
}
