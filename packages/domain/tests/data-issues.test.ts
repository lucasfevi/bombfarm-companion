import { describe, expect, it } from 'vitest';
import type { AccountPayload } from '@bombfarm/contracts';
import { dataIssuesOf, scanRosterIssues } from '@bombfarm/domain/data-issues';
import { minimalHero } from './helpers/minimal-save-hero';

const piece = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  category: 0,
  rarity: 1,
  level: 5,
  upgrade: 0,
  equipped_on: null,
  ...extra,
});

describe('scanRosterIssues', () => {
  it('reports nothing for a roster that lost no field', () => {
    const payload = { heroes: [minimalHero('1')], items: [piece('p1')] } as unknown as AccountPayload;
    expect(scanRosterIssues(payload).issues).toEqual([]);
  });

  it('reads a piece that lost equipped_on from the one hero naming it', () => {
    const payload = {
      heroes: [{ ...minimalHero('1'), slots: ['p1'] }, { ...minimalHero('2'), slots: [] }],
      items: [piece('p1', { equipped_on: undefined })],
    } as unknown as AccountPayload;
    const { issues, ownerOfOrphan } = scanRosterIssues(payload);
    expect(ownerOfOrphan.get('p1')).toBe('1');
    expect(issues).toEqual([{ kind: 'gear_owner_recovered', section: 'items', keys: ['equipped_on'], itemId: 'p1', heroId: '1' }]);
  });

  it('does not guess when two heroes name the same piece', () => {
    const payload = {
      heroes: [{ ...minimalHero('1'), slots: ['p1'] }, { ...minimalHero('2'), slots: ['p1'] }],
      items: [piece('p1', { equipped_on: undefined })],
    } as unknown as AccountPayload;
    expect(scanRosterIssues(payload).ownerOfOrphan.get('p1')).toBeNull();
  });

  it('rolls the fields lost across a hero’s pieces into one issue on that hero', () => {
    const payload = {
      heroes: [minimalHero('1')],
      items: [piece('p1', { equipped_on: '1', upgrade: undefined }), piece('p2', { equipped_on: '1', level: undefined })],
    } as unknown as AccountPayload;
    expect(scanRosterIssues(payload).issues).toEqual([
      { kind: 'gear_field_absent', section: 'items', keys: ['level', 'upgrade'], heroId: '1' },
    ]);
  });

  it('reports spare gear that lost a field without naming any hero', () => {
    const payload = { heroes: [minimalHero('1')], items: [piece('p1', { rarity: undefined })] } as unknown as AccountPayload;
    expect(scanRosterIssues(payload).issues).toEqual([{ kind: 'gear_field_absent', section: 'items', keys: ['rarity'] }]);
  });
});

describe('dataIssuesOf', () => {
  it('turns the keys a live skill tree lost into an issue, whether a saved tree stood in or not', () => {
    const lost = ['skills.totals.xp_mult'];
    const stale = { fidelity: { skills: { status: 'stale', capturedAt: 't', lostKeys: lost } } } as unknown as AccountPayload;
    const withheld = { fidelity: { skills: { status: 'missing', lostKeys: lost } } } as unknown as AccountPayload;
    expect(dataIssuesOf(stale)).toEqual([{ kind: 'skill_tree_stale', section: 'skills', keys: lost }]);
    expect(dataIssuesOf(withheld)).toEqual([{ kind: 'skill_tree_withheld', section: 'skills', keys: lost }]);
  });

  it('says nothing about a stale tree that stands in for no lost key', () => {
    const payload = { fidelity: { skills: { status: 'stale', capturedAt: 't' } } } as unknown as AccountPayload;
    expect(dataIssuesOf(payload)).toEqual([]);
  });
});
