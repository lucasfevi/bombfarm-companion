/**
 * What the Skill Tree screen remembers between visits: which objective the recommendation panel
 * ranks by. Its own key, beside the Farm screen's — the two remember different choices about the
 * same account, and neither reads the other's.
 */
import type { SkillPricingObjective } from '@bombfarm/domain/skill-tree';

const SKILLS_VIEW_STORAGE_KEY = 'bfc-skills-view';

const OBJECTIVES: readonly SkillPricingObjective[] = ['goldPerHour', 'teamDps'];

export type SkillsView = {
  readonly objective: SkillPricingObjective;
};

export const DEFAULT_SKILLS_VIEW: SkillsView = { objective: 'goldPerHour' };

function normalizeSkillsView(value: unknown): SkillsView {
  if (typeof value !== 'object' || value === null) return DEFAULT_SKILLS_VIEW;
  const raw = value as Record<string, unknown>;
  const objective = OBJECTIVES.find((candidate) => candidate === raw.objective);
  return objective === undefined ? DEFAULT_SKILLS_VIEW : { objective };
}

/** Never throws and never returns a partial record: an absent, unparseable or half-written value
 *  reads as the defaults. */
export function loadSkillsView(): SkillsView {
  try {
    const stored = window.localStorage.getItem(SKILLS_VIEW_STORAGE_KEY);
    if (stored === null) return DEFAULT_SKILLS_VIEW;
    const parsed: unknown = JSON.parse(stored);
    return normalizeSkillsView(parsed);
  } catch {
    return DEFAULT_SKILLS_VIEW;
  }
}

export function saveSkillsView(view: SkillsView): void {
  try {
    window.localStorage.setItem(SKILLS_VIEW_STORAGE_KEY, JSON.stringify(view));
  } catch {
    // A remembered toggle is not worth failing a render over.
  }
}
