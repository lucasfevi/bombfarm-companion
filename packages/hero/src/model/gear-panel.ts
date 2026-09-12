/**
 * Which of the Items panel's parts a host gets. Editing is optional and arrives in two independent
 * pieces, so the two readings are not the same boolean:
 *
 * - `showSlotEditors` needs both. The per-slot editor is a host-injected render slot, and the
 *   callbacks that commit a patch are the host's too; either one alone would draw an editor that
 *   cannot write, or wire a write to nothing.
 * - `showCompareControls` needs only the callbacks. Copy, Apply, Re-copy and Clear act on a whole
 *   loadout, so a host with no per-slot editor can still drive them, and the invitation to copy the
 *   current gear into a clone rides with them — without the button it advertises a control the
 *   reader cannot reach.
 *
 * A host that supplies neither gets the same figures — totals, per-slot stats, the compare
 * scoreboard — with no control that changes either loadout.
 *
 * `showCompare` is whether to draw the comparison AT ALL. A comparison needs a second loadout,
 * and the only way one comes into being is a host copying the current gear into a clone and
 * editing it. So a host with no callbacks and no clone already in hand can never fill that
 * section, and drawing it leaves a heading with nothing under it.
 *
 * It is a function rather than a pair of conditions inside the JSX because this package renders no
 * component in a test — logic in JSX here is logic nothing can prove.
 */
export type GearPanelReading = {
  showSlotEditors: boolean;
  showCompareControls: boolean;
  showCompare: boolean;
};

export function gearPanelReading(input: {
  editable: boolean;
  hasSlotEditor: boolean;
  hasAltLoadout?: boolean;
}): GearPanelReading {
  const { editable, hasSlotEditor, hasAltLoadout = false } = input;
  return {
    showSlotEditors: editable && hasSlotEditor,
    showCompareControls: editable,
    showCompare: editable || hasAltLoadout,
  };
}
