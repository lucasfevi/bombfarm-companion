import { describe, expect, it } from 'vitest';
import { gearPanelReading } from './gear-panel';

describe('gearPanelReading', () => {
  it('an editing host that injects a slot editor keeps every control the panel has always drawn', () => {
    expect(gearPanelReading({ editable: true, hasSlotEditor: true })).toEqual({
      showSlotEditors: true,
      showCompareControls: true,
      showCompare: true,
    });
  });

  it('an editing host with no injected slot editor still drives the whole-loadout controls', () => {
    expect(gearPanelReading({ editable: true, hasSlotEditor: false })).toEqual({
      showSlotEditors: false,
      showCompareControls: true,
      showCompare: true,
    });
  });

  it('a host that supplies no callbacks gets figures and no control that changes a loadout', () => {
    expect(gearPanelReading({ editable: false, hasSlotEditor: false })).toEqual({
      showSlotEditors: false,
      showCompareControls: false,
      showCompare: false,
    });
  });

  it('draws no comparison for a host that can neither make one nor was handed one', () => {
    // The failure this is about: a heading with nothing under it. A read-only host has no Copy
    // gear button to create the clone the comparison needs, so the section can never fill.
    expect(
      gearPanelReading({ editable: false, hasSlotEditor: false, hasAltLoadout: false }).showCompare,
    ).toBe(false);
  });

  it('draws the comparison read-only when a clone already exists to compare against', () => {
    // Figures without controls, the same posture every other panel takes: the alt loadout is
    // there, so there is something to show even with no way to change it.
    expect(
      gearPanelReading({ editable: false, hasSlotEditor: false, hasAltLoadout: true }),
    ).toEqual({ showSlotEditors: false, showCompareControls: false, showCompare: true });
  });

  it('an injected editor without callbacks never renders — it could not commit a patch', () => {
    expect(gearPanelReading({ editable: false, hasSlotEditor: true })).toEqual({
      showSlotEditors: false,
      showCompareControls: false,
      showCompare: false,
    });
  });
});
