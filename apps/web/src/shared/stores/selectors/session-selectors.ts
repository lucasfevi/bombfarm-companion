import { STRINGS, type Lang, type Strings } from '@/shared/i18n';
import type { PlannerStore } from '@/shared/stores/planner-store';

export const selectLang = (state: PlannerStore): Lang => state.lang;
export const selectToast = (state: PlannerStore): string | null => state.toast;
export const selectBooted = (state: PlannerStore): boolean => state.booted;

/** Referentially stable per language — STRINGS[lang] is a module constant. */
export const selectStrings = (state: PlannerStore): Strings => STRINGS[state.lang];
