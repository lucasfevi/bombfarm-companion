import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { sub } from '@bombfarm/hero/copy';
import { teamPlanEn, teamPlanPtBR, type TeamPlanCopy } from '../copy';
import { PvpSquadField } from './pvp-squad-field';

function render(t: TeamPlanCopy, lang: 'en' | 'pt', fielded: number, slots: number): string {
  return renderToStaticMarkup(createElement(PvpSquadField, { t, lang, roomPhase: null, fielded, slots }));
}

describe('PvpSquadField', () => {
  it('reads the squad back against the account’s own slots', () => {
    const html = render(teamPlanEn, 'en', 5, 6);
    expect(html).toContain('5 of 6 fielded');
    expect(html).not.toContain('role="status"');
  });

  it('warns once the scope board fields more than the account’s slots, naming the real number', () => {
    const html = render(teamPlanEn, 'en', 7, 6);
    expect(html).toContain('role="status"');
    expect(html).toContain(sub(teamPlanEn.teamPlanPvpSquadTooMany, { max: '6', excess: '1' }));
  });

  it('says the real number in Portuguese too', () => {
    const html = render(teamPlanPtBR, 'pt', 4, 2);
    expect(html).toContain('4 de 2 em campo');
    expect(html).toContain(sub(teamPlanPtBR.teamPlanPvpSquadTooMany, { max: '2', excess: '2' }));
  });

  it('seven fielded fit the top house’s nine, the fallback with no slots read', () => {
    expect(render(teamPlanEn, 'en', 7, 9)).not.toContain('role="status"');
  });
});
