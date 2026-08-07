'use client';

import { useState } from 'react';
import type { GearPlan } from '@bombfarm/domain/gear-plan/types';
import { Button, ConfirmDialog } from '@bombfarm/ui';
import type { Strings } from '@/shared/i18n';
import { sub } from '@/shared/i18n';
import { usePlannerStore, selectHeroes } from '@/shared/stores';
import { heroScopeKey } from '@/features/gear-plan/model/build-gear-plan-input';
import { formatNumber } from '@/shared/lib/format-number';

export function SendToAltLoadout({ t, plan }: { t: Strings; plan: GearPlan }) {
  const heroes = usePlannerStore(selectHeroes);
  const setAltLoadouts = usePlannerStore((state) => state.setAltLoadouts);
  const flashToast = usePlannerStore((state) => state.flashToast);
  const [open, setOpen] = useState(false);

  const updates: Record<string, NonNullable<GearPlan['proposedLoadouts'][string]>> = {};
  for (const hero of heroes) {
    const key = heroScopeKey(hero);
    const proposed = plan.proposedLoadouts[key];
    if (!proposed) continue;
    updates[hero.id] = proposed;
  }
  const count = Object.keys(updates).length;
  if (count === 0) return null;

  // This action only ever pushes `proposedLoadouts` (gear) — never points. When the gear step
  // requires the full plan (option B: it dips below current until the resets land), the player
  // is sent exactly into that dipped state, so the confirm dialog must say so plainly. The push
  // itself is never blocked — this is disclosure only.
  const confirmBody = plan.requiresFullPlan
    ? sub(t.gearPlanSendConfirmBodyDip, { delta: formatNumber(plan.gearDipDps, 0) })
    : t.gearPlanSendConfirmBody;

  return (
    <>
      <Button type="button" variant="primary" onClick={() => setOpen(true)}>
        {t.gearPlanSendToAlt}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t.gearPlanSendConfirmTitle}
        description={confirmBody}
        confirmLabel={sub(t.gearPlanSendConfirmCount, { count: String(count) })}
        cancelLabel={t.importCancel}
        onConfirm={() => {
          setAltLoadouts(updates);
          flashToast(sub(t.gearPlanSendDone, { count: String(count) }));
        }}
      />
    </>
  );
}
