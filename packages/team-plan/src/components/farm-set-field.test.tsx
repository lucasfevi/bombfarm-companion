import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEFAULT_TEAM_PLAN_CONTROLS, type TeamPlanControls, type TeamPlanInputs } from '../core';
import { teamPlanEn } from '../copy';
import { FarmSetField } from './farm-set-field';
import { objectiveUnavailable } from './use-optimize-action';

function render(value: string | null): string {
  return renderToStaticMarkup(
    createElement(FarmSetField, { t: teamPlanEn, lang: 'en', value, maxPhase: 150, onChange: () => undefined }),
  );
}

describe('FarmSetField', () => {
  it('stands in the phase control’s place, named for the set it farms', () => {
    const html = render(null);
    expect(html).toContain('data-testid="team-plan-farm-set"');
    expect(html).toContain(teamPlanEn.teamPlanFarmSetLabel);
    expect(html).toContain(`aria-label="${teamPlanEn.teamPlanFarmSetAria}"`);
  });
});

describe('objectiveUnavailable under a set farm', () => {
  const inputs = { heroes: [], maxPhase: 150, farmChosenPhase: null, phase: 140 } as unknown as TeamPlanInputs;
  const controls = (overrides: Partial<TeamPlanControls>): TeamPlanControls => ({ ...DEFAULT_TEAM_PLAN_CONTROLS, ...overrides });

  it('blocks the run until a set is picked, and never under another objective', () => {
    expect(objectiveUnavailable({ inputs, controls: controls({ objective: 'setFarm' }) }).setFarmBlocked).toBe(true);
    expect(objectiveUnavailable({ inputs, controls: controls({ objective: 'setFarm', farmSet: 'clay' }) }).setFarmBlocked).toBe(false);
    expect(objectiveUnavailable({ inputs, controls: controls({ objective: 'farm' }) }).setFarmBlocked).toBe(false);
  });

  it('needs the furthest phase reached even with a set picked, and blocks under its own flag', () => {
    const noMaxPhase = { ...inputs, maxPhase: null, phase: null } as TeamPlanInputs;
    const result = objectiveUnavailable({ inputs: noMaxPhase, controls: controls({ objective: 'setFarm', farmSet: 'clay' }) });
    expect(result).toEqual({ farmBlocked: false, setFarmBlocked: true, pvpBlocked: false });
  });
});
