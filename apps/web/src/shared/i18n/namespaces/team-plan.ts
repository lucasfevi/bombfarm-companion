export const en = {
  navOptimizer: 'Optimizer',
  teamPlanPageLandmark: 'Optimizer',
  teamPlanPageTitle: 'Optimizer',
  teamPlanEmptyNoRosterTitle: 'Import heroes first',
  teamPlanEmptyNoRosterBody:
    'Export your save in Bomb Farm, then use Import in the top bar to load your roster and item inventory.',
  teamPlanEmptyNoInventoryTitle: 'No item inventory yet',
  teamPlanEmptyNoInventoryBody:
    'Re-import your save so the planner can read every item you own, not only what is equipped.',
  teamPlanEmptyAllLeaveAloneTitle: 'Nothing in scope',
  teamPlanEmptyAllLeaveAloneBody:
    'Set at least one hero to Optimize before running a plan.',
  teamPlanImportCta: 'Import save',
  teamPlanOptimize: 'Build team plan',
  teamPlanOptimizeAria: 'Build a team plan of gear moves and point resets',
  teamPlanOptimizing: 'Building plan…',
  teamPlanOptimizingTitle: 'Building plan…',
  teamPlanOptimizingBody:
    'Looking for the best mix of gear and point resets across the heroes you set to Optimize.',
  teamPlanOptimizingElapsed: 'Elapsed {time}',
  teamPlanOptimizingCancel: 'Cancel',
  teamPlanOptimizingProgressAria: 'Building team plan',
  teamPlanSetupSectionTitle: 'Search setup',
  teamPlanPhaseLabel: 'Plan for phase',
  teamPlanPhaseAria: 'Which phase this search plans for',
  teamPlanPhaseNone: 'None',
  /** Three examples, one per search route: a difficulty word, a phase the way the game writes it,
   *  a bare number. Cheaper to read than naming the routes, and the words are the search itself. */
  teamPlanPhaseSearchPlaceholder: 'Hard, Normal 2-1, or 151',
  teamPlanPhaseNoMatch: 'No phase matches that.',
  teamPlanPhaseMoreMatches: 'Showing {shown} of {matched} — keep typing to narrow.',
  teamPlanPhaseHintNone:
    'No phase pinned. The search picks the best phase your squad can hold, and says which one it settled on.',
  teamPlanPhaseHintChosen:
    'Every figure below is scored at this phase, and nowhere else. Pinning one also makes the search much faster.',
  teamPlanPhaseBeyondMax:
    'Past the furthest phase your account has reached (#{max}) — this answers what the squad would earn if it could hold it.',
  teamPlanRunSummaryTitle: 'Search summary',
  teamPlanRunSummaryScoredPhase: 'Scored at',
  teamPlanScoredPhaseChosen: '{phase} — the phase you picked.',
  teamPlanScoredPhaseAccount: '{phase} — where your account is now.',
  teamPlanScoredPhaseSearched: '{phase} — picked automatically, the best this squad can hold.',
  teamPlanScoredPhaseUnreachable:
    '{phase} — this squad cannot clear it, so there is nothing for it to earn there.',
  teamPlanScoredPhaseNoneFeasible: 'No phase this squad can clear was found.',
  teamPlanRunSummaryFieldStatus: 'Field status',
  teamPlanRunSummaryDuty: 'Battle load',
  teamPlanRunSummaryDutyValue: '{duty} of {slots} slots',
  teamPlanRunSummaryDutyHint:
    'How hard your Optimize heroes pull on the field versus how many can fight at once.',
  teamPlanRunSummaryRegimeHintUnder:
    'Your Optimize heroes aren’t competing for battle slots — each keeps their full share of field time.',
  teamPlanBudgetExhausted:
    'Search stopped early to save time — the gain shown is the best found so far, not a promise that nothing better exists.',
  teamPlanMainThreadFallback:
    'This search ran on the main page because the background worker was unavailable — the page may have frozen briefly.',
  teamPlanForgeFloorLabel: 'Min forge (+)',
  teamPlanForgeFloorAria: 'Minimum forge level assumed for every item in the pool',
  teamPlanForgeFloorHint:
    'Every item is scored as if forged to at least this level. Anything lower shows up as a forge chore on that hero.',
  teamPlanAllowedChangesLabel: 'Allowed changes',
  teamPlanAllowedChangesAria: 'Which kinds of change this plan may propose',
  teamPlanAllowedChangesOptionBoth: 'Gear and points',
  teamPlanAllowedChangesOptionPoints: 'Points only',
  teamPlanAllowedChangesOptionGear: 'Gear only',
  teamPlanAllowedChangesHintBoth:
    'The plan may move gear, order forge work, and re-spend stat points.',
  teamPlanAllowedChangesHintPoints:
    'Stat points only. No gear moves and no forge work — the search never even prices them.',
  teamPlanAllowedChangesHintGear:
    'Gear only. No point resets, so no respec cost either.',
  teamPlanAllowedChangesNotePoints:
    'You limited this plan to stat points, so it proposes no gear moves and no forge work — the search never considered them, and a plan allowed to move gear could find more.',
  teamPlanAllowedChangesNoteGear:
    'You limited this plan to gear, so it proposes no point resets — the search never considered them, and a plan allowed to re-spend points could find more.',
  teamPlanScopeSectionTitle: 'Hero scope',
  teamPlanScopeOptimize: 'Optimize',
  teamPlanScopeDonate: 'Donate',
  teamPlanScopeLeaveAlone: 'Leave alone',
  teamPlanScopeOptimizeTip:
    'Scored in the plan. These heroes can receive better items and may give items up.',
  teamPlanScopeDonateTip:
    'Not scored. Their items join the pool for Optimize heroes; they receive nothing back.',
  teamPlanScopeLeaveAloneTip:
    'Frozen. Items stay put and this hero is ignored by the search.',
  teamPlanScopeBoardTip:
    'Drag hero cards between columns. On small screens, use the menu on each card. Battle-disabled heroes start in Donate by default.',
  teamPlanScopeColumnEmpty: 'Drop heroes here',
  teamPlanScopeDragHandleAria: 'Drag to change scope',
  teamPlanScopeNothingInScope: 'Nothing in scope — set at least one hero to Optimize.',
  teamPlanHeroRowLabel: '{name} · Lv {level} · #{id}',
  teamPlanResultsSectionTitle: 'Plan results',
  teamPlanResultsSectionAria: 'Team plan results',
  teamPlanTotalGainLabel: 'Total gain',
  teamPlanWaterfallTitle: 'Gain breakdown',
  teamPlanStepToday: 'Today',
  teamPlanStepGear: 'Gear',
  teamPlanStepForged: 'Forge to minimum',
  teamPlanStepMoved: 'Moves',
  teamPlanStepRespec: 'Reset points',
  teamPlanRunMetaFooter:
    'Took <em>{seconds}</em>s · <em>{rounds}</em> search passes · <em>{evals}</em> builds checked · {seed}',
  teamPlanRunSeedCurrent: "started from today's items",
  teamPlanRunSeedGreedyHeroDps: 'started with strongest heroes first',
  teamPlanRunSeedGreedySlotValue: 'started with best pieces per slot',
  teamPlanRunSeedBestItemFirst: 'started with the best items first',
  teamPlanRunSeedFallback: 'started from an alternate setup',
  teamPlanHeroDeltaTitle: 'Per-hero changes',
  teamPlanHeroDeltaNote:
    'The before/after totals above are combat-effective — team auras are applied and aren’t clamped to the game’s display caps (100% crit chance, 80% cooldown reduction); that’s deliberate, since this uncapped, aura-inclusive view is what the search actually optimizes against. Below, Hero sheet mirrors what the game’s own panel shows (capped); Combat stats keeps that same uncapped view.',
  teamPlanColBefore: 'Before',
  teamPlanColAfter: 'After',
  teamPlanColDelta: 'Δ',
  teamPlanHeroDeltaExpandAria: 'Detailed breakdown for {name}',
  teamPlanHeroBreakdownStatsTitle: 'Stat breakdown',
  teamPlanHeroBreakdownStatsSheetTitle: 'Hero sheet',
  teamPlanHeroBreakdownStatsCombatTitle: 'Combat stats',
  teamPlanHeroBreakdownHitTitle: 'Hit damage',
  teamPlanHeroHitNormal: 'Normal hit',
  teamPlanHeroHitCritical: 'Critical hit',
  teamPlanHeroBreakdownGearTitle: 'Proposed items',
  teamPlanHeroBreakdownGearEmpty: 'No proposed items for this hero.',
  teamPlanHeroBreakdownPointsTitle: 'Point reset',
  teamPlanHeroBreakdownPointsEmpty: 'No point reset is recommended for this hero.',
  teamPlanFlowLocationInventory: 'Inventory',
  teamPlanFlowRowFromLabel: 'From',
  teamPlanFlowRowExisting: 'Existing item — no change',
  teamPlanFlowRowForge: 'Forge from +{from} to +{to}',
  teamPlanDisclosuresTitle: 'Assumptions & limits',
  teamPlanUnmodelledAbilities: 'Unmodelled abilities in scope: {list}',
  teamPlanLoadoutDrift:
    'Stored loadout differs from the inventory snapshot for: {heroes}. This page treats the inventory as authoritative.',
  teamPlanExcludedItems:
    'Excluded from the pool — market-blocked: {market}, unresolved items: {unresolved}, foreign owners: {foreign}.',
  teamPlanStaleNotice:
    'Inputs changed since this plan was computed — run Build team plan again to refresh.',
  teamPlanBlockedTitle: 'Cannot run — missing birth stats',
  teamPlanBlockedBody:
    'Re-export your save so these heroes include a birth roll: {heroes}.',
  teamPlanErrorTitle: 'Search failed',
  teamPlanRetry: 'Try again',
  teamPlanRegimeUnderSaturated: 'Fits the field',
  teamPlanRegimeSaturated: 'Field is full',
};

export const pt: typeof en = {
  navOptimizer: 'Otimizador',
  teamPlanPageLandmark: 'Otimizador',
  teamPlanPageTitle: 'Otimizador',
  teamPlanEmptyNoRosterTitle: 'Importe heróis primeiro',
  teamPlanEmptyNoRosterBody:
    'Exporte o save no Bomb Farm e use Importar na barra superior para carregar o roster e o inventário de itens.',
  teamPlanEmptyNoInventoryTitle: 'Sem inventário de itens',
  teamPlanEmptyNoInventoryBody:
    'Reimporte o save para o planner ler todos os itens que você tem, não só o que está equipado.',
  teamPlanEmptyAllLeaveAloneTitle: 'Nada no escopo',
  teamPlanEmptyAllLeaveAloneBody:
    'Marque pelo menos um herói como Otimizar antes de rodar um plano.',
  teamPlanImportCta: 'Importar save',
  teamPlanOptimize: 'Montar plano do time',
  teamPlanOptimizeAria: 'Montar um plano do time com movimentações de itens e resets de pontos',
  teamPlanOptimizing: 'Montando plano…',
  teamPlanOptimizingTitle: 'Montando plano…',
  teamPlanOptimizingBody:
    'Procurando a melhor combinação de itens e resets de pontos entre os heróis marcados como Otimizar.',
  teamPlanOptimizingElapsed: 'Decorrido {time}',
  teamPlanOptimizingCancel: 'Cancelar',
  teamPlanOptimizingProgressAria: 'Montando plano do time',
  teamPlanSetupSectionTitle: 'Configurar busca',
  teamPlanPhaseLabel: 'Planejar para a fase',
  teamPlanPhaseAria: 'Para qual fase esta busca planeja',
  teamPlanPhaseNone: 'Nenhuma',
  teamPlanPhaseSearchPlaceholder: 'Difícil, Normal 2-1 ou 151',
  teamPlanPhaseNoMatch: 'Nenhuma fase corresponde.',
  teamPlanPhaseMoreMatches: 'Mostrando {shown} de {matched} — continue digitando para filtrar.',
  teamPlanPhaseHintNone:
    'Nenhuma fase fixada. A busca escolhe a melhor fase que seu esquadrão consegue sustentar, e informa qual foi.',
  teamPlanPhaseHintChosen:
    'Todos os números abaixo são calculados nesta fase, e em nenhuma outra. Fixar uma também deixa a busca muito mais rápida.',
  teamPlanPhaseBeyondMax:
    'Além da fase mais distante que sua conta alcançou (#{max}) — isto responde quanto o esquadrão renderia se conseguisse sustentá-la.',
  teamPlanRunSummaryTitle: 'Resumo da busca',
  teamPlanRunSummaryScoredPhase: 'Calculado na fase',
  teamPlanScoredPhaseChosen: '{phase} — a fase que você escolheu.',
  teamPlanScoredPhaseAccount: '{phase} — onde sua conta está agora.',
  teamPlanScoredPhaseSearched:
    '{phase} — escolhida automaticamente, a melhor que este esquadrão sustenta.',
  teamPlanScoredPhaseUnreachable:
    '{phase} — este esquadrão não consegue limpá-la, então não há nada a render nela.',
  teamPlanScoredPhaseNoneFeasible: 'Nenhuma fase que este esquadrão consiga limpar foi encontrada.',
  teamPlanRunSummaryFieldStatus: 'Situação do campo',
  teamPlanRunSummaryDuty: 'Carga de batalha',
  teamPlanRunSummaryDutyValue: '{duty} de {slots} slots',
  teamPlanRunSummaryDutyHint:
    'Quanto seus heróis Otimizar pedem do campo em relação a quantos podem lutar ao mesmo tempo.',
  teamPlanRunSummaryRegimeHintUnder:
    'Seus heróis Otimizar não estão competindo por slots de batalha — cada um mantém a fatia cheia de tempo em campo.',
  teamPlanBudgetExhausted:
    'A busca parou cedo para não demorar demais — o ganho mostrado é o melhor encontrado até aqui, sem prometer que não exista algo melhor.',
  teamPlanMainThreadFallback:
    'Esta busca rodou na página principal porque o worker em segundo plano não estava disponível — a página pode ter travado um instante.',
  teamPlanForgeFloorLabel: 'Forja mínima (+)',
  teamPlanForgeFloorAria: 'Nível mínimo de forja assumido para cada item no pool',
  teamPlanForgeFloorHint:
    'Cada item conta como se estivesse forjado pelo menos até este nível. Itens mais baixos aparecem como tarefas de forja em cada herói.',
  teamPlanAllowedChangesLabel: 'Mudanças permitidas',
  teamPlanAllowedChangesAria: 'Que tipos de mudança este plano pode propor',
  teamPlanAllowedChangesOptionBoth: 'Itens e pontos',
  teamPlanAllowedChangesOptionPoints: 'Só pontos',
  teamPlanAllowedChangesOptionGear: 'Só itens',
  teamPlanAllowedChangesHintBoth:
    'O plano pode movimentar itens, pedir forjas e redistribuir pontos.',
  teamPlanAllowedChangesHintPoints:
    'Só pontos. Sem movimentações de itens e sem forjas — a busca nem chega a avaliá-las.',
  teamPlanAllowedChangesHintGear:
    'Só itens. Sem resets de pontos, então também sem custo de respec.',
  teamPlanAllowedChangesNotePoints:
    'Você limitou este plano a pontos, então ele não propõe movimentações de itens nem forjas — a busca nunca as considerou, e um plano livre para mexer em itens poderia achar mais.',
  teamPlanAllowedChangesNoteGear:
    'Você limitou este plano a itens, então ele não propõe resets de pontos — a busca nunca os considerou, e um plano livre para redistribuir pontos poderia achar mais.',
  teamPlanScopeSectionTitle: 'Escopo por herói',
  teamPlanScopeOptimize: 'Otimizar',
  teamPlanScopeDonate: 'Doar',
  teamPlanScopeLeaveAlone: 'Não mexer',
  teamPlanScopeOptimizeTip:
    'Entram no plano. Podem receber itens melhores e também cedê-los.',
  teamPlanScopeDonateTip:
    'Não entram no plano. Os itens vão para o pool e eles não recebem nada de volta.',
  teamPlanScopeLeaveAloneTip:
    'Congelados. Os itens ficam onde estão e a busca ignora o herói.',
  teamPlanScopeBoardTip:
    'Arraste os cards entre as colunas. Em telas pequenas, use o menu em cada card. Heróis com batalha desativada começam em Doar por padrão.',
  teamPlanScopeColumnEmpty: 'Solte heróis aqui',
  teamPlanScopeDragHandleAria: 'Arrastar para mudar o escopo',
  teamPlanScopeNothingInScope: 'Nada no escopo — marque pelo menos um herói como Otimizar.',
  teamPlanHeroRowLabel: '{name} · Lv {level} · #{id}',
  teamPlanResultsSectionTitle: 'Resultados do plano',
  teamPlanResultsSectionAria: 'Resultados do plano do time',
  teamPlanTotalGainLabel: 'Ganho total',
  teamPlanWaterfallTitle: 'Decomposição do ganho',
  teamPlanStepToday: 'Hoje',
  teamPlanStepGear: 'Itens',
  teamPlanStepForged: 'Forjar até o mínimo',
  teamPlanStepMoved: 'Movimentos',
  teamPlanStepRespec: 'Resetar pontos',
  teamPlanRunMetaFooter:
    'Levou <em>{seconds}</em>s · <em>{rounds}</em> passagens de busca · <em>{evals}</em> builds testadas · {seed}',
  teamPlanRunSeedCurrent: 'começou pelos itens de hoje',
  teamPlanRunSeedGreedyHeroDps: 'começou pelos heróis mais fortes',
  teamPlanRunSeedGreedySlotValue: 'começou pelas melhores peças por slot',
  teamPlanRunSeedBestItemFirst: 'começou pelos melhores itens',
  teamPlanRunSeedFallback: 'começou por uma montagem alternativa',
  teamPlanHeroDeltaTitle: 'Mudanças por herói',
  teamPlanHeroDeltaNote:
    'Os totais antes/depois acima são de combate — as auras de time são aplicadas e não seguem os tetos de exibição do jogo (100% de chance de crítico, 80% de redução de recarga); é proposital, pois essa visão sem teto e com auras é o que a busca realmente otimiza. Abaixo, Ficha do herói reflete o que o painel do jogo mostra (com teto); Stats de combate mantém essa mesma visão sem teto.',
  teamPlanColBefore: 'Antes',
  teamPlanColAfter: 'Depois',
  teamPlanColDelta: 'Δ',
  teamPlanHeroDeltaExpandAria: 'Detalhamento de {name}',
  teamPlanHeroBreakdownStatsTitle: 'Mudança de status',
  teamPlanHeroBreakdownStatsSheetTitle: 'Ficha do herói',
  teamPlanHeroBreakdownStatsCombatTitle: 'Stats de combate',
  teamPlanHeroBreakdownHitTitle: 'Dano do hit',
  teamPlanHeroHitNormal: 'Hit normal',
  teamPlanHeroHitCritical: 'Hit crítico',
  teamPlanHeroBreakdownGearTitle: 'Itens propostos',
  teamPlanHeroBreakdownGearEmpty: 'Nenhum item proposto para este herói.',
  teamPlanHeroBreakdownPointsTitle: 'Reset de pontos',
  teamPlanHeroBreakdownPointsEmpty: 'Nenhum reset de pontos é recomendado para este herói.',
  teamPlanFlowLocationInventory: 'Inventário',
  teamPlanFlowRowFromLabel: 'De',
  teamPlanFlowRowExisting: 'Item atual — sem mudança',
  teamPlanFlowRowForge: 'Forjar de +{from} para +{to}',
  teamPlanDisclosuresTitle: 'Premissas e limites',
  teamPlanUnmodelledAbilities: 'Habilidades não modeladas no escopo: {list}',
  teamPlanLoadoutDrift:
    'O loadout salvo difere do inventário para: {heroes}. Esta página usa o inventário como verdade.',
  teamPlanExcludedItems:
    'Fora do pool — bloqueados no mercado: {market}, itens sem definição: {unresolved}, donos fora do roster: {foreign}.',
  teamPlanStaleNotice:
    'Os inputs mudaram desde este plano — rode Montar plano do time de novo para atualizar.',
  teamPlanBlockedTitle: 'Não foi possível rodar — falta roll de nascimento',
  teamPlanBlockedBody:
    'Reexporte o save para estes heróis incluírem o roll de nascimento: {heroes}.',
  teamPlanErrorTitle: 'A busca falhou',
  teamPlanRetry: 'Tentar de novo',
  teamPlanRegimeUnderSaturated: 'Cabe no campo',
  teamPlanRegimeSaturated: 'Campo lotado',
};
