import { type SkillPricingObjective } from '@bombfarm/domain/skill-tree';

const SKILLS_VIEW_STORAGE_KEY = 'bf-hp-skills-view-v1';

/** The planner has no PVP squad source, so `pvp` is not an objective it offers. */
export const WEB_SKILLS_OBJECTIVES: readonly SkillPricingObjective[] = ['goldPerHour', 'gateClear'];

export type SkillsView = {
  readonly objective: SkillPricingObjective;
  readonly gatePhase: number | null;
};

export const DEFAULT_SKILLS_VIEW: SkillsView = { objective: 'goldPerHour', gatePhase: null };

function readObjective(raw: unknown): SkillPricingObjective {
  if (raw === 'teamDps') return 'gateClear';
  return WEB_SKILLS_OBJECTIVES.find((candidate) => candidate === raw) ?? DEFAULT_SKILLS_VIEW.objective;
}

function readGatePhase(raw: unknown): number | null {
  return typeof raw === 'number' && Number.isInteger(raw) && raw > 0 ? raw : null;
}

function normalizeSkillsView(value: unknown): SkillsView {
  if (typeof value !== 'object' || value === null) return DEFAULT_SKILLS_VIEW;
  const raw = value as Record<string, unknown>;
  return { objective: readObjective(raw.objective), gatePhase: readGatePhase(raw.gatePhase) };
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
