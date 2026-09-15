/**
 * What the Items panel and the loadout comparison print: the panel and section headings, the
 * per-slot and totals stat names, and the compare vocabulary — current versus clone, the two
 * metrics scored, and the four controls that copy, apply, re-copy or clear a clone.
 *
 * Host-supplied, in the same idiom as `RosterCopy` and `StatPanelCopy`: no values live here, and a
 * host passes the flat dictionary it already has. Every one of these is vocabulary a host already
 * prints — "Damage", "Luck" and "Clear" head half its other screens — so copying them into this
 * package's own dictionary would give each string two owners that nothing keeps in sync.
 *
 * Kept apart from `StatPanelCopy` rather than folded into it: these panels and the sheet/points
 * panels are different leaves of the same screen, and a host that renders only one of them would
 * otherwise owe the other's whole vocabulary. `fieldRequired` is the single member both name, and
 * it still has one owner — the host's own dictionary.
 *
 * `gearSlotEmptyAria`, `gearSlotEmptyTip` and `rankLv` are the three the slot card shares with
 * `RosterCopy`; a host that satisfies both from one dictionary supplies each once.
 *
 * `slotStatLabels` and `slotStatFullLabels` name their seven item stats individually rather than
 * as a record over the catalog's `ItemStat`, which widens to `string` — under that key type every
 * lookup would come back possibly-undefined and a missing stat would print nothing instead of
 * failing to compile. The short set is what a slot card prints beside its values; the full set
 * heads the totals table, which has the width.
 */
export type GearPanelCopy = {
  fieldRequired: string;

  panelItems: string;
  slotStats: string;
  gearSlotEmptyAria: string;
  gearSlotEmptyTip: string;
  rankLv: string;
  slotStatLabels: {
    dmg: string;
    energia: string;
    velocidade: string;
    sorte: string;
    crit: string;
    penetracao: string;
    cooldown: string;
  };
  slotStatFullLabels: {
    dmg: string;
    energia: string;
    velocidade: string;
    sorte: string;
    crit: string;
    penetracao: string;
    cooldown: string;
  };

  gearTotals: string;

  panelCompare: string;
  compareTip: string;
  compareCurrent: string;
  compareAlt: string;
  compareHit: string;
  metricSustained: string;
  copyGear: string;
  reCopy: string;
  applyCompare: string;
  clearCompare: string;
};
