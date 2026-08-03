import { sub, type Strings } from './shims/i18n';
import { isTargetPropUnset } from './farm-context';

/** Per-tab trust chrome — soft/warn dot + tooltip body (no in-flow banner). */
export type TabStatus = {
  badge: 'soft' | 'warn' | null;
  title: string;
  issues: string[];
};

export function tabStatus(
  badge: 'soft' | 'warn',
  title: string,
  issues: string[],
): TabStatus {
  return issues.length > 0 ? { badge, title, issues } : { badge: null, title: '', issues: [] };
}

export type PlannerTabStatusStrings = Pick<
  Strings,
  | 'setupNeedGear'
  | 'setupNeedSheet'
  | 'setupNeedUnspentPts'
  | 'setupNeedUnspentAbilities'
  | 'setupNeedTargetProp'
  | 'setupBannerTitle'
  | 'tabHeroWarnTitle'
  | 'tabGearWarnTitle'
  | 'tabAccountWarnTitle'
  | 'tabPointsWarnTitle'
  | 'tabPointsResetAdvice'
>;

export type PlannerTabStatusInput = {
  hasGear: boolean;
  usingDefaultSheet: boolean;
  /** `max(0, level - spentDelta)` */
  ptsLeft: number;
  level: number;
  /** `max(0, abilityPointsMax - abilityPointsSpent)` */
  abilityPtsLeft: number;
  abilityPointsMax: number;
  targetProp: string | null;
  /** Active hero Tier-1 reset gate (`shouldRecommendReset`). */
  resetAdviceRecommend: boolean;
  t: PlannerTabStatusStrings;
};

export type PlannerTabStatuses = {
  heroTabStatus: TabStatus;
  gearTabStatus: TabStatus;
  accountTabStatus: TabStatus;
  pointsTabStatus: TabStatus;
  setupPrereqIssues: string[];
  setupIssues: string[];
  setupPrereqsReady: boolean;
  setupReady: boolean;
};

/**
 * Pure tab-status + setup readiness matrix for the planner stage.
 * Account soft-dots when target prop is unset (oneshot ranking).
 */
export function computePlannerTabStatuses(input: PlannerTabStatusInput): PlannerTabStatuses {
  const {
    hasGear,
    usingDefaultSheet,
    ptsLeft,
    level,
    abilityPtsLeft,
    abilityPointsMax,
    targetProp,
    resetAdviceRecommend,
    t,
  } = input;

  const setupPrereqIssues: string[] = [];
  if (!hasGear) setupPrereqIssues.push(t.setupNeedGear);
  if (usingDefaultSheet) setupPrereqIssues.push(t.setupNeedSheet);
  const setupPrereqsReady = setupPrereqIssues.length === 0;
  const setupReady = setupPrereqsReady;

  const pointsIssues: string[] = [];
  if (!hasGear) pointsIssues.push(t.setupNeedGear);
  if (usingDefaultSheet) pointsIssues.push(t.setupNeedSheet);
  if (ptsLeft > 0) {
    pointsIssues.push(sub(t.setupNeedUnspentPts, { left: ptsLeft, max: level }));
  }
  if (resetAdviceRecommend) pointsIssues.push(t.tabPointsResetAdvice);

  const heroIssues: string[] = [];
  if (usingDefaultSheet) heroIssues.push(t.setupNeedSheet);
  if (abilityPtsLeft > 0) {
    heroIssues.push(
      sub(t.setupNeedUnspentAbilities, { left: abilityPtsLeft, max: abilityPointsMax }),
    );
  }

  const accountIssues: string[] = [];
  if (isTargetPropUnset(targetProp)) accountIssues.push(t.setupNeedTargetProp);

  return {
    heroTabStatus: tabStatus('soft', t.tabHeroWarnTitle, heroIssues),
    // Sheet Δ vs items+points used to warn here while Stats lived on Gear; Stats is on
    // Points now, and birth-backed math owns sheet truth — Gear only flags empty loadout.
    gearTabStatus: tabStatus('soft', t.tabGearWarnTitle, [
      ...(!hasGear ? [t.setupNeedGear] : []),
    ]),
    accountTabStatus: tabStatus('soft', t.tabAccountWarnTitle, accountIssues),
    pointsTabStatus: tabStatus(
      resetAdviceRecommend ? 'warn' : 'soft',
      resetAdviceRecommend ? t.tabPointsWarnTitle : t.setupBannerTitle,
      pointsIssues,
    ),
    setupPrereqIssues,
    setupIssues: setupPrereqIssues,
    setupPrereqsReady,
    setupReady,
  };
}
