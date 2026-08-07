export const en = {
  navGearPlan: 'Gear plan',
  gearPlanPageLandmark: 'Roster gear plan',
  gearPlanPageTitle: 'Roster gear plan',
  gearPlanEmptyNoRosterTitle: 'Import heroes first',
  gearPlanEmptyNoRosterBody:
    'Export your save in Bomb Farm, then use Import in the top bar to load your roster and item inventory.',
  gearPlanEmptyNoInventoryTitle: 'No item inventory yet',
  gearPlanEmptyNoInventoryBody:
    'Re-import your save so the planner can read every gear item you own, not only what is equipped.',
  gearPlanEmptyAllLeaveAloneTitle: 'Nothing in scope',
  gearPlanEmptyAllLeaveAloneBody:
    'Set at least one hero to Optimize before running a plan.',
  gearPlanImportCta: 'Import save',
  gearPlanOptimize: 'Optimize',
  gearPlanOptimizeAria: 'Run the roster gear search',
  gearPlanOptimizing: 'Searching…',
  gearPlanRunSummaryRegime: 'Regime',
  gearPlanRunSummaryDuty: 'Σ duty vs slots',
  gearPlanRunSummaryRounds: 'Rounds',
  gearPlanRunSummaryEvals: 'Evaluations',
  gearPlanRunSummaryElapsed: 'Elapsed',
  gearPlanBudgetExhausted:
    'Search stopped at the evaluation cap — the gain shown is the best found so far, not a guarantee of more headroom.',
  gearPlanMainThreadFallback:
    'This run executed on the main thread because the background worker was unavailable — the page may have frozen briefly.',
  gearPlanForgeFloorLabel: 'Forge floor',
  gearPlanForgeFloorAria: 'Minimum forge level assumed for every item in the pool',
  gearPlanForgeFloorHint: 'Items below this level appear in the forge list; scoring uses max(item, floor).',
  gearPlanScopeSectionTitle: 'Hero scope',
  gearPlanScopeOptimize: 'Optimize',
  gearPlanScopeDonate: 'Donate',
  gearPlanScopeLeaveAlone: 'Leave alone',
  gearPlanScopeOptimizeTip:
    'Scored in the plan. These heroes can receive better gear and may give gear up.',
  gearPlanScopeDonateTip:
    'Not scored. Their gear joins the pool for Optimize heroes; they receive nothing back.',
  gearPlanScopeLeaveAloneTip:
    'Frozen. Gear stays put and this hero is ignored by the search.',
  gearPlanScopeBoardTip:
    'Drag a card into a column — or use the menu on the card. Optimize at least one hero to run a plan.',
  gearPlanScopeColumnEmpty: 'Drop heroes here',
  gearPlanScopeDragHandleAria: 'Drag to change scope',
  gearPlanScopeDonateHint: 'Battle disabled — gear can be donated to the pool by default.',
  gearPlanScopeNothingInScope: 'Nothing in scope — set at least one hero to Optimize.',
  gearPlanHeroRowLabel: '{name} · L{level} · #{id}',
  gearPlanResultsSectionTitle: 'Plan results',
  gearPlanResultsSectionAria: 'Gear plan results',
  gearPlanTotalGainLabel: 'Total gain',
  gearPlanTotalGainValue: '{delta} dps ({pct}%)',
  gearPlanWaterfallTitle: 'Gain breakdown',
  gearPlanResultsHeader: 'Best roster DPS found by this search',
  gearPlanStepToday: 'Today',
  gearPlanStepForged: 'Forge to floor',
  gearPlanStepMoved: 'Moves',
  gearPlanStepRespec: 'Reset points',
  gearPlanRunMetaFooter:
    '{rounds} rounds · {evals} evaluations · {elapsed} ms · seed {seed}',
  gearPlanHeroDeltaTitle: 'Per-hero DPS',
  gearPlanColBefore: 'Before',
  gearPlanColAfter: 'After',
  gearPlanColDelta: 'Δ',
  gearPlanForgeListTitle: 'Forge list',
  gearPlanForgeListEmpty: 'Nothing to forge at this floor.',
  gearPlanForgeListRow: '{defId} · +{from} → +{to}',
  gearPlanMoveListTitle: 'Move list',
  gearPlanMoveListEmpty: 'No gear moves proposed.',
  gearPlanMoveUnequipGroup: 'Unequip first',
  gearPlanMoveEquipGroup: 'Then equip',
  gearPlanMoveRowUnequip: 'Unequip {defId} from {hero}',
  gearPlanMoveRowEquip: 'Equip {defId} on {hero} ({slot})',
  gearPlanPointResetTitle: 'Point resets (step 4 only)',
  gearPlanPointResetEmpty: 'No point reset buys extra DPS on the final build.',
  gearPlanPointResetRow: '{hero} · ~{gain}% from a reset',
  gearPlanDisclosuresTitle: 'Assumptions & limits',
  gearPlanSaturationCallout:
    'Field slots are saturated (Σ duty {duty} ≥ {slots} slots). Throughput uses the fair-share active-DPS regime — advice only; this page will not bench or donate heroes for you.',
  gearPlanAuraDisclosure:
    'Team auras here come from the scoped roster, exclude the hero being scored, and are weighted by each carrier’s duty. The Account tab’s manual Team buffs are ignored on this page but still drive the Planner’s own DPS.',
  gearPlanPlannerDivergence:
    'Planner DPS can differ from this page when roster-derived auras replace manual Team buffs, or when Passagem de Bastão is modelled here only.',
  gearPlanUnmodelledAbilities: 'Unmodelled abilities in scope: {list}',
  gearPlanLoadoutDrift:
    'Stored loadout differs from the inventory snapshot for: {heroes}. This page treats the inventory as authoritative.',
  gearPlanExcludedItems:
    'Excluded from the pool — market-blocked: {market}, unresolved items: {unresolved}, foreign owners: {foreign}.',
  gearPlanStaleNotice: 'Inputs changed since this plan was computed — re-run Optimize to refresh.',
  gearPlanBlockedTitle: 'Cannot run — missing birth stats',
  gearPlanBlockedBody:
    'Re-export your save so these heroes include a birth roll: {heroes}.',
  gearPlanErrorTitle: 'Search failed',
  gearPlanRetry: 'Try again',
  gearPlanRegimeUnderSaturated: 'Under-saturated',
  gearPlanRegimeSaturated: 'Saturated',
  gearPlanSendToAlt: 'Send to alt loadout',
  gearPlanSendConfirmTitle: 'Overwrite alt loadouts?',
  gearPlanSendConfirmBody:
    'This writes the proposed gear to each hero’s alt loadout only — nothing else on the roster changes.',
  gearPlanSendConfirmCount: 'Update {count} hero(es)',
  gearPlanSendDone: 'Alt loadouts updated for {count} hero(es).',
  gearPlanCurrentDps: 'Current roster DPS',
  gearPlanPlanDps: 'Planned roster DPS',
};

export const pt: typeof en = {
  navGearPlan: 'Plano de gear',
  gearPlanPageLandmark: 'Plano de gear do roster',
  gearPlanPageTitle: 'Plano de gear do roster',
  gearPlanEmptyNoRosterTitle: 'Importe heróis primeiro',
  gearPlanEmptyNoRosterBody:
    'Exporte o save no Bomb Farm e use Importar na barra superior para carregar o roster e o inventário de itens.',
  gearPlanEmptyNoInventoryTitle: 'Sem inventário de itens',
  gearPlanEmptyNoInventoryBody:
    'Reimporte o save para o planner ler todos os itens de gear que você tem, não só o que está equipado.',
  gearPlanEmptyAllLeaveAloneTitle: 'Nada no escopo',
  gearPlanEmptyAllLeaveAloneBody:
    'Marque pelo menos um herói como Otimizar antes de rodar um plano.',
  gearPlanImportCta: 'Importar save',
  gearPlanOptimize: 'Otimizar',
  gearPlanOptimizeAria: 'Rodar a busca de gear do roster',
  gearPlanOptimizing: 'Buscando…',
  gearPlanRunSummaryRegime: 'Regime',
  gearPlanRunSummaryDuty: 'Σ duty vs slots',
  gearPlanRunSummaryRounds: 'Rodadas',
  gearPlanRunSummaryEvals: 'Avaliações',
  gearPlanRunSummaryElapsed: 'Tempo',
  gearPlanBudgetExhausted:
    'A busca parou no limite de avaliações — o ganho mostrado é o melhor encontrado até aqui, sem garantia de margem extra.',
  gearPlanMainThreadFallback:
    'Esta rodada rodou na thread principal porque o worker em segundo plano não estava disponível — a página pode ter travado um instante.',
  gearPlanForgeFloorLabel: 'Piso de forja',
  gearPlanForgeFloorAria: 'Nível mínimo de forja assumido para cada item no pool',
  gearPlanForgeFloorHint:
    'Itens abaixo deste nível entram na lista de forja; a pontuação usa max(item, piso).',
  gearPlanScopeSectionTitle: 'Escopo por herói',
  gearPlanScopeOptimize: 'Otimizar',
  gearPlanScopeDonate: 'Doar',
  gearPlanScopeLeaveAlone: 'Não mexer',
  gearPlanScopeOptimizeTip:
    'Entram no plano. Podem receber gear melhor e também ceder peças.',
  gearPlanScopeDonateTip:
    'Não pontuam. O gear vai para o pool dos Otimizar; eles não recebem nada de volta.',
  gearPlanScopeLeaveAloneTip:
    'Congelados. O gear fica onde está e a busca ignora o herói.',
  gearPlanScopeBoardTip:
    'Arraste o card para uma coluna — ou use o menu no card. Deixe pelo menos um herói em Otimizar.',
  gearPlanScopeColumnEmpty: 'Solte heróis aqui',
  gearPlanScopeDragHandleAria: 'Arrastar para mudar o escopo',
  gearPlanScopeDonateHint: 'Batalha desativada — o gear pode ir para o pool por padrão.',
  gearPlanScopeNothingInScope: 'Nada no escopo — marque pelo menos um herói como Otimizar.',
  gearPlanHeroRowLabel: '{name} · Nv{level} · #{id}',
  gearPlanResultsSectionTitle: 'Resultados do plano',
  gearPlanResultsSectionAria: 'Resultados do plano de gear',
  gearPlanTotalGainLabel: 'Ganho total',
  gearPlanTotalGainValue: '{delta} dps ({pct}%)',
  gearPlanWaterfallTitle: 'Decomposição do ganho',
  gearPlanResultsHeader: 'Melhor DPS de roster encontrado por esta busca',
  gearPlanStepToday: 'Hoje',
  gearPlanStepForged: 'Forjar até o piso',
  gearPlanStepMoved: 'Movimentos',
  gearPlanStepRespec: 'Resetar pontos',
  gearPlanRunMetaFooter:
    '{rounds} rodadas · {evals} avaliações · {elapsed} ms · seed {seed}',
  gearPlanHeroDeltaTitle: 'DPS por herói',
  gearPlanColBefore: 'Antes',
  gearPlanColAfter: 'Depois',
  gearPlanColDelta: 'Δ',
  gearPlanForgeListTitle: 'Lista de forja',
  gearPlanForgeListEmpty: 'Nada para forjar neste piso.',
  gearPlanForgeListRow: '{defId} · +{from} → +{to}',
  gearPlanMoveListTitle: 'Lista de movimentos',
  gearPlanMoveListEmpty: 'Nenhuma troca de gear proposta.',
  gearPlanMoveUnequipGroup: 'Desequipar primeiro',
  gearPlanMoveEquipGroup: 'Depois equipar',
  gearPlanMoveRowUnequip: 'Desequipar {defId} de {hero}',
  gearPlanMoveRowEquip: 'Equipar {defId} em {hero} ({slot})',
  gearPlanPointResetTitle: 'Reset de pontos (só passo 4)',
  gearPlanPointResetEmpty: 'Nenhum reset de pontos compra DPS extra na build final.',
  gearPlanPointResetRow: '{hero} · ~{gain}% com reset',
  gearPlanDisclosuresTitle: 'Premissas e limites',
  gearPlanSaturationCallout:
    'Os slots de campo estão saturados (Σ duty {duty} ≥ {slots} slots). A vazão usa o regime de DPS ativo em fatia justa — só orientação; esta página não banca nem doa heróis por você.',
  gearPlanAuraDisclosure:
    'Auras de time aqui vêm do roster no escopo, excluem o herói pontuado e são ponderadas pelo duty de cada portador. Os buffs manuais da aba Conta são ignorados nesta página, mas ainda movem o DPS do Planner.',
  gearPlanPlannerDivergence:
    'O DPS do Planner pode divergir quando auras derivadas do roster substituem buffs manuais, ou quando Passagem de Bastão é modelada só aqui.',
  gearPlanUnmodelledAbilities: 'Habilidades não modeladas no escopo: {list}',
  gearPlanLoadoutDrift:
    'O loadout salvo difere do inventário para: {heroes}. Esta página usa o inventário como verdade.',
  gearPlanExcludedItems:
    'Fora do pool — bloqueados no mercado: {market}, itens sem definição: {unresolved}, donos fora do roster: {foreign}.',
  gearPlanStaleNotice:
    'Os inputs mudaram desde este plano — rode Otimizar de novo para atualizar.',
  gearPlanBlockedTitle: 'Não foi possível rodar — falta roll de nascimento',
  gearPlanBlockedBody:
    'Reexporte o save para estes heróis incluírem o roll de nascimento: {heroes}.',
  gearPlanErrorTitle: 'A busca falhou',
  gearPlanRetry: 'Tentar de novo',
  gearPlanRegimeUnderSaturated: 'Sub-saturado',
  gearPlanRegimeSaturated: 'Saturado',
  gearPlanSendToAlt: 'Enviar para alt loadout',
  gearPlanSendConfirmTitle: 'Sobrescrever alt loadouts?',
  gearPlanSendConfirmBody:
    'Isso grava o gear proposto só no alt loadout de cada herói — nada mais no roster muda.',
  gearPlanSendConfirmCount: 'Atualizar {count} herói(s)',
  gearPlanSendDone: 'Alt loadouts atualizados para {count} herói(s).',
  gearPlanCurrentDps: 'DPS atual do roster',
  gearPlanPlanDps: 'DPS planejado do roster',
};
