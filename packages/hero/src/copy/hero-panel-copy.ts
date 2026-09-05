import type { RosterCopy } from './roster-copy';

/**
 * What the per-hero combat panel and its prop table print: the hero-identity vocabulary they
 * already share with the switcher, plus the labels for one hero's fit against one phase.
 *
 * Narrow on purpose, and narrower than the dictionary the screen around them holds. These panels
 * are two leaves of a much wider screen; typing their lookup to that screen's whole dictionary
 * would make this package depend on the screen that renders it, which is the one direction the
 * dependency may not run.
 *
 * Host-supplied, in the same idiom as {@link RosterCopy}: no values live here, and a host passes
 * the flat dictionary it already has.
 */
export type HeroPanelCopy = RosterCopy & {
  colHits: string;
  phasesAvgHit: string;
  phasesCritHit: string;
  phasesFieldTime: string;
  phasesHeroSection: string;
  phasesHeroTip: string;
  phasesNormalHit: string;
  phasesPenetration: string;
  phasesPenOk: string;
  phasesPenShort: string;
  prop: string;
};
