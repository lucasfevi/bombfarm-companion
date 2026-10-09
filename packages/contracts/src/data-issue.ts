import type { AccountSection } from './account-payload.js';

/**
 * Something the game stopped sending (or never sent) that the app reads. Produced in one place,
 * shown to the player as a banner entry or a flag on a hero, and logged once per distinct
 * instance so a game patch is diagnosable without a user report. Carries game ids and key names
 * only: nothing that identifies the player.
 */
export type DataIssueKind =
  /** The skill tree lost a required total; the last saved tree is on screen instead. */
  | 'skill_tree_stale'
  /** The skill tree lost a required total and no saved tree exists; it is withheld. */
  | 'skill_tree_withheld'
  /** A hero lacks a field its sheet is built from; the hero is left out of calculations. */
  | 'hero_field_absent'
  /** A piece a hero wears lacks a field its stats are built from; that hero is left out. */
  | 'gear_field_absent'
  /** A piece of gear says nobody wears it and no hero claims it; the piece is left out. */
  | 'gear_owner_unknown'
  /** A piece of gear lost its owner field and a hero's own record named it; read from there. */
  | 'gear_owner_recovered';

export interface DataIssue {
  readonly kind: DataIssueKind;
  readonly section: AccountSection;
  readonly keys: readonly string[];
  readonly heroId?: string | undefined;
  readonly itemId?: string | undefined;
}

/** What makes two issues the same one: logging and banner lists both collapse on it. */
export function dataIssueKey(issue: DataIssue): string {
  return JSON.stringify([issue.kind, issue.section, issue.keys, issue.heroId ?? null, issue.itemId ?? null]);
}
