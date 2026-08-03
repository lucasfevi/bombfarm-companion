'use client';

import { SLOTS } from '@bombfarm/domain/gear';
import { useAppLang } from '@/shared/context/app-lang';
import { formatNumber } from '@/shared/lib/format-number';
import { usePlannerStore } from '@/shared/stores';
import { useHeroBuildActions } from '../hooks/use-hero-build-actions';
import { FieldRequired, Panel } from '@bombfarm/ui';
import { colClass, panelHClass, panelTitleClass } from '@bombfarm/ui/panel-field.recipe';
import { GearSlotsGrid } from './gear-slots-grid';
import { GearSlotStatsGrid } from './gear-slot-stats-grid';
import { GearCompareSection } from './gear-compare-section';

export function GearTab() {
  const { t, lang } = useAppLang();
  const { setSlot } = useHeroBuildActions();
  const loadout = usePlannerStore((state) => state.loadout);

  const onPatchSlot = setSlot;
  const hasGear = SLOTS.some((slot) => loadout[slot] != null);

  return (
    <main className={colClass}>
      <Panel>
        <div className={panelHClass}>
          <h2 className={panelTitleClass}>{t.panelItems}</h2>
          <FieldRequired show={!hasGear}>{t.fieldRequired}</FieldRequired>
        </div>
        <GearSlotsGrid loadout={loadout} t={t} lang={lang} onPatchSlot={onPatchSlot} />
        {hasGear && <GearSlotStatsGrid loadout={loadout} t={t} formatNumber={formatNumber} />}
        <GearCompareSection />
      </Panel>
    </main>
  );
}
