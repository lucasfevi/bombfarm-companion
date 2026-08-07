'use client';

import { workspaceClass } from '@bombfarm/ui/panel-field.recipe';
import type { Lang, Strings } from '@/shared/i18n';
import { usePlannerStore, selectHeroes, selectInventoryItems } from '@/shared/stores';
import { GearPlanEmptyPanel } from './gear-plan-empty';

export function GearPlanPage({
  t,
  lang: _lang,
  onImport,
}: {
  t: Strings;
  lang: Lang;
  onImport: () => void;
}) {
  const heroes = usePlannerStore(selectHeroes);
  const inventory = usePlannerStore(selectInventoryItems);
  const hasRoster = heroes.length > 0;
  const hasInventory = inventory.length > 0;

  return (
    <div className={workspaceClass}>
      <section role="region" aria-label={t.gearPlanPageLandmark}>
        <header className="mb-4">
          <h1 className="m-0 text-lg font-bold text-ink">{t.gearPlanPageTitle}</h1>
        </header>

        {!hasRoster ? (
          <GearPlanEmptyPanel
            title={t.gearPlanEmptyNoRosterTitle}
            body={t.gearPlanEmptyNoRosterBody}
            cta={t.gearPlanImportCta}
            onImport={onImport}
          />
        ) : !hasInventory ? (
          <GearPlanEmptyPanel
            title={t.gearPlanEmptyNoInventoryTitle}
            body={t.gearPlanEmptyNoInventoryBody}
            cta={t.gearPlanImportCta}
            onImport={onImport}
          />
        ) : (
          <p className="m-0 text-sm text-muted">{t.gearPlanScopeListTip}</p>
        )}
      </section>
    </div>
  );
}
