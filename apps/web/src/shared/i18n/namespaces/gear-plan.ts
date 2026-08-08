export const en = {
  navGearPlan: 'Team plan',
  gearPlanPageLandmark: 'Team plan',
  gearPlanPageTitle: 'Team plan',
  gearPlanEmptyNoRosterTitle: 'Import heroes first',
  gearPlanEmptyNoRosterBody:
    'Export your save in Bomb Farm, then use Import in the top bar to load your roster and item inventory.',
  gearPlanEmptyNoInventoryTitle: 'No item inventory yet',
  gearPlanEmptyNoInventoryBody:
    'Re-import your save so the planner can read every item you own, not only what is equipped.',
  gearPlanEmptyAllLeaveAloneTitle: 'Nothing in scope',
  gearPlanEmptyAllLeaveAloneBody:
    'Set at least one hero to Optimize before running a plan.',
  gearPlanImportCta: 'Import save',
  gearPlanOptimize: 'Build team plan',
  gearPlanOptimizeAria: 'Build a team plan of gear moves and point resets',
  gearPlanOptimizing: 'Building plan…',
  gearPlanOptimizingTitle: 'Building plan…',
  gearPlanOptimizingBody:
    'Looking for the best mix of gear and point resets across the heroes you set to Optimize.',
  gearPlanOptimizingElapsed: 'Elapsed {time}',
  gearPlanOptimizingCancel: 'Cancel',
  gearPlanOptimizingProgressAria: 'Building team plan',
  gearPlanSetupSectionTitle: 'Search setup',
  gearPlanSetupSectionBody:
    'Builds a plan of gear moves, forge work, and point resets for the heroes you mark Optimize — scored for combined roster DPS.',
  gearPlanRunSummaryTitle: 'Search summary',
  gearPlanRunSummaryFieldStatus: 'Field status',
  gearPlanRunSummaryDuty: 'Battle load',
  gearPlanRunSummaryDutyValue: '{duty} of {slots} slots',
  gearPlanRunSummaryDutyHint:
    'How hard your Optimize heroes pull on the field versus how many can fight at once.',
  gearPlanRunSummaryRegimeHintUnder:
    'Your Optimize heroes aren’t competing for battle slots — each keeps their full share of field time.',
  gearPlanRunSummaryRegimeHintSaturated:
    'More field demand than battle slots — roster DPS is shared across who can fight at once.',
  gearPlanBudgetExhausted:
    'Search stopped early to save time — the gain shown is the best found so far, not a promise that nothing better exists.',
  gearPlanMainThreadFallback:
    'This search ran on the main page because the background worker was unavailable — the page may have frozen briefly.',
  gearPlanForgeFloorLabel: 'Min forge (+)',
  gearPlanForgeFloorAria: 'Minimum forge level assumed for every item in the pool',
  gearPlanForgeFloorHint:
    'Every item is scored as if forged to at least this level. Anything lower shows up as a forge chore on that hero.',
  gearPlanScopeSectionTitle: 'Hero scope',
  gearPlanScopeOptimize: 'Optimize',
  gearPlanScopeDonate: 'Donate',
  gearPlanScopeLeaveAlone: 'Leave alone',
  gearPlanScopeOptimizeTip:
    'Scored in the plan. These heroes can receive better items and may give items up.',
  gearPlanScopeDonateTip:
    'Not scored. Their items join the pool for Optimize heroes; they receive nothing back.',
  gearPlanScopeLeaveAloneTip:
    'Frozen. Items stay put and this hero is ignored by the search.',
  gearPlanScopeBoardTip:
    'Drag hero cards between columns. On small screens, use the menu on each card. Battle-disabled heroes start in Donate by default.',
  gearPlanScopeColumnEmpty: 'Drop heroes here',
  gearPlanScopeDragHandleAria: 'Drag to change scope',
  gearPlanScopeNothingInScope: 'Nothing in scope — set at least one hero to Optimize.',
  gearPlanHeroRowLabel: '{name} · Lv {level} · #{id}',
  gearPlanResultsSectionTitle: 'Plan results',
  gearPlanResultsSectionAria: 'Team plan results',
  gearPlanTotalGainLabel: 'Total gain',
  gearPlanTotalGainValue: '{delta} dps ({pct}%)',
  gearPlanWaterfallTitle: 'Gain breakdown',
  gearPlanResultsHeader: 'Best roster DPS found by this search',
  gearPlanStepToday: 'Today',
  gearPlanStepGear: 'Gear',
  gearPlanStepForged: 'Forge to minimum',
  gearPlanStepMoved: 'Moves',
  gearPlanStepRespec: 'Reset points',
  gearPlanRunMetaFooter:
    'Took <em>{seconds}</em>s · <em>{rounds}</em> search passes · <em>{evals}</em> builds checked · {seed}',
  gearPlanRunSeedCurrent: "started from today's items",
  gearPlanRunSeedGreedyHeroDps: 'started with strongest heroes first',
  gearPlanRunSeedGreedySlotValue: 'started with best pieces per slot',
  gearPlanRunSeedBestItemFirst: 'started with the best items first',
  gearPlanRunSeedFallback: 'started from an alternate setup',
  gearPlanHeroDeltaTitle: 'Per-hero changes',
  gearPlanHeroDeltaNote:
    'These are combat-effective stats, not the in-game hero panel — team auras are applied and values aren’t clamped to the game’s display caps (100% crit chance, 80% cooldown reduction). That’s deliberate: the uncapped, aura-inclusive view is what lets this search find the best real DPS.',
  gearPlanColBefore: 'Before',
  gearPlanColAfter: 'After',
  gearPlanColDelta: 'Δ',
  gearPlanHeroDeltaExpandAria: 'Detailed breakdown for {name}',
  gearPlanHeroBreakdownStatsTitle: 'Stat breakdown',
  gearPlanHeroBreakdownGearTitle: 'Proposed items',
  gearPlanHeroBreakdownGearEmpty: 'No proposed items for this hero.',
  gearPlanHeroBreakdownPointsTitle: 'Point reset',
  gearPlanHeroBreakdownPointsEmpty: 'No point reset is recommended for this hero.',
  gearPlanFlowLocationInventory: 'Inventory',
  gearPlanFlowRowFromLabel: 'From',
  gearPlanFlowRowExisting: 'Existing item — no change',
  gearPlanFlowRowForge: 'Forge from +{from} to +{to}',
  gearPlanGearDipNote:
    'Temporarily behind by {delta} dps — the Reset points step brings it past today.',
  gearPlanDisclosuresTitle: 'Assumptions & limits',
  gearPlanSaturationCallout:
    'Your field is full (battle load {duty} vs {slots} slots). Roster DPS is shared across who can fight at once — advice only; this page will not bench or donate heroes for you.',
  gearPlanAuraDisclosure:
    'Team auras here come from the scoped roster, exclude the hero being scored, and are weighted by each carrier’s duty. The Account tab’s manual Team buffs are ignored on this page but still drive the Planner’s own DPS.',
  gearPlanPlannerDivergence:
    'Planner DPS can differ from this page when roster-derived auras replace manual Team buffs, or when {ability} is modelled here only.',
  gearPlanUnmodelledAbilities: 'Unmodelled abilities in scope: {list}',
  gearPlanLoadoutDrift:
    'Stored loadout differs from the inventory snapshot for: {heroes}. This page treats the inventory as authoritative.',
  gearPlanExcludedItems:
    'Excluded from the pool — market-blocked: {market}, unresolved items: {unresolved}, foreign owners: {foreign}.',
  gearPlanForgeSkippedNote:
    'Forging to your minimum was left out of this plan — it did not improve roster DPS.',
  gearPlanStaleNotice:
    'Inputs changed since this plan was computed — run Build team plan again to refresh.',
  gearPlanBlockedTitle: 'Cannot run — missing birth stats',
  gearPlanBlockedBody:
    'Re-export your save so these heroes include a birth roll: {heroes}.',
  gearPlanErrorTitle: 'Search failed',
  gearPlanRetry: 'Try again',
  gearPlanRegimeUnderSaturated: 'Fits the field',
  gearPlanRegimeSaturated: 'Field is full',
};

export const pt: typeof en = {
  navGearPlan: 'Plano do time',
  gearPlanPageLandmark: 'Plano do time',
  gearPlanPageTitle: 'Plano do time',
  gearPlanEmptyNoRosterTitle: 'Importe heróis primeiro',
  gearPlanEmptyNoRosterBody:
    'Exporte o save no Bomb Farm e use Importar na barra superior para carregar o roster e o inventário de itens.',
  gearPlanEmptyNoInventoryTitle: 'Sem inventário de itens',
  gearPlanEmptyNoInventoryBody:
    'Reimporte o save para o planner ler todos os itens que você tem, não só o que está equipado.',
  gearPlanEmptyAllLeaveAloneTitle: 'Nada no escopo',
  gearPlanEmptyAllLeaveAloneBody:
    'Marque pelo menos um herói como Otimizar antes de rodar um plano.',
  gearPlanImportCta: 'Importar save',
  gearPlanOptimize: 'Montar plano do time',
  gearPlanOptimizeAria: 'Montar um plano do time com movimentações de itens e resets de pontos',
  gearPlanOptimizing: 'Montando plano…',
  gearPlanOptimizingTitle: 'Montando plano…',
  gearPlanOptimizingBody:
    'Procurando a melhor combinação de itens e resets de pontos entre os heróis marcados como Otimizar.',
  gearPlanOptimizingElapsed: 'Decorrido {time}',
  gearPlanOptimizingCancel: 'Cancelar',
  gearPlanOptimizingProgressAria: 'Montando plano do time',
  gearPlanSetupSectionTitle: 'Configurar busca',
  gearPlanSetupSectionBody:
    'Monta um plano de movimentações de itens, forjas e resets de pontos para os heróis marcados como Otimizar — pontuado pelo DPS de roster combinado.',
  gearPlanRunSummaryTitle: 'Resumo da busca',
  gearPlanRunSummaryFieldStatus: 'Situação do campo',
  gearPlanRunSummaryDuty: 'Carga de batalha',
  gearPlanRunSummaryDutyValue: '{duty} de {slots} slots',
  gearPlanRunSummaryDutyHint:
    'Quanto seus heróis Otimizar pedem do campo em relação a quantos podem lutar ao mesmo tempo.',
  gearPlanRunSummaryRegimeHintUnder:
    'Seus heróis Otimizar não estão competindo por slots de batalha — cada um mantém a fatia cheia de tempo em campo.',
  gearPlanRunSummaryRegimeHintSaturated:
    'Há mais demanda de campo do que slots de batalha — o DPS do roster é dividido entre quem pode lutar ao mesmo tempo.',
  gearPlanBudgetExhausted:
    'A busca parou cedo para não demorar demais — o ganho mostrado é o melhor encontrado até aqui, sem prometer que não exista algo melhor.',
  gearPlanMainThreadFallback:
    'Esta busca rodou na página principal porque o worker em segundo plano não estava disponível — a página pode ter travado um instante.',
  gearPlanForgeFloorLabel: 'Forja mínima (+)',
  gearPlanForgeFloorAria: 'Nível mínimo de forja assumido para cada item no pool',
  gearPlanForgeFloorHint:
    'Cada item conta como se estivesse forjado pelo menos até este nível. Itens mais baixos aparecem como tarefas de forja em cada herói.',
  gearPlanScopeSectionTitle: 'Escopo por herói',
  gearPlanScopeOptimize: 'Otimizar',
  gearPlanScopeDonate: 'Doar',
  gearPlanScopeLeaveAlone: 'Não mexer',
  gearPlanScopeOptimizeTip:
    'Entram no plano. Podem receber itens melhores e também cedê-los.',
  gearPlanScopeDonateTip:
    'Não entram no plano. Os itens vão para o pool e eles não recebem nada de volta.',
  gearPlanScopeLeaveAloneTip:
    'Congelados. Os itens ficam onde estão e a busca ignora o herói.',
  gearPlanScopeBoardTip:
    'Arraste os cards entre as colunas. Em telas pequenas, use o menu em cada card. Heróis com batalha desativada começam em Doar por padrão.',
  gearPlanScopeColumnEmpty: 'Solte heróis aqui',
  gearPlanScopeDragHandleAria: 'Arrastar para mudar o escopo',
  gearPlanScopeNothingInScope: 'Nada no escopo — marque pelo menos um herói como Otimizar.',
  gearPlanHeroRowLabel: '{name} · Lv {level} · #{id}',
  gearPlanResultsSectionTitle: 'Resultados do plano',
  gearPlanResultsSectionAria: 'Resultados do plano do time',
  gearPlanTotalGainLabel: 'Ganho total',
  gearPlanTotalGainValue: '{delta} dps ({pct}%)',
  gearPlanWaterfallTitle: 'Decomposição do ganho',
  gearPlanResultsHeader: 'Melhor DPS de roster encontrado por esta busca',
  gearPlanStepToday: 'Hoje',
  gearPlanStepGear: 'Itens',
  gearPlanStepForged: 'Forjar até o mínimo',
  gearPlanStepMoved: 'Movimentos',
  gearPlanStepRespec: 'Resetar pontos',
  gearPlanRunMetaFooter:
    'Levou <em>{seconds}</em>s · <em>{rounds}</em> passagens de busca · <em>{evals}</em> builds testadas · {seed}',
  gearPlanRunSeedCurrent: 'começou pelos itens de hoje',
  gearPlanRunSeedGreedyHeroDps: 'começou pelos heróis mais fortes',
  gearPlanRunSeedGreedySlotValue: 'começou pelas melhores peças por slot',
  gearPlanRunSeedBestItemFirst: 'começou pelos melhores itens',
  gearPlanRunSeedFallback: 'começou por uma montagem alternativa',
  gearPlanHeroDeltaTitle: 'Mudanças por herói',
  gearPlanHeroDeltaNote:
    'Estes são status de combate, não o painel do herói no jogo — as auras de time são aplicadas e os valores não seguem os tetos de exibição do jogo (100% de chance de crítico, 80% de redução de recarga). É proposital: essa visão sem teto e com auras é o que permite a esta busca achar o melhor DPS real.',
  gearPlanColBefore: 'Antes',
  gearPlanColAfter: 'Depois',
  gearPlanColDelta: 'Δ',
  gearPlanHeroDeltaExpandAria: 'Detalhamento de {name}',
  gearPlanHeroBreakdownStatsTitle: 'Mudança de status',
  gearPlanHeroBreakdownGearTitle: 'Itens propostos',
  gearPlanHeroBreakdownGearEmpty: 'Nenhum item proposto para este herói.',
  gearPlanHeroBreakdownPointsTitle: 'Reset de pontos',
  gearPlanHeroBreakdownPointsEmpty: 'Nenhum reset de pontos é recomendado para este herói.',
  gearPlanFlowLocationInventory: 'Inventário',
  gearPlanFlowRowFromLabel: 'De',
  gearPlanFlowRowExisting: 'Item atual — sem mudança',
  gearPlanFlowRowForge: 'Forjar de +{from} para +{to}',
  gearPlanGearDipNote:
    'Temporariamente atrás em {delta} dps — o passo Resetar pontos leva além de hoje.',
  gearPlanDisclosuresTitle: 'Premissas e limites',
  gearPlanSaturationCallout:
    'Seu campo está lotado (carga de batalha {duty} vs {slots} slots). O DPS do roster é dividido entre quem pode lutar ao mesmo tempo — só orientação; esta página não banca nem doa heróis por você.',
  gearPlanAuraDisclosure:
    'Auras de time aqui vêm do roster no escopo, excluem o herói pontuado e são ponderadas pelo duty de cada portador. Os buffs manuais da aba Conta são ignorados nesta página, mas ainda movem o DPS do Planner.',
  gearPlanPlannerDivergence:
    'O DPS do Planner pode divergir quando auras derivadas do roster substituem buffs manuais, ou quando {ability} é modelada só aqui.',
  gearPlanUnmodelledAbilities: 'Habilidades não modeladas no escopo: {list}',
  gearPlanLoadoutDrift:
    'O loadout salvo difere do inventário para: {heroes}. Esta página usa o inventário como verdade.',
  gearPlanExcludedItems:
    'Fora do pool — bloqueados no mercado: {market}, itens sem definição: {unresolved}, donos fora do roster: {foreign}.',
  gearPlanForgeSkippedNote:
    'A forja até o seu mínimo ficou de fora deste plano — ela não melhorou o DPS do roster.',
  gearPlanStaleNotice:
    'Os inputs mudaram desde este plano — rode Montar plano do time de novo para atualizar.',
  gearPlanBlockedTitle: 'Não foi possível rodar — falta roll de nascimento',
  gearPlanBlockedBody:
    'Reexporte o save para estes heróis incluírem o roll de nascimento: {heroes}.',
  gearPlanErrorTitle: 'A busca falhou',
  gearPlanRetry: 'Tentar de novo',
  gearPlanRegimeUnderSaturated: 'Cabe no campo',
  gearPlanRegimeSaturated: 'Campo lotado',
};
