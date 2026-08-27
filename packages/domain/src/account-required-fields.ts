/**
 * Which save-file fields the planner cannot work without, and how a save that lacks one is
 * reported (issue #141).
 *
 * `AccountImportData` types every account field as nullable, so `null` used to do double duty:
 * "nothing has been imported yet" and "the imported save was missing this". Those want opposite
 * handling — the first is a normal first run, the second is a defect only a fresh export can fix
 * — and neither was distinguishable nor surfaced.
 *
 * A field is REQUIRED when the save is the only place its value can come from. Every panel that
 * shows account data is read-only: no screen sets the House, the House level or the farm phase,
 * so a save that omits one leaves the planner permanently wrong about it. The committed export
 * corpus carries all five on every capture, so absence is a malformed save, never a young
 * account.
 */
export const REQUIRED_ACCOUNT_FIELDS = [
  /** `skills.totals` — every damage number is a multiple of `dmg_static`. */
  'tree',
  /** `casa.active_casa` — sets recovery time and recovery slots for the whole rotation. */
  'houseIdx',
  /** `casa.levels[houseIdx]` — inseparable from `houseIdx` today; checked in its own right. */
  'houseLevel',
  /** `account.phase` — the phase every hero is scored against. */
  'phase',
  /**
   * `account.max_phase` — the phase ceiling. Absent, `resolveUpperPhase` reads "no ceiling" and
   * the Farm Respec Advisor can recommend spending real gold toward an unreachable phase.
   */
  'maxPhase',
] as const;

export type RequiredAccountField = (typeof REQUIRED_ACCOUNT_FIELDS)[number];

/**
 * Deliberately NOT required, each for its own reason — recorded here because a future reader's
 * first instinct is to "finish the list":
 *
 * - `fieldSlots` falls back to `slots`, `houseCycleSecs` to the `HOUSES` table interpolation and
 *   `slots` to `DEFAULT_CASA_SLOTS`. Each fallback is correct on its own terms.
 * - `playerName` / `accountId` are optional export keys, scrubbed from every committed fixture,
 *   and nothing computes with them.
 */
export const OPTIONAL_ACCOUNT_FIELDS = ['slots', 'fieldSlots', 'houseCycleSecs', 'playerName', 'accountId'] as const;

/**
 * Structural rather than `AccountImportData`, so `import-save.ts` can import this module without
 * a cycle. Every member is the parsed value, not the raw save key.
 */
export type RequiredAccountFieldSource = {
  tree: unknown;
  houseIdx?: number | null;
  houseLevel?: number | null;
  phase?: number | null;
  maxPhase?: number | null;
};

/** The required fields `account` does not carry, in {@link REQUIRED_ACCOUNT_FIELDS} order. */
export function missingRequiredAccountFields(account: RequiredAccountFieldSource): RequiredAccountField[] {
  return REQUIRED_ACCOUNT_FIELDS.filter((field) => account[field] == null);
}

/**
 * Narrows a persisted value back to known field names. A stored record predating this rule
 * carries nothing here and yields `null` — "never checked", which must not read as "checked and
 * complete" (`[]`) and must not raise a banner. See `AccountShared.missingRequiredFields`.
 */
export function toRequiredAccountFields(raw: unknown): RequiredAccountField[] | null {
  if (!Array.isArray(raw)) return null;
  return REQUIRED_ACCOUNT_FIELDS.filter((field) => raw.includes(field));
}
