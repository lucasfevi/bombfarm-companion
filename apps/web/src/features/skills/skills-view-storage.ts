import type { SkillPricingObjective } from '@bombfarm/domain/skill-tree';

const SKILLS_VIEW_STORAGE_KEY = 'bf-hp-skills-view-v1';

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

export function loadSkillsView(): SkillsView {
  try {
    const stored = localStorage.getItem(SKILLS_VIEW_STORAGE_KEY);
    if (stored === null) return DEFAULT_SKILLS_VIEW;
    const parsed: unknown = JSON.parse(stored);
    return normalizeSkillsView(parsed);
  } catch {
    return DEFAULT_SKILLS_VIEW;
  }
}

export function saveSkillsView(view: SkillsView): void {
  try {
    localStorage.setItem(SKILLS_VIEW_STORAGE_KEY, JSON.stringify(view));
  } catch {
    // A remembered toggle is not worth failing a render over.
  }
}
