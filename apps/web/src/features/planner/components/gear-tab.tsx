'use client';

import { GearTab as GearTabView } from '@bombfarm/hero/components';
import { SlotEditor } from '@/features/gear';
import { useAppLang } from '@/shared/context/app-lang';
import { usePlannerStore, selectAdvisorPipeline } from '@/shared/stores';
import { useHeroBuildActions } from '../hooks/use-hero-build-actions';

/**
 * Store wiring for the shared Items panel. It lives here, one level below `PlannerTabs`, so a
 * loadout or pipeline change wakes this panel alone — subscribing on the panel's behalf from the
 * tab shell would re-render the hero strip and every sibling tab with it.
 */
export function GearTab() {
  const { t, lang } = useAppLang();
  const pipeline = usePlannerStore(selectAdvisorPipeline);
  const loadout = usePlannerStore((state) => state.loadout);
  const altLoadout = usePlannerStore((state) => state.altLoadout);
  const { setSlot, setAltSlot, clearCompare, copyGear, applyAltGear } = useHeroBuildActions();

  return (
    <GearTabView
      t={t}
      lang={lang}
      loadout={loadout}
      altLoadout={altLoadout}
      pipeline={pipeline}
      editing={{
        onPatchSlot: setSlot,
        onPatchAltSlot: setAltSlot,
        onApplyAltGear: applyAltGear,
        onCopyGear: copyGear,
        onClearCompare: clearCompare,
      }}
      renderSlot={({ slot, equipped, changed, onPatch }) => (
        <SlotEditor
          slot={slot}
          equipped={equipped}
          changed={changed}
          t={t}
          lang={lang}
          onPatch={onPatch}
        />
      )}
    />
  );
}
