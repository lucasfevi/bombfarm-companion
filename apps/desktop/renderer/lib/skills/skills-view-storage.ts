/**
 * What the Skill Tree screen remembers between visits: which objective the recommendation panel
 * ranks by, and which gate phase Gate clear is priced at. Its own key, beside the Farm screen's.
 */
import { type SkillPricingObjective } from '@bombfarm/domain/skill-tree';

const SKILLS_VIEW_STORAGE_KEY = 'bfc-skills-view';

const OBJECTIVES: readonly SkillPricingObjective[] = ['goldPerHour', 'gateClear', 'pvp'];

export type SkillsView = {
  readonly objective: SkillPricingObjective;
  readonly gatePhase: number | null;
};

export const DEFAULT_SKILLS_VIEW: SkillsView = { objective: 'goldPerHour', gatePhase: null };

function readObjective(raw: unknown): SkillPricingObjective {
  if (raw === 'teamDps') return 'gateClear';
  return OBJECTIVES.find((candidate) => candidate === raw) ?? DEFAULT_SKILLS_VIEW.objective;
}

function readGatePhase(raw: unknown): number | null {
  return typeof raw === 'number' && Number.isInteger(raw) && raw > 0 ? raw : null;
}

function normalizeSkillsView(value: unknown): SkillsView {
  if (typeof value !== 'object' || value === null) return DEFAULT_SKILLS_VIEW;
  const raw = value as Record<string, unknown>;
  return { objective: readObjective(raw.objective), gatePhase: readGatePhase(raw.gatePhase) };
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
