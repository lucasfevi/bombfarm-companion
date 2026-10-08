export const FULL_SKILL_TOTALS = {
  team_dmg_add: 0,
  crit_chance_add: 0,
  crit_dmg_add: 0,
  speed_add: 0,
  coin_add: 0,
  luck_add: 0,
  energia_add: 0,
  xp_mult: 1,
  geo_mult: 1,
  dmg_static: 1,
  vagas_campo: 0,
  bag_tabs_bonus: 0,
};

export function skillTotals(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...FULL_SKILL_TOTALS, ...overrides };
}
