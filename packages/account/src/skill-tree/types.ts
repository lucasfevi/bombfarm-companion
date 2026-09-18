import type {
  SkillArm,
  SkillEffectKind,
  SkillNode,
  SkillNodeGain,
  SkillPricingObjective,
  SkillTier,
  SkillTotals,
  SkillTreeCatalog,
  SkillTreeLayout,
  SkillTreePricing,
  SkillTreeState,
} from '@bombfarm/domain/skill-tree';

/**
 * Every string and formatter the skill-tree screen prints. Each host builds one from its own copy
 * layer; the screen never sees a language.
 */
export interface SkillTreeLabels {
  title: string;
  /** One line under the title: what the tree is and what the screen adds. */
  tip: string;

  /** Node vocabulary, printed exactly as the game does: kind names for small nodes and unlocks. */
  kindName: (kind: SkillEffectKind) => string;
  /** One effect line per level, e.g. `+0.5% squad damage` / `+1 hero on the field`. */
  effectPerLevel: (kind: SkillEffectKind, perLevel: number) => string;
  /** The same effect summed at a level, e.g. `+5% squad damage at level 10`. */
  effectAtLevel: (kind: SkillEffectKind, total: number) => string;
  /** The bare figure of an effect total — signed percent, or a signed count for the unlock kinds. */
  effectValue: (kind: SkillEffectKind, total: number) => string;
  armName: (arm: SkillArm) => string;
  tierName: (tier: SkillTier) => string;
  /** `Level 3/10`. */
  level: (level: number, max: number) => string;
  hubName: string;
  hubNote: string;
  /**
   * A node's own title, where the game gives it one — the notables, the seven titled smalls
   * (`P01`–`P07`) and the unlocks; `null` for a node named after its kind. The catalog's `name`
   * is that title in Portuguese; a host translating it returns its own.
   */
  nodeName?: (id: string) => string | null;

  /** Node states. */
  stateOwned: string;
  stateMaxed: string;
  stateBuyable: string;
  stateUnaffordable: string;
  stateLockedPrerequisite: (parentName: string, need: number, have: number) => string;
  stateLockedPhase: (phase: number) => string;
  alwaysLit: string;

  /** Costs. */
  nextLevelCost: string;
  costToMax: string;
  /** The refund row's short label; {@link refundTip} carries the rule. */
  refund: string;
  refundTip: string;
  refundBlocked: (childNames: string) => string;
  wallet: string;
  gold: (gold: number) => string;
  /** Compact gold for the canvas and the ranking rows, `1.2M`. */
  goldCompact: (gold: number) => string;
  /** Any figure printed short, `2.57M`, the exact one a hover away. */
  compactNumber: (value: number) => string;
  /** An unsigned gold/hr rate — the preview's baseline and with-node figures. `goldCompact` when absent. */
  goldPerHour?: (value: number) => string;
  /** An unsigned team-DPS figure, for the same two preview rows. A rounded integer when absent. */
  teamDps?: (value: number) => string;

  /** The recommendation panel. */
  nextToBuy: string;
  nextToBuyTip: string;
  objectiveGold: string;
  objectiveGate: string;
  objectivePvp: string;
  /** Ranking figure labels. */
  colNode: string;
  colCost: string;
  colGain: string;
  colPerMillion: string;
  /** `+12.3k gold/h` / `+340 DPS`, signed. */
  gainGold: (delta: number) => string;
  gainDps: (delta: number) => string;
  perMillionGold: (value: number) => string;
  perMillionDps: (value: number) => string;
  /** A gain neither objective can see (luck, XP, bag tabs). */
  gainOutsideObjectives: string;
  /** The ranking has nothing to price: no buyable node, or the roster could not be read. */
  nothingToRecommend: string;
  pvpEmpty: string;
  pricingUnavailable: string;
  /** Names the phase the gold figures are for. */
  pricedAtPhase: (phase: number) => string;
  pricedAtGate: (phase: number, windowSecs: number) => string;
  pricedAtPvp: (phase: number, windowSecs: number) => string;
  /** The gate picker — the Optimizer's phase control, gate phases only. */
  gatePhaseSelect: string;
  /** A gate phase as the app spells phases everywhere else. */
  gatePhaseOption: (phase: number) => string;
  gatePhaseSearchPlaceholder: string;
  gatePhaseNoMatch: string;
  gatePhaseMoreMatches: (shown: number, matched: number) => string;
  /** Heroes left out of the DPS figure — no birth stats. */
  dpsLeftOut: (names: string) => string;
  affordableNow: string;

  /** The selected-node card — an overlay on the tree that opens on select. */
  closeNode: string;
  preview: string;
  previewTip: string;
  previewGold: string;
  /** The combat figures' names: damage per second at that gate, and in the duel at that phase. */
  previewGate: (phase: number) => string;
  previewPvp: (phase: number) => string;
  /** `now → next`, for a stat total moving one level. */
  totalNowNext: (now: string, next: string) => string;
  requires: string;
  gate: string;
  arm: string;
  tier: string;
  effects: string;

  /** The totals summary — the game's own summary rows. */
  totals: string;
  totalsTip: string;
  totalRows: Record<keyof SkillTotals, string>;
  formatTotal: (key: keyof SkillTotals, value: number) => string;
  levelsBought: string;
  /** `825 / 1,095`. */
  countOf: (part: number, whole: number) => string;
  /** An unsigned share, `75.3%`. */
  share: (fraction: number) => string;
  goldSpent: string;
  goldToMax: string;

  /** Canvas controls. */
  fitToView: string;
  zoomIn: string;
  zoomOut: string;
  legend: string;
  legendOwned: string;
  legendBuyable: string;
  legendUnaffordable: string;
  legendLocked: string;
  legendRecommended: string;
  canvasAria: string;
  nodeAria: (name: string, level: number, max: number) => string;
}

export interface SkillTreeScreenProps {
  catalog: SkillTreeCatalog;
  layout: SkillTreeLayout;
  state: SkillTreeState;
  /** The tree's totals as the server reports them, or rebuilt from the levels. */
  totals: SkillTotals;
  /** `null` while the roster cannot be priced; the screen still draws the tree. */
  pricing: SkillTreePricing | null;
  objective: SkillPricingObjective;
  onObjectiveChange: (objective: SkillPricingObjective) => void;
  /** The objectives this host can price — a planner with no PVP squad source leaves `pvp` out. */
  objectives?: readonly SkillPricingObjective[];
  gatePhase: number;
  onGatePhaseChange: (phase: number) => void;
  /** PVP standing squad is empty — ranking stays hidden. */
  pvpEmpty?: boolean;
  /** The medallion for a node — the host resolves art. */
  nodeArtSrc: (node: SkillNode) => string | null;
  labels: SkillTreeLabels;
  /** Controlled selection, so a host can deep-link or remember it. */
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  /** Rows the recommendation panel shows. */
  recommendationCount?: number;
  className?: string;
}

export type { SkillNodeGain };
