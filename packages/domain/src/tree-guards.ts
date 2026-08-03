/**
 * BSPW4-13 (BSP-61, DEC-07, DEC-08) — a loud-failing guard for the two skill-tree
 * clauses this wave deliberately does NOT model:
 *
 * - Deadly Eye's `+25%` crit chance keystone (`DEC-07`). `computeCombatMults` applies
 *   nothing for it — the exporter's handling is entirely unobserved (Stage-120 blocker,
 *   `account.max_phase` is 93 in the newest fixture), and it is unknown whether the bonus
 *   is already folded into `crit_chance_add` (modelling it here would double-count) or not
 *   (omitting it understates). Deferral is the only choice that adds no unevidenced number.
 * - Glass Cannon's `crit_dmg_mult` (`DEC-08`). It is `1.0` in every export; `computeCombatMults`
 *   still applies a boolean `treeGlassCannon` sniff unrelated to this field, left exactly as-is.
 *
 * Both are `[]` / `1` in every fixture in this repo today. `unmodelledTreeFindings` turns that
 * silent assumption into a loud one: the day a save disagrees, this function returns a finding
 * naming the clause, so a maintainer is forced to decide `BSP-61` with real data instead of the
 * deferral quietly drifting into a bug.
 */

export type UnmodelledTreeInput = {
  keystones?: unknown;
  crit_dmg_mult?: unknown;
};

/**
 * Reports every unmodelled skill-tree clause found live in `totals` (a `skills.totals`-shaped
 * object). Never throws — a maintainer decides what to do with the findings.
 */
export function unmodelledTreeFindings(totals: UnmodelledTreeInput): string[] {
  const findings: string[] = [];

  const keystones = totals.keystones;
  if (Array.isArray(keystones) && keystones.length > 0) {
    findings.push(
      `BSP-61: skills.totals.keystones is non-empty (${JSON.stringify(keystones)}) — ` +
        `Deadly Eye's +25% crit chance is deliberately unmodelled (DEC-07). Decide whether ` +
        `the exporter already folds it into crit_chance_add before modelling it in ` +
        `computeCombatMults, or double-counting results.`,
    );
  }

  const critDmgMult = totals.crit_dmg_mult;
  if (typeof critDmgMult === 'number' && Number.isFinite(critDmgMult) && critDmgMult !== 1) {
    findings.push(
      `DEC-08: skills.totals.crit_dmg_mult is ${critDmgMult} (expected 1) — Glass Cannon's ` +
        `crit-damage multiplier is now exercised in real data. Decide whether ` +
        `applySkillTree's critDmgMult shape (AD-BSP-19) needs to consume this value before ` +
        `it silently diverges from the sheet.`,
    );
  }

  return findings;
}
