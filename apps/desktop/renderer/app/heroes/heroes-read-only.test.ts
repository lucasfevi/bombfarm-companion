/**
 * The Heroes screen draws the account and changes nothing.
 *
 * Every panel it borrows from `@bombfarm/hero` takes its editing callbacks as OPTIONAL props, and
 * each one's own reading (`pointsPanelReading`, `gearPanelReading`) turns every control off when
 * they are absent. So the whole read-only posture rests on one thing: this screen passing none of
 * them. That is invisible to types — an omitted optional prop compiles — and invisible to the
 * panels' own tests, which prove the readings and not who supplies them.
 *
 * Two independent proofs below. The first reads the screen's source and fails if any editing prop
 * name appears in it. The second calls the panels' own readings with what this screen supplies and
 * asserts every control they gate comes back off, so a future package change that made a control
 * render WITHOUT callbacks would fail here rather than quietly ship an editable desktop screen.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { gearPanelReading, pointsPanelReading } from '@bombfarm/hero/model';

const SCREEN_SOURCE = readFileSync(join(__dirname, 'heroes-view.tsx'), 'utf8');

/** Names the panels use for the callbacks that write, plus the two props that mount an editor. */
const EDITING_PROPS = [
  'editing',
  'renderSlot',
  'onPts',
  'onPatchSlot',
  'onPatchAltSlot',
  'onApplyAltGear',
  'onCopyGear',
  'onClearCompare',
  'runFarmOptimize',
  'optimizeMode',
  'onOptimizeModeChange',
] as const;

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function editingPropsIn(source: string): string[] {
  const code = stripComments(source);
  return EDITING_PROPS.filter((prop) => new RegExp(`\\b${prop}\\b`).test(code));
}

describe('the Heroes screen passes no editing callback to any panel', () => {
  it('not one editing prop name appears in the screen source', () => {
    expect(
      editingPropsIn(SCREEN_SOURCE),
      'The Heroes screen renders what the account says and changes nothing. Passing any of these ' +
        'turns on a stepper, a Reset, an Optimize build, a slot editor, or a control that ' +
        'rewrites a loadout.',
    ).toEqual([]);
  });

  it('red state demonstrated: a screen that handed one of them over is caught', () => {
    const fixture = '<GearTab editing={{ onCopyGear: copy }} />';
    expect(editingPropsIn(fixture)).toEqual(['editing', 'onCopyGear']);
  });
});

describe('the panels answer read-only to what this screen supplies', () => {
  it('the points panel offers no Reset, no steppers, no preview actions and no reset advice', () => {
    expect(pointsPanelReading({ editable: false, heroBattleAllowed: true })).toEqual({
      showReset: false,
      showPointSteppers: false,
      showPreviewActions: false,
      showResetAdvice: false,
    });
  });

  it('the items panel offers no slot editors and no control that changes either loadout', () => {
    expect(gearPanelReading({ editable: false, hasSlotEditor: false })).toEqual({
      showSlotEditors: false,
      showCompareControls: false,
    });
  });
});
