import { isProgressionPageId, type ProgressionPageId } from '../lib/progression/progression-page-store';

export const PROGRESSION_NAV_ID = 'progression';

/** The strip item lit for a screen: Progression holds both of its pages, Settings has no tab. */
export function stripIdForScreen(screenId: string): string | undefined {
  if (isProgressionPageId(screenId)) return PROGRESSION_NAV_ID;
  if (screenId === 'settings') return undefined;
  return screenId;
}

/** The screen a pressed strip item opens: Progression reopens the page it last showed. */
export function screenForStripId(stripId: string, rememberedPage: ProgressionPageId): string {
  return stripId === PROGRESSION_NAV_ID ? rememberedPage : stripId;
}
