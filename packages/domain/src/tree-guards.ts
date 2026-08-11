/**
 * Loud findings for skill-tree export fields the companion still does not fully model.
 *
 * Known keystones (`D15` Abisso, `C15` Glass Cannon, `V15` Tempo Dobrado, plus O15/S15/G07)
 * and a non-1 `crit_dmg_mult` from Glass Cannon are **expected** — Glass Cannon (energy ×0.5,
 * crit-damage ×2) and Tempo Dobrado (speed ×1.33333) are sheet-layer effects applied once in
 * `applySkillTree` (`TreeSheetTotals.glassCannon` / `.tempoDobrado` / `.critDmgMult`), and
 * Abisso zeroes Crit/GEO adds in the exporter while leaving a stale `crit_dmg_mult: 2` —
 * Abisso does NOT suppress Glass Cannon's crit-damage ×2, the two are independent effects.
 *
 * Findings fire only for **unknown** keystone ids so a future node still surfaces loudly.
 */

export type UnmodelledTreeInput = {
  keystones?: unknown;
  crit_dmg_mult?: unknown;
};

/** Wiki node ids the companion already knows how to interpret (import sniff / combat flags). */
const KNOWN_KEYSTONE_IDS = new Set(['d15', 'c15', 'v15', 'o15', 's15', 'g07']);

/**
 * Reports every unmodelled skill-tree clause found live in `totals` (a `skills.totals`-shaped
 * object). Never throws — a maintainer decides what to do with the findings.
 */
export function unmodelledTreeFindings(totals: UnmodelledTreeInput): string[] {
  const findings: string[] = [];

  const keystones = totals.keystones;
  if (Array.isArray(keystones) && keystones.length > 0) {
    const unknown = keystones
      .map((keystone) => String(keystone).toLowerCase())
      .filter((id) => !KNOWN_KEYSTONE_IDS.has(id));
    if (unknown.length > 0) {
      findings.push(
        `skills.totals.keystones has unknown id(s) (${JSON.stringify(unknown)}) — ` +
          `decide whether to sniff a new account flag or leave them display-only.`,
      );
    }
  }

  return findings;
}
