import { describe, expect, it } from 'vitest';
import { STRINGS, sub } from '@/shared/i18n';
import {
  computePlannerTabStatuses,
  tabStatus,
  type PlannerTabStatusInput,
} from '@bombfarm/domain/planner-tab-status';

const t = STRINGS.en;

function base(overrides: Partial<PlannerTabStatusInput> = {}): PlannerTabStatusInput {
  return {
    hasGear: true,
    usingDefaultSheet: false,
    ptsLeft: 0,
    level: 40,
    abilityPtsLeft: 0,
    abilityPointsMax: 30,
    resetAdviceRecommend: false,
    t,
    ...overrides,
  };
}

describe('tabStatus', () => {
  it('returns empty badge when issues are empty', () => {
    expect(tabStatus('soft', 'Title', [])).toEqual({ badge: null, title: '', issues: [] });
  });

  it('keeps badge + title when issues exist', () => {
    expect(tabStatus('warn', 'Off', ['a'])).toEqual({
      badge: 'warn',
      title: 'Off',
      issues: ['a'],
    });
  });
});

describe('computePlannerTabStatuses', () => {
  it('is clean when gear, sheet, points, and abilities are ready', () => {
    const s = computePlannerTabStatuses(base());
    expect(s.heroTabStatus.badge).toBeNull();
    expect(s.gearTabStatus.badge).toBeNull();
    expect(s.pointsTabStatus.badge).toBeNull();
    expect(s.setupReady).toBe(true);
    expect(s.setupPrereqsReady).toBe(true);
  });

  it('exposes no Account tab status — Account is a route of its own, not a planner tab', () => {
    expect('accountTabStatus' in computePlannerTabStatuses(base())).toBe(false);
  });

  it('Abilities tab soft-dots for default sheet and unspent ability points', () => {
    const s = computePlannerTabStatuses(
      base({ usingDefaultSheet: true, abilityPtsLeft: 10, abilityPointsMax: 30 }),
    );
    expect(s.heroTabStatus.badge).toBe('soft');
    expect(s.heroTabStatus.title).toBe(t.tabHeroWarnTitle);
    expect(s.heroTabStatus.issues).toEqual([
      t.setupNeedSheet,
      sub(t.setupNeedUnspentAbilities, { left: 10, max: 30 }),
    ]);
  });

  it('Abilities tab warns only for unspent abilities when sheet is set', () => {
    const s = computePlannerTabStatuses(base({ abilityPtsLeft: 5, abilityPointsMax: 30 }));
    expect(s.heroTabStatus.badge).toBe('soft');
    expect(s.heroTabStatus.issues).toEqual([
      sub(t.setupNeedUnspentAbilities, { left: 5, max: 30 }),
    ]);
  });

  it('Gear soft-dots when empty; never sheet-mismatch warns on Gear', () => {
    const empty = computePlannerTabStatuses(base({ hasGear: false }));
    expect(empty.gearTabStatus.badge).toBe('soft');
    expect(empty.gearTabStatus.issues).toEqual([t.setupNeedGear]);

    const withGear = computePlannerTabStatuses(base({ hasGear: true }));
    expect(withGear.gearTabStatus.badge).toBeNull();
    expect(withGear.gearTabStatus.issues).toEqual([]);
  });

  it('Points flags unspent points without math-check prerequisites', () => {
    const s = computePlannerTabStatuses(base({ ptsLeft: 12, level: 40, hasGear: true }));
    expect(s.pointsTabStatus.badge).toBe('soft');
    expect(s.pointsTabStatus.issues).toEqual([
      sub(t.setupNeedUnspentPts, { left: 12, max: 40 }),
    ]);
    expect(s.setupPrereqIssues).not.toContain(t.setupNeedGear);
  });

  it('Points warn-dots when the reset gate recommends Optimize build', () => {
    const s = computePlannerTabStatuses(base({ resetAdviceRecommend: true }));
    expect(s.pointsTabStatus.badge).toBe('warn');
    expect(s.pointsTabStatus.title).toBe(t.tabPointsWarnTitle);
    expect(s.pointsTabStatus.issues).toEqual([t.tabPointsResetAdvice]);
  });

  it('Points warn takes priority over soft unspent when the gate also fires', () => {
    const s = computePlannerTabStatuses(
      base({ resetAdviceRecommend: true, ptsLeft: 5, level: 40 }),
    );
    expect(s.pointsTabStatus.badge).toBe('warn');
    expect(s.pointsTabStatus.issues).toEqual([
      sub(t.setupNeedUnspentPts, { left: 5, max: 40 }),
      t.tabPointsResetAdvice,
    ]);
  });

  it('Points lists gear + sheet + unspent when incomplete', () => {
    const s = computePlannerTabStatuses(
      base({
        hasGear: false,
        usingDefaultSheet: true,
        ptsLeft: 3,
        level: 10,
      }),
    );
    expect(s.pointsTabStatus.issues).toEqual([
      t.setupNeedGear,
      t.setupNeedSheet,
      sub(t.setupNeedUnspentPts, { left: 3, max: 10 }),
    ]);
  });
});
