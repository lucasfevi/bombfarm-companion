import { describe, expect, it } from 'vitest';
import { pointsPanelReading } from './points-panel';

describe('pointsPanelReading', () => {
  it('an editing host keeps every control the panel has always drawn', () => {
    expect(pointsPanelReading({ editable: true, heroBattleAllowed: true })).toEqual({
      showReset: true,
      showPointSteppers: true,
      showPreviewActions: true,
      showResetAdvice: true,
    });
  });

  it('an editing host on a disabled hero still hides only the advice line', () => {
    expect(pointsPanelReading({ editable: true, heroBattleAllowed: false })).toEqual({
      showReset: true,
      showPointSteppers: true,
      showPreviewActions: true,
      showResetAdvice: false,
    });
  });

  it('a host that supplies no callbacks gets figures and no controls', () => {
    expect(pointsPanelReading({ editable: false, heroBattleAllowed: true })).toEqual({
      showReset: false,
      showPointSteppers: false,
      showPreviewActions: false,
      showResetAdvice: false,
    });
  });

  it('the advice line never survives on its own — it names a button that is not there', () => {
    for (const heroBattleAllowed of [true, false]) {
      expect(pointsPanelReading({ editable: false, heroBattleAllowed }).showResetAdvice).toBe(false);
    }
  });
});
