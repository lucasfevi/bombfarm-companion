import type { ApplyEquipUnit } from '@bombfarm/contracts';
import { WRITE_ROUTES } from '@bombfarm/game-api';
import type { ApplyRunContext, UnitResult } from './apply-run-context.js';

/** Runs one equip-step unit: an `equip` call names the item and its target hero (guaranteed
 *  non-null by construction — `deriveEquipUnits` never emits an `equip` unit without a target); an
 *  `unequip` call names only the item. */
export async function runEquipUnit(unit: ApplyEquipUnit, ctx: ApplyRunContext): Promise<UnitResult> {
  let verdict: Awaited<ReturnType<ApplyRunContext['call']>>;
  if (unit.call === 'equip') {
    if (unit.toHeroId === null) {
      return { kind: 'stop', stop: 'refused', code: null, call: 'equip', resetDone: false };
    }
    verdict = await ctx.call('equip', { route: WRITE_ROUTES.equip, item: unit.itemId, hero: unit.toHeroId });
  } else {
    verdict = await ctx.call('unequip', { route: WRITE_ROUTES.unequip, item: unit.itemId });
  }

  switch (verdict.kind) {
    case 'ok':
      return { kind: 'ok', goldSpent: 0 };
    case 'skip':
      return verdict;
    case 'stop':
      return { kind: 'stop', stop: verdict.stop, code: verdict.code, call: unit.call, resetDone: false };
    case 'cooldown':
      // ctx.call pauses and resends a cooldown internally; it never resolves with this kind.
      return { kind: 'stop', stop: 'network', code: null, call: unit.call, resetDone: false };
    default: {
      const exhaustive: never = verdict;
      return exhaustive;
    }
  }
}
