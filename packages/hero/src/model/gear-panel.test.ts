import { describe, expect, it } from 'vitest';
import { gearPanelReading } from './gear-panel';

describe('gearPanelReading', () => {
  it('an editing host that injects a slot editor keeps every control the panel has always drawn', () => {
    expect(gearPanelReading({ editable: true, hasSlotEditor: true })).toEqual({
      showSlotEditors: true,
      showCompareControls: true,
    });
  });

  it('an editing host with no injected slot editor still drives the whole-loadout controls', () => {
    expect(gearPanelReading({ editable: true, hasSlotEditor: false })).toEqual({
      showSlotEditors: false,
      showCompareControls: true,
    });
  });

  it('a host that supplies no callbacks gets figures and no control that changes a loadout', () => {
    expect(gearPanelReading({ editable: false, hasSlotEditor: false })).toEqual({
      showSlotEditors: false,
      showCompareControls: false,
    });
  });

  it('an injected editor without callbacks never renders — it could not commit a patch', () => {
    expect(gearPanelReading({ editable: false, hasSlotEditor: true })).toEqual({
      showSlotEditors: false,
      showCompareControls: false,
    });
  });
});
