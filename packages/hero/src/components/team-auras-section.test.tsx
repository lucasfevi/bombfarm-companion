// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { TEAM_AURA_SWITCH_IDS, noTeamAuraSwitches, type TeamAuraId, type TeamAuraSwitches } from '@bombfarm/domain/team-buffs';
import { Tooltip } from '@bombfarm/ui';
import { heroCopyFor } from '../copy';
import { TeamAurasSection } from './team-auras-section';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DELTAS = Object.fromEntries(TEAM_AURA_SWITCH_IDS.map((id) => [id, 4.2])) as Record<TeamAuraId, number>;
const t = heroCopyFor('pt');

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  act(() => {
    root = createRoot(container);
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(switches: TeamAuraSwitches, onSwitch: (id: TeamAuraId, on: boolean) => void) {
  act(() => {
    root.render(
      <Tooltip.Provider>
        <TeamAurasSection
          hero={{ abilities: { grito_guerra: 12 } }}
          switches={switches}
          controls={{ deltas: DELTAS, onSwitch }}
          t={t}
          lang="pt"
        />
      </Tooltip.Provider>,
    );
  });
}

describe('TeamAurasSection', () => {
  it('a switch hands its aura and the new state to the host, and its card flips to the "if off" delta', () => {
    const calls: [TeamAuraId, boolean][] = [];
    let switches = noTeamAuraSwitches();
    const onSwitch = (id: TeamAuraId, on: boolean) => {
      calls.push([id, on]);
      switches = { ...switches, [id]: on };
    };
    render(switches, onSwitch);
    const card = () => container.querySelector<HTMLElement>('[data-testid="team-aura-pressagio_mortal"]')!;
    expect(card().querySelector('[data-testid="team-aura-delta"]')?.textContent).toBe('+4,2% se ligada');

    act(() => {
      card().querySelector<HTMLElement>('[role="switch"]')!.click();
    });
    expect(calls).toEqual([['pressagio_mortal', true]]);

    render(switches, onSwitch);
    expect(card().querySelector('[role="switch"]')?.getAttribute('aria-checked')).toBe('true');
    expect(card().querySelector('[data-testid="team-aura-delta"]')?.textContent).toBe('−4,2% se desligada');
  });

  it("the hero's own aura carries the own tag and no switch", () => {
    render(noTeamAuraSwitches(), () => undefined);
    const own = container.querySelector<HTMLElement>('[data-testid="team-aura-grito_guerra"]')!;
    expect(own.querySelector('[role="switch"]')).toBeNull();
    expect(own.querySelector('[data-testid="team-aura-own"]')?.textContent).toBe(t.heroDetailAuraOwnTag);
  });
});
