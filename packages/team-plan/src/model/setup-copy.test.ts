import { describe, expect, it } from 'vitest';
import { teamPlanEn } from '../copy';
import { allowedChangesHint, ignoreCrowdingHint, optimizeAriaFor } from './setup-copy';

describe('optimizeAriaFor', () => {
  it('names points only when gear moves are not allowed', () => {
    expect(optimizeAriaFor(teamPlanEn, 'points')).toBe(teamPlanEn.teamPlanOptimizeAriaPoints);
  });

  it('names gear moves only when point resets are not allowed', () => {
    expect(optimizeAriaFor(teamPlanEn, 'gear')).toBe(teamPlanEn.teamPlanOptimizeAriaGear);
  });

  it('names both when neither is restricted', () => {
    expect(optimizeAriaFor(teamPlanEn, 'both')).toBe(teamPlanEn.teamPlanOptimizeAriaBoth);
  });
});

describe('allowedChangesHint', () => {
  it('resolves each allowed-changes value to its own hint', () => {
    expect(allowedChangesHint(teamPlanEn, 'points')).toBe(teamPlanEn.teamPlanAllowedChangesHintPoints);
    expect(allowedChangesHint(teamPlanEn, 'gear')).toBe(teamPlanEn.teamPlanAllowedChangesHintGear);
    expect(allowedChangesHint(teamPlanEn, 'both')).toBe(teamPlanEn.teamPlanAllowedChangesHintBoth);
  });
});

describe('ignoreCrowdingHint', () => {
  it('resolves on/off to their own hint', () => {
    expect(ignoreCrowdingHint(teamPlanEn, true)).toBe(teamPlanEn.teamPlanIgnoreCrowdingHintOn);
    expect(ignoreCrowdingHint(teamPlanEn, false)).toBe(teamPlanEn.teamPlanIgnoreCrowdingHintOff);
  });
});
