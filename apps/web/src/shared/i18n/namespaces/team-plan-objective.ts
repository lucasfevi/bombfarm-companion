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
    'Team auras here come from the scoped roster, each carrier weighted by its predicted uptime. The Combat tab’s aura switches are ignored on this page but still drive the Planner’s own DPS.',
  teamPlanAuraDisclosureFarm:
    'Team auras here come from the scoped roster, each carrier weighted by its predicted uptime. The Combat tab’s aura switches are ignored on this page, though the Planner page still follows them.',
  teamPlanPlannerDivergenceDps:
    'Planner DPS can differ from this page when roster-derived auras replace the Combat tab’s aura switches, or when {ability} is modelled here only.',
  teamPlanPlannerDivergenceFarm:
    'The Planner’s own figures can differ from this page when roster-derived auras replace the Combat tab’s aura switches, or when {ability} is modelled here only.',
  /** Rendered on the FARM page, beside the respec advisor's own scope sentence. */
  teamPlanFarmAdvisorPointer: 'For gear moves and forge work as well, use the Optimizer page.',
};

const hostPt: ObjectiveHostCopy = {
  teamPlanObjectiveFarmNeedsMaxPhase:
    'Deixar a busca escolher a própria fase exige a fase mais distante que sua conta alcançou, que este save não trouxe. Escolha uma fase acima, reimporte o save, ou pontue por dano.',
  teamPlanAuraDisclosureDps:
    'Auras de time aqui vêm do roster no escopo, cada portador ponderado pelo seu tempo ativo previsto. Os interruptores de aura da aba Combate são ignorados nesta página, mas ainda movem o DPS do Planner.',
  teamPlanAuraDisclosureFarm:
    'Auras de time aqui vêm do roster no escopo, cada portador ponderado pelo seu tempo ativo previsto. Os interruptores de aura da aba Combate são ignorados nesta página, embora a página do Planner ainda os siga.',
  teamPlanPlannerDivergenceDps:
    'O DPS do Planner pode divergir quando auras derivadas do roster substituem os interruptores de aura da aba Combate, ou quando {ability} é modelada só aqui.',
  teamPlanPlannerDivergenceFarm:
    'Os números do próprio Planner podem divergir desta página quando auras derivadas do roster substituem os interruptores de aura da aba Combate, ou quando {ability} é modelada só aqui.',
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
