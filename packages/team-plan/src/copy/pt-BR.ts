import type { TeamPlanPageCopy } from './index';

export const teamPlanPagePtBR: TeamPlanPageCopy = {
  navOptimizer: 'Otimizador',
  teamPlanPageLandmark: 'Otimizador',
  teamPlanPageTitle: 'Otimizador',
  teamPlanOptimize: 'Montar plano do time',
  teamPlanOptimizeAriaBoth:
    'Montar um plano do time com movimentações de itens e resets de pontos',
  teamPlanOptimizeAriaPoints: 'Montar um plano do time com resets de pontos',
  teamPlanOptimizeAriaGear: 'Montar um plano do time com movimentações de itens',
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
  teamPlanIgnoreCrowdingLabel: 'Manter todos equipados',
  teamPlanIgnoreCrowdingAria: 'Calcular como se o campo sempre tivesse vaga, e preencher todos os espaços vazios',
  teamPlanIgnoreCrowdingHintOff:
    'O campo comporta um número limitado de heróis, então um herói que fica mais tempo em campo tira espaço dos outros. O plano cobra por isso, e é por isso que ele pode pedir para tirar um item.',
  teamPlanIgnoreCrowdingHintOn:
    'Calculando como se o campo sempre tivesse vaga. Nenhum item piora a pontuação de um herói, e todo espaço vazio é preenchido se você tiver algo que sirva — mas os totais passam a descrever um campo em que ninguém fica na fila, então ficam acima do que o time realmente rende.',
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
  teamPlanStaleNotice:
    'Os inputs mudaram desde este plano — rode Montar plano do time de novo para atualizar.',
  teamPlanBlockedTitle: 'Não foi possível rodar — falta roll de nascimento',
  teamPlanErrorTitle: 'A busca falhou',
  teamPlanRetry: 'Tentar de novo',
  teamPlanRegimeUnderSaturated: 'Cabe no campo',
  teamPlanRegimeSaturated: 'Campo lotado',
};
