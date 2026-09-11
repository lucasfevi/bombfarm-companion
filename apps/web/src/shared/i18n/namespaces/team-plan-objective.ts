import {
  teamPlanObjectivePairsEn,
  teamPlanObjectivePairsPtBR,
  type TeamPlanHostCopy,
  type TeamPlanObjectivePairsCopy,
} from '@bombfarm/team-plan/copy';

type ObjectiveHostCopy = Pick<
  TeamPlanHostCopy,
  | 'teamPlanObjectiveFarmNeedsMaxPhase'
  | 'teamPlanAuraDisclosureDps'
  | 'teamPlanAuraDisclosureFarm'
  | 'teamPlanPlannerDivergenceDps'
  | 'teamPlanPlannerDivergenceFarm'
  | 'teamPlanFarmAdvisorPointer'
>;

const hostEn: ObjectiveHostCopy = {
  teamPlanObjectiveFarmNeedsMaxPhase:
    'Letting the search pick its own phase needs the furthest phase your account has reached, which this save did not carry. Pick a phase above, re-import the save, or score for damage.',
  teamPlanAuraDisclosureDps:
    'Team auras here come from the scoped roster, exclude the hero being scored, and are weighted by each carrier’s duty. The Account tab’s manual Team buffs are ignored on this page but still drive the Planner’s own DPS.',
  teamPlanAuraDisclosureFarm:
    'Team auras here come from the scoped roster, exclude the hero being scored, and are weighted by each carrier’s duty. The Account tab’s manual Team buffs are ignored on this page, though the Planner page still reads them.',
  teamPlanPlannerDivergenceDps:
    'Planner DPS can differ from this page when roster-derived auras replace manual Team buffs, or when {ability} is modelled here only.',
  teamPlanPlannerDivergenceFarm:
    'The Planner’s own figures can differ from this page when roster-derived auras replace manual Team buffs, or when {ability} is modelled here only.',
  /** Rendered on the FARM page, beside the respec advisor's own scope sentence. */
  teamPlanFarmAdvisorPointer: 'For gear moves and forge work as well, use the Optimizer page.',
};

const hostPt: ObjectiveHostCopy = {
  teamPlanObjectiveFarmNeedsMaxPhase:
    'Deixar a busca escolher a própria fase exige a fase mais distante que sua conta alcançou, que este save não trouxe. Escolha uma fase acima, reimporte o save, ou pontue por dano.',
  teamPlanAuraDisclosureDps:
    'Auras de time aqui vêm do roster no escopo, excluem o herói pontuado e são ponderadas pelo duty de cada portador. Os buffs manuais da aba Conta são ignorados nesta página, mas ainda movem o DPS do Planner.',
  teamPlanAuraDisclosureFarm:
    'Auras de time aqui vêm do roster no escopo, excluem o herói pontuado e são ponderadas pelo duty de cada portador. Os buffs manuais da aba Conta são ignorados nesta página, embora a página do Planner ainda os leia.',
  teamPlanPlannerDivergenceDps:
    'O DPS do Planner pode divergir quando auras derivadas do roster substituem buffs manuais, ou quando {ability} é modelada só aqui.',
  teamPlanPlannerDivergenceFarm:
    'Os números do próprio Planner podem divergir desta página quando auras derivadas do roster substituem buffs manuais, ou quando {ability} é modelada só aqui.',
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
