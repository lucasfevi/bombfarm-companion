import { loadLang } from '@/shared/i18n';
import { loadPhasesView } from '@/shared/lib/phases-view-storage';
import { loadInventory } from '@/shared/lib/inventory-storage';
import { loadTeamPlanScope } from '@/shared/lib/team-plan-scope-storage';
import { dropStaleLocalAccount } from '@/shared/lib/stale-account';
import {
  DEFAULT_ACCOUNT,
  getActiveHeroId,
  loadAccountShared,
  loadHeroes,
} from '@/shared/lib/storage';
import { usePlannerStore } from '@/shared/stores/planner-store';

/**
 * Ordered, idempotent boot read (ASM-06). No-op when already booted (StrictMode).
 * Order: DROP STALE ACCOUNT (MP5 F4, MSG-21…MSG-25) → heroes → active id → account → lang →
 * phases → inventory → scope → setBooted(true) last. The drop reads raw localStorage strings and
 * must run before any `normalize*` call — see `stale-account.ts`'s own header for why.
 *
 * When the drop fires, `loadAccountShared()` is skipped in favour of `DEFAULT_ACCOUNT()` directly.
 * `loadAccountShared()`'s "no `bf-hp-account-v1` key" branch seeds a default account from any
 * lingering hero and PERSISTS it (`storage.ts`'s `loadAccountShared`/`saveAccountShared`) — exactly
 * the new copy `MSG-22` forbids after a drop ("nothing is persisted, so nothing is shown"). Every
 * key the drop clears must stay cleared through the rest of this function.
 */
export function hydratePlannerStore(): void {
  const state = usePlannerStore.getState();
  if (state.booted) return;

  const dropReport = dropStaleLocalAccount();

  const heroes = loadHeroes();
  const activeHeroId = getActiveHeroId();
  state.hydrateRoster(heroes, activeHeroId);

  const account = dropReport.dropped ? DEFAULT_ACCOUNT() : loadAccountShared();
  state.hydrateAccount(account);

  state.hydrateLang(loadLang());
  state.hydratePhasesView(loadPhasesView().phase);

  const inventory = loadInventory();
  state.hydrateInventory(inventory, account.forgeFloor ?? 10);
  state.hydrateScope(loadTeamPlanScope());

  state.setBooted(true);
}
