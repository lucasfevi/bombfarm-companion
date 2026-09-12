import { describe, expect, it } from 'vitest';
import { pointsPanelReading } from './points-panel';

describe('pointsPanelReading', () => {
  it('an editing host keeps every control the panel has always drawn', () => {
    expect(pointsPanelReading({ editable: true, heroBattleAllowed: true })).toEqual({
      showReset: true,
      showPointSteppers: true,
      showPreviewActions: true,
      showResetAdvice: true,
      mountResetAdvice: true,
    });
  });

  it('an editing host on a disabled hero still hides only the advice line', () => {
    expect(pointsPanelReading({ editable: true, heroBattleAllowed: false })).toEqual({
      showReset: true,
      showPointSteppers: true,
      showPreviewActions: true,
      // Still mounted: the line holds its space so the panel does not reflow when the hero is
      // re-enabled and the advice comes back.
      showResetAdvice: false,
      mountResetAdvice: true,
    });
  });

  it('a host that supplies no callbacks gets figures and no controls', () => {
    expect(pointsPanelReading({ editable: false, heroBattleAllowed: true })).toEqual({
      showReset: false,
      showPointSteppers: false,
      showPreviewActions: false,
      showResetAdvice: false,
      // Nor the blank line: with no Optimize build the advice can never appear, so holding
      // space for it is a gap under the heading that never fills.
      mountResetAdvice: false,
    });
  });

  it('the advice line never survives on its own — it names a button that is not there', () => {
    for (const heroBattleAllowed of [true, false]) {
      expect(pointsPanelReading({ editable: false, heroBattleAllowed }).showResetAdvice).toBe(false);
    }
  });
});

describe('the reserved advice line', () => {
  it('is held open only where the advice can appear at all', () => {
    // The discriminating pair: both hide the line, and only one of them can ever show it again.
    expect(pointsPanelReading({ editable: true, heroBattleAllowed: false })).toMatchObject({
      showResetAdvice: false,
      mountResetAdvice: true,
    });
    expect(pointsPanelReading({ editable: false, heroBattleAllowed: true })).toMatchObject({
      showResetAdvice: false,
      mountResetAdvice: false,
    });
  });
});
