/**
 * The Optimizer page's objective control, and every string on that page whose wording depends on
 * which objective the search was scoring.
 *
 * Split out of `team-plan.ts` because the `…Dps`/`…Farm` pairs are read as pairs — through
 * `teamPlanObjectiveCopy`, never individually — and because a damage word in the wrong half is
 * the failure this whole shape exists to prevent, which is easier to review with the two halves
 * side by side than scattered through the page's other hundred strings.
 */
export const en = {
  teamPlanPhaseHintNoneDps:
    'No phase pinned. Damage is scored at the phase your account is on now.',
  teamPlanPhaseHintNoneFarm:
    'No phase pinned. The search picks the best phase your squad can hold, and says which one it settled on.',
  /** Rendered only when a plan may respend points at all. Luck is not part of `HeroSheet`, so no
   *  points search can reach it in either direction — worth saying under damage (your Luck is
   *  safe) and worth saying louder under gold (a stat that earns is being held still). */
  teamPlanLuckFrozenDps:
    'Points already in Luck stay put — this search never moves Luck, in either direction.',
  teamPlanLuckFrozenFarm:
    'Points already in Luck stay put — this search never moves Luck, in either direction, even though Luck raises drop rates and so gold per hour.',
  /** The per-hero rows are `perHero[].sustained` — DPS — whatever the roster was scored on
   *  (`waterfall.ts`). Under gold that is a DIFFERENT quantity from the total above it, and the
   *  rows do not sum to it, so the farm half has to say so rather than claim they are the thing
   *  the search optimized. */
  teamPlanHeroDeltaNoteDps:
    'The before/after totals above are combat-effective — team auras are applied and aren’t clamped to the game’s display caps (100% crit chance, 80% cooldown reduction); that’s deliberate, since this uncapped, aura-inclusive view is what the search actually optimizes against. Below, Hero sheet mirrors what the game’s own panel shows (capped); Combat stats keeps that same uncapped view.',
  teamPlanHeroDeltaNoteFarm:
    'These per-hero figures are DPS, not gold per hour — this search scored the squad’s earning rate, which is a rate the whole rotation produces and does not divide per hero, so these will not add up to the total above. They are combat-effective: team auras are applied and aren’t clamped to the game’s display caps (100% crit chance, 80% cooldown reduction). Below, Hero sheet mirrors what the game’s own panel shows (capped); Combat stats keeps that same uncapped view.',
  teamPlanObjectiveLabel: 'Score for',
  teamPlanObjectiveAria: 'What this search scores a roster on',
  teamPlanObjectiveOptionDamage: 'DPS',
  teamPlanObjectiveOptionGold: 'Gold / hr',
  teamPlanObjectiveHintDps:
    'Ranks builds by combined roster DPS. Gold per hour is not scored, and can fall.',
  teamPlanObjectiveHintFarm:
    'Ranks builds by the gold per hour the squad brings in at the phase beside this. A roster that earns more can hit softer.',
  teamPlanObjectiveFarmNeedsMaxPhase:
    'Letting the search pick its own phase needs the furthest phase your account has reached, which this save did not carry. Pick a phase above, re-import the save, or score for damage.',
  /** No longer enumerates gear moves, forge work and point resets: the Allowed changes control
   *  below decides which of those a plan may contain, so listing all three here promises chores a
   *  restricted plan will never produce. */
  teamPlanSetupSectionBodyDps:
    'Builds a plan for the heroes you mark Optimize, out of the changes you allow below — scored for combined roster DPS.',
  teamPlanSetupSectionBodyFarm:
    'Builds a plan for the heroes you mark Optimize, out of the changes you allow below — scored for the gold per hour the squad brings in.',
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
    'Team auras here come from the scoped roster, exclude the hero being scored, and are weighted by each carrier’s duty. The Combat tab’s aura switches are ignored on this page but still drive the Planner’s own DPS.',
  teamPlanAuraDisclosureFarm:
    'Team auras here come from the scoped roster, exclude the hero being scored, and are weighted by each carrier’s duty. The Combat tab’s aura switches are ignored on this page, though the Planner page still follows them.',
  teamPlanPlannerDivergenceDps:
    'Planner DPS can differ from this page when roster-derived auras replace the Combat tab’s aura switches, or when {ability} is modelled here only.',
  teamPlanPlannerDivergenceFarm:
    'The Planner’s own figures can differ from this page when roster-derived auras replace the Combat tab’s aura switches, or when {ability} is modelled here only.',
  teamPlanForgeSkippedNoteDps:
    'Forging to your minimum was left out of this plan — it did not improve roster DPS.',
  teamPlanForgeSkippedNoteFarm:
    'Forging to your minimum was left out of this plan — it did not improve the squad’s gold per hour.',
  /** Rendered on the FARM page, beside the respec advisor's own scope sentence. */
  teamPlanFarmAdvisorPointer: 'For gear moves and forge work as well, use the Optimizer page.',
};

export const pt: typeof en = {
  teamPlanPhaseHintNoneDps:
    'Nenhuma fase fixada. O dano é pontuado na fase em que sua conta está agora.',
  teamPlanPhaseHintNoneFarm:
    'Nenhuma fase fixada. A busca escolhe a melhor fase que seu esquadrão aguenta, e diz qual ficou.',
  teamPlanLuckFrozenDps:
    'Pontos já em Sorte ficam onde estão — esta busca nunca mexe em Sorte, em nenhuma direção.',
  teamPlanLuckFrozenFarm:
    'Pontos já em Sorte ficam onde estão — esta busca nunca mexe em Sorte, em nenhuma direção, mesmo que Sorte aumente as chances de drop e portanto o ouro por hora.',
  teamPlanHeroDeltaNoteDps:
    'Os totais de antes/depois acima são de combate efetivo — as auras de time estão aplicadas e não são limitadas aos tetos de exibição do jogo (100% de chance de crítico, 80% de redução de recarga); isso é proposital, pois essa visão sem teto e com auras é o que a busca realmente otimiza. Abaixo, Ficha do herói espelha o que o próprio painel do jogo mostra (com teto); Stats de combate mantém a mesma visão sem teto.',
  teamPlanHeroDeltaNoteFarm:
    'Estes números por herói são DPS, não ouro por hora — esta busca pontuou o ganho do esquadrão, que é uma taxa que toda a rotação produz e não se divide por herói, então eles não vão somar o total acima. São de combate efetivo: as auras de time estão aplicadas e não são limitadas aos tetos de exibição do jogo (100% de chance de crítico, 80% de redução de recarga). Abaixo, Ficha do herói espelha o que o próprio painel do jogo mostra (com teto); Stats de combate mantém a mesma visão sem teto.',
  teamPlanObjectiveLabel: 'Pontuar por',
  teamPlanObjectiveAria: 'O que esta busca usa para pontuar um roster',
  teamPlanObjectiveOptionDamage: 'DPS',
  teamPlanObjectiveOptionGold: 'Ouro / h',
  teamPlanObjectiveHintDps:
    'Classifica builds pelo DPS de roster combinado. O ouro por hora não é pontuado, e pode cair.',
  teamPlanObjectiveHintFarm:
    'Classifica builds pelo ouro por hora que o esquadrão rende na fase ao lado. Um roster que rende mais pode bater mais fraco.',
  teamPlanObjectiveFarmNeedsMaxPhase:
    'Deixar a busca escolher a própria fase exige a fase mais distante que sua conta alcançou, que este save não trouxe. Escolha uma fase acima, reimporte o save, ou pontue por dano.',
  teamPlanSetupSectionBodyDps:
    'Monta um plano para os heróis marcados como Otimizar, com as mudanças que você permitir abaixo — pontuado pelo DPS de roster combinado.',
  teamPlanSetupSectionBodyFarm:
    'Monta um plano para os heróis marcados como Otimizar, com as mudanças que você permitir abaixo — pontuado pelo ouro por hora que o esquadrão rende.',
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
    'Auras de time aqui vêm do roster no escopo, excluem o herói pontuado e são ponderadas pelo duty de cada portador. Os interruptores de aura da aba Combate são ignorados nesta página, mas ainda movem o DPS do Planner.',
  teamPlanAuraDisclosureFarm:
    'Auras de time aqui vêm do roster no escopo, excluem o herói pontuado e são ponderadas pelo duty de cada portador. Os interruptores de aura da aba Combate são ignorados nesta página, embora a página do Planner ainda os siga.',
  teamPlanPlannerDivergenceDps:
    'O DPS do Planner pode divergir quando auras derivadas do roster substituem os interruptores de aura da aba Combate, ou quando {ability} é modelada só aqui.',
  teamPlanPlannerDivergenceFarm:
    'Os números do próprio Planner podem divergir desta página quando auras derivadas do roster substituem os interruptores de aura da aba Combate, ou quando {ability} é modelada só aqui.',
  teamPlanForgeSkippedNoteDps:
    'A forja até o seu mínimo ficou de fora deste plano — ela não melhorou o DPS do roster.',
  teamPlanForgeSkippedNoteFarm:
    'A forja até o seu mínimo ficou de fora deste plano — ela não melhorou o ouro por hora do esquadrão.',
  teamPlanFarmAdvisorPointer:
    'Para movimentações de itens e forjas também, use a página Otimizador.',
};
