import {
  teamPlanObjectivePairsEn,
  teamPlanObjectivePairsPtBR,
  type TeamPlanHostCopy,
  type TeamPlanObjectivePairsCopy,
} from '@bombfarm/team-plan/copy';

type ObjectiveHostCopy = Pick<
  TeamPlanHostCopy,
  'teamPlanObjectiveFarmNeedsMaxPhase' | 'teamPlanFarmAdvisorPointer'
>;

const hostEn: ObjectiveHostCopy = {
  teamPlanObjectiveFarmNeedsMaxPhase:
    'Letting the search pick its own phase needs the furthest phase your account has reached, which this save did not carry. Pick a phase above, re-import the save, or score for damage.',
  /** Rendered on the FARM page, beside the respec advisor's own scope sentence. */
  teamPlanFarmAdvisorPointer: 'For gear moves and forge work as well, use the Optimizer page.',
};

const hostPt: ObjectiveHostCopy = {
  teamPlanObjectiveFarmNeedsMaxPhase:
    'Deixar a busca escolher a própria fase exige a fase mais distante que sua conta alcançou, que este save não trouxe. Escolha uma fase acima, reimporte o save, ou pontue por dano.',
  teamPlanFarmAdvisorPointer:
    'Para movimentações de itens e forjas também, use a página Otimizador.',
};

export const en: TeamPlanObjectivePairsCopy & ObjectiveHostCopy = {
  ...teamPlanObjectivePairsEn,
  ...hostEn,
};
export const pt: TeamPlanObjectivePairsCopy & ObjectiveHostCopy = {
  ...teamPlanObjectivePairsPtBR,
  ...hostPt,
};
