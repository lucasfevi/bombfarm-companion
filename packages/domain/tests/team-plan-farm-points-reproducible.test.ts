/**
 * Its own file because a file never splits across workers, and this one case (two full farm
 * plans on the largest capture) is the solver pass's critical path. Merged back into
 * `team-plan-farm-points.test.ts`, it would put that file's other cases on the path again.
 */
import { describe, expect, it } from 'vitest';
import { farmPlan } from './helpers/team-plan-farm-plan';
import { loadTeamPlanFarmFixture } from './helpers/team-plan-farm-fixtures';

describe('the pass is reproducible', () => {
  const file = 'save-20260823-13heroes-crit-points.json';

  it(`${file}: two runs propose the same points`, () => {
    const fixture = loadTeamPlanFarmFixture(file);
    const first = farmPlan(fixture);
    const second = farmPlan(loadTeamPlanFarmFixture(file));
    expect(second.pointResets).toEqual(first.pointResets);
  }, 900_000);
});
