import { loadLang } from '@/shared/i18n';
import { loadPhasesView } from '@/shared/lib/phases-view-storage';
import {
  getActiveHeroId,
  loadAccountShared,
  loadHeroes,
} from '@/shared/lib/storage';
import { usePlannerStore } from '@/shared/stores/planner-store';

/**
 * Ordered, idempotent boot read (ASM-06). No-op when already booted (StrictMode).
 * Order: heroes → active id → account → lang → phases → setBooted(true) last.
 */
export function hydratePlannerStore(): void {
  const state = usePlannerStore.getState();
  if (state.booted) return;

  const heroes = loadHeroes();
  const activeHeroId = getActiveHeroId();
  state.hydrateRoster(heroes, activeHeroId);

  const account = loadAccountShared();
  state.hydrateAccount(account);

  state.hydrateLang(loadLang());
  state.hydratePhasesView(loadPhasesView().phase);

  state.setBooted(true);
}
