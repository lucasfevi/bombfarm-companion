export const SKILL_TOTALS_KEYS = [
  'team_dmg_add',
  'crit_chance_add',
  'crit_dmg_add',
  'speed_add',
  'coin_add',
  'luck_add',
  'energia_add',
  'xp_mult',
  'geo_mult',
  'dmg_static',
  'vagas_campo',
  'bag_tabs_bonus',
] as const;
export type SkillTotalsKey = (typeof SKILL_TOTALS_KEYS)[number];

/** `skills.totals` as the server aggregates it — fractions, multipliers on 1, and two counts. */
export type SkillTotals = Readonly<Record<SkillTotalsKey, number>>;

export type SkillTreeState = {
  /** Owned level per node id; a node absent here is at level 0. The hub never appears. */
  readonly levels: Readonly<Record<string, number>>;
  /** Gold the server returns for undoing each owned node's top level. */
  readonly refunds: Readonly<Record<string, number>>;
  readonly gold: number | null;
  readonly maxPhase: number | null;
  readonly fieldSlots: number | null;
  readonly bagTabs: number | null;
  readonly totals: SkillTotals | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function numberMap(value: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isRecord(value)) return out;
  for (const [key, raw] of Object.entries(value)) {
    const parsed = asNumber(raw);
    if (parsed !== null) out[key] = parsed;
  }
  return out;
}

export function parseSkillTotals(value: unknown): SkillTotals | null {
  if (!isRecord(value)) return null;
  const out: Partial<Record<SkillTotalsKey, number>> = {};
  for (const key of SKILL_TOTALS_KEYS) {
    const parsed = asNumber(value[key]);
    if (parsed === null) return null;
    out[key] = parsed;
  }
  return out as SkillTotals;
}

/** The `/skill/state` body (or a save export's `skills` block). `null` when it carries no `levels`. */
export function parseSkillTreeState(skills: unknown): SkillTreeState | null {
  if (!isRecord(skills) || !isRecord(skills.levels)) return null;
  return {
    levels: numberMap(skills.levels),
    refunds: numberMap(skills.refunds),
    gold: asNumber(skills.gold),
    maxPhase: asNumber(skills.max_phase),
    fieldSlots: asNumber(skills.field_slots),
    bagTabs: asNumber(skills.bag_tabs),
    totals: parseSkillTotals(skills.totals),
  };
}
