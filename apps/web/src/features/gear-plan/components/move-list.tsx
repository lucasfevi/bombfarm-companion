'use client';

import type { GearPlan } from '@bombfarm/domain/gear-plan/types';
import { Panel } from '@bombfarm/ui';
import { panelHClass, panelTitleClass } from '@bombfarm/ui/panel-field.recipe';
import type { Strings } from '@/shared/i18n';
import { sub } from '@/shared/i18n';
import { usePlannerStore, selectHeroes } from '@/shared/stores';
import { shortHeroRecordId } from '@/features/gear-plan/model/build-gear-plan-input';
import { MoveListRows } from './move-list-rows';

export function MoveList({ t, plan }: { t: Strings; plan: GearPlan }) {  const heroes = usePlannerStore(selectHeroes);
  const heroName = (heroId: string | null) => {
    if (!heroId) return '—';
    const hero = heroes.find((row) => (row.sourceId ?? row.id) === heroId);
    if (!hero) return heroId;
    return sub(t.gearPlanHeroRowLabel, {
      name: hero.name,
      level: String(hero.level),
      id: shortHeroRecordId(hero),
    });
  };

  const unequips = plan.moveList.filter((row) => row.phase === 'unequip');
  const equips = plan.moveList.filter((row) => row.phase === 'equip');
  const empty = plan.moveList.length === 0;

  return (
    <Panel>
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.gearPlanMoveListTitle}</h2>
      </div>
      {empty ? (
        <p className="m-0 text-sm text-muted">{t.gearPlanMoveListEmpty}</p>
      ) : (
        <div className="space-y-3">
          {unequips.length > 0 ? (
            <section aria-label={t.gearPlanMoveUnequipGroup}>
              <h3 className="m-0 mb-1 text-[11px] font-bold tracking-[0.06em] text-muted uppercase">
                {t.gearPlanMoveUnequipGroup}
              </h3>
              <MoveListRows t={t} rows={unequips} heroName={heroName} kind="unequip" />
            </section>
          ) : null}
          {equips.length > 0 ? (
            <section aria-label={t.gearPlanMoveEquipGroup}>
              <h3 className="m-0 mb-1 text-[11px] font-bold tracking-[0.06em] text-muted uppercase">
                {t.gearPlanMoveEquipGroup}
              </h3>
              <MoveListRows t={t} rows={equips} heroName={heroName} kind="equip" />
            </section>
          ) : null}
        </div>
      )}
    </Panel>
  );
}
