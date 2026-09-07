/**
 * The Team plan page's objective control, and every string on that page whose wording depends on
 * which objective the search was scoring.
 *
 * Split out of `team-plan.ts` because the `…Dps`/`…Farm` pairs are read as pairs — through
 * `teamPlanObjectiveCopy`, never individually — and because a damage word in the wrong half is
 * the failure this whole shape exists to prevent, which is easier to review with the two halves
 * side by side than scattered through the page's other hundred strings.
 */
export const en = {
  teamPlanObjectiveLabel: 'Score for',
  teamPlanObjectiveAria: 'What this search scores a roster on',
  teamPlanObjectiveOptionDamage: 'Damage',
  teamPlanObjectiveOptionGold: 'Gold',
  teamPlanObjectiveHintDps:
    'Ranks builds by combined roster DPS. Gold per hour is not scored, and can fall.',
  teamPlanObjectiveHintFarm:
    'Ranks builds by the gold per hour the squad brings in at the furthest phase it can hold. A roster that earns more can hit softer.',
  teamPlanObjectiveFarmNeedsMaxPhase:
    'Scoring for gold needs the furthest phase your account has reached, which this save did not carry. Re-import it, or score for damage.',
  teamPlanSetupSectionBodyDps:
    'Builds a plan of gear moves, forge work, and point resets for the heroes you mark Optimize — scored for combined roster DPS.',
  teamPlanSetupSectionBodyFarm:
    'Builds a plan of gear moves, forge work, and point resets for the heroes you mark Optimize — scored for the gold per hour the squad brings in.',
  teamPlanRunSummaryRegimeHintSaturatedDps:
    'More field demand than battle slots — roster DPS is shared across who can fight at once.',
  teamPlanRunSummaryRegimeHintSaturatedFarm:
    'More field demand than battle slots — the squad’s earning rate is shared across who can fight at once.',
  teamPlanTotalGainValueDps: '{delta} dps ({pct}%)',
  teamPlanTotalGainValueFarm: '{delta} gold/h ({pct}%)',
  teamPlanResultsHeaderDps: 'Best roster DPS found by this search',
  teamPlanResultsHeaderFarm: 'Best gold per hour found by this search',
  teamPlanGearDipNoteDps:
    'Temporarily behind by {delta} dps — the Reset points step brings it past today.',
  teamPlanGearDipNoteFarm:
    'Temporarily behind by {delta} gold/h — the Reset points step brings it past today.',
  teamPlanSaturationCalloutDps:
    'Your field is full (battle load {duty} vs {slots} slots). Roster DPS is shared across who can fight at once — advice only; this page will not bench or donate heroes for you.',
  teamPlanSaturationCalloutFarm:
    'Your field is full (battle load {duty} vs {slots} slots). The squad’s earning rate is shared across who can fight at once — advice only; this page will not bench or donate heroes for you.',
  teamPlanAuraDisclosureDps:
    'Team auras here come from the scoped roster, exclude the hero being scored, and are weighted by each carrier’s duty. The Account tab’s manual Team buffs are ignored on this page but still drive the Planner’s own DPS.',
  teamPlanAuraDisclosureFarm:
    'Team auras here come from the scoped roster, exclude the hero being scored, and are weighted by each carrier’s duty. The Account tab’s manual Team buffs are ignored on this page, though the Planner page still reads them.',
  teamPlanPlannerDivergenceDps:
    'Planner DPS can differ from this page when roster-derived auras replace manual Team buffs, or when {ability} is modelled here only.',
  teamPlanPlannerDivergenceFarm:
    'The Planner’s own figures can differ from this page when roster-derived auras replace manual Team buffs, or when {ability} is modelled here only.',
  teamPlanForgeSkippedNoteDps:
    'Forging to your minimum was left out of this plan — it did not improve roster DPS.',
  teamPlanForgeSkippedNoteFarm:
    'Forging to your minimum was left out of this plan — it did not improve the squad’s gold per hour.',
  /** Rendered on the FARM page, beside the respec advisor's own scope sentence. */
  teamPlanFarmAdvisorPointer: 'For gear moves and forge work as well, use the Team plan page.',
};

export const pt: typeof en = {
  teamPlanObjectiveLabel: 'Pontuar por',
  teamPlanObjectiveAria: 'O que esta busca usa para pontuar um roster',
  teamPlanObjectiveOptionDamage: 'Dano',
  teamPlanObjectiveOptionGold: 'Ouro',
  teamPlanObjectiveHintDps:
    'Classifica builds pelo DPS de roster combinado. O ouro por hora não é pontuado, e pode cair.',
  teamPlanObjectiveHintFarm:
    'Classifica builds pelo ouro por hora que o esquadrão rende na fase mais distante que consegue sustentar. Um roster que rende mais pode bater mais fraco.',
  teamPlanObjectiveFarmNeedsMaxPhase:
    'Pontuar por ouro exige a fase mais distante que sua conta alcançou, que este save não trouxe. Reimporte o save, ou pontue por dano.',
  teamPlanSetupSectionBodyDps:
    'Monta um plano de movimentações de itens, forjas e resets de pontos para os heróis marcados como Otimizar — pontuado pelo DPS de roster combinado.',
  teamPlanSetupSectionBodyFarm:
    'Monta um plano de movimentações de itens, forjas e resets de pontos para os heróis marcados como Otimizar — pontuado pelo ouro por hora que o esquadrão rende.',
  teamPlanRunSummaryRegimeHintSaturatedDps:
    'Há mais demanda de campo do que slots de batalha — o DPS do roster é dividido entre quem pode lutar ao mesmo tempo.',
  teamPlanRunSummaryRegimeHintSaturatedFarm:
    'Há mais demanda de campo do que slots de batalha — o ganho por hora do esquadrão é dividido entre quem pode lutar ao mesmo tempo.',
  teamPlanTotalGainValueDps: '{delta} dps ({pct}%)',
  teamPlanTotalGainValueFarm: '{delta} ouro/h ({pct}%)',
  teamPlanResultsHeaderDps: 'Melhor DPS de roster encontrado por esta busca',
  teamPlanResultsHeaderFarm: 'Melhor ouro por hora encontrado por esta busca',
  teamPlanGearDipNoteDps:
    'Temporariamente atrás em {delta} dps — o passo Resetar pontos leva além de hoje.',
  teamPlanGearDipNoteFarm:
    'Temporariamente atrás em {delta} ouro/h — o passo Resetar pontos leva além de hoje.',
  teamPlanSaturationCalloutDps:
    'Seu campo está lotado (carga de batalha {duty} vs {slots} slots). O DPS do roster é dividido entre quem pode lutar ao mesmo tempo — só orientação; esta página não banca nem doa heróis por você.',
  teamPlanSaturationCalloutFarm:
    'Seu campo está lotado (carga de batalha {duty} vs {slots} slots). O ganho por hora do esquadrão é dividido entre quem pode lutar ao mesmo tempo — só orientação; esta página não banca nem doa heróis por você.',
  teamPlanAuraDisclosureDps:
    'Auras de time aqui vêm do roster no escopo, excluem o herói pontuado e são ponderadas pelo duty de cada portador. Os buffs manuais da aba Conta são ignorados nesta página, mas ainda movem o DPS do Planner.',
  teamPlanAuraDisclosureFarm:
    'Auras de time aqui vêm do roster no escopo, excluem o herói pontuado e são ponderadas pelo duty de cada portador. Os buffs manuais da aba Conta são ignorados nesta página, embora a página do Planner ainda os leia.',
  teamPlanPlannerDivergenceDps:
    'O DPS do Planner pode divergir quando auras derivadas do roster substituem buffs manuais, ou quando {ability} é modelada só aqui.',
  teamPlanPlannerDivergenceFarm:
    'Os números do próprio Planner podem divergir desta página quando auras derivadas do roster substituem buffs manuais, ou quando {ability} é modelada só aqui.',
  teamPlanForgeSkippedNoteDps:
    'A forja até o seu mínimo ficou de fora deste plano — ela não melhorou o DPS do roster.',
  teamPlanForgeSkippedNoteFarm:
    'A forja até o seu mínimo ficou de fora deste plano — ela não melhorou o ouro por hora do esquadrão.',
  teamPlanFarmAdvisorPointer:
    'Para movimentações de itens e forjas também, use a página Plano do time.',
};
