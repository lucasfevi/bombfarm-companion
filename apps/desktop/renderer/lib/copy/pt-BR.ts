/**
 * The Portuguese (Brazil) translation of `en.ts` (MP3 F4, `AD-050`). `Copy` is a value-widening
 * mapped type (`export type Copy = { readonly [K in keyof typeof en]: string }` — `index.ts`), so
 * this file is annotated `: Copy`, never `as Copy`/`satisfies Copy`/an index signature: the
 * annotation is what makes a missing key here a compile error naming the key (`TS2741`) and a
 * typo'd extra key a compile error too (`TS2353`) — both directions of MIN-03.
 *
 * Key set and every `{placeholder}` must match `en.ts` exactly — `parity.test.ts` proves both at
 * runtime as a second, independent line of defence (a future widening of `Copy` must not silently
 * disable the compile-time proof). Natural PT-BR at the concept level, not word-for-word English
 * calques (`docs/i18n.md`, "Portuguese chrome quality"); no invented aliases for official in-game
 * names (those come from `@bombfarm/domain/game-labels`, `AD-056` — this file carries none).
 */
import type { Copy } from './index';

export const ptBR: Copy = {
  // shell* — AppShell navigation and status chrome
  shellPlanningNavLabel: 'Planejamento',
  shellStatusConnected: 'Conectado',
  shellStatusNotRunning: 'O jogo não está aberto',
  shellStatusStale: 'Desatualizado',
  shellLoadingLabel: 'Carregando…',

  // empty* — placeholder states shown before real data has arrived
  emptyBridgeUnavailableTitle: 'Ponte de comunicação indisponível',

  // Account section names, in player language — never the raw section key
  sectionNameAccount: 'sua fase da fazenda',
  sectionNameHeroes: 'seus heróis',
  sectionNameSkills: 'sua árvore de habilidades',
  sectionNameCasa: 'sua casa',
  sectionNameItems: 'seu equipamento',

  // planning* — the Planning screen
  planningRosterColumnAvatar: 'Avatar',
  planningRosterColumnName: 'Herói',
  planningRosterColumnLevel: 'Nível',
  planningRosterColumnStars: 'Estrelas',
  planningRosterColumnRarity: 'Raridade',
  planningSelectHeroPrompt: 'Selecione um herói na lista para ver a recomendação de próximo ponto.',
  planningNoRosterTitle: 'Nenhum herói disponível para planejar ainda',
  planningNoRosterDescription: 'Não foi possível ler uma lista de heróis utilizável na sua conta.',
  planningNothingPersistedTitle: 'Nada salvo ainda',
  planningNothingPersistedDescription:
    'Abra o jogo com o companion em execução uma vez, para que ele possa lembrar da sua conta.',
  planningRejectedTitleMissingBirthStats: 'Seu save está sem dados de herói que o app precisa',
  planningRejectedDescriptionMissingBirthStats:
    'Estes heróis não puderam ser lidos de uma versão recente o bastante do jogo:',
  planningRejectedTitleNotASaveFile: 'Isso não parece ser um dado de conta',
  planningStoreUnavailableNotice: 'Nada será lembrado depois que o app fechar.',
  planningGearSummaryLabel: 'Equipamento equipado',

  // fidelity* — provenance / degradation display
  fidelityNoticeTitle: 'Parte da sua conta não está totalmente atualizada',
  fidelityMissingKeysLabel: 'Campos que o jogo não enviou',
  fidelityStatusResolved: 'lido agora mesmo',
  fidelityStatusStale: 'lembrado da sua última sessão',
  fidelityStatusMissing: 'não disponível',
  fidelityStatusDegraded: 'enviado em um formato que esta versão ainda não entende',

  // advice* — next-point ranking, DPS, reset advice
  adviceNextPointTitle: 'Ranking de próximo ponto',
  adviceNextPointStatColumn: 'Atributo',
  adviceNextPointGainColumn: 'Ganho',
  adviceDpsLabel: 'DPS solo',
  adviceResetAdviceRecommended: 'Um reset de atributos parece valer a pena para este herói.',
  adviceResetAdviceNotRecommended: 'Nenhum reset de atributos necessário no momento.',

  // Stat names, in player language
  statNameEnergy: 'Energia',
  statNameAttack: 'Ataque',
  statNameCritDmg: 'Dano crítico',
  statNameSpeed: 'Velocidade',
  statNameCritChance: 'Chance de crítico',
  statNamePenetration: 'Penetração',
  statNameCdr: 'Redução de recarga',
  planningLoadingTitle: 'Carregando sua conta…',

  // withheld* — the always-mounted notice slot for a withheld quantity
  withheldRosterRowTitle: 'Lista de heróis retida',
  withheldGearSummaryTitle: 'Resumo de equipamento retido',
  withheldDpsTitle: 'DPS retido',
  withheldNextPointRankingTitle: 'Ranking de próximo ponto retido',
  withheldResetAdviceTitle: 'Recomendação de reset retida',
  withheldBecause: 'Aguardando {sections}.',

  // error* — failure paths
  errorAccountReadFailed: 'Não foi possível ler a conta',

  // store.reason, in player language (AccountStoreReason, exhaustively mapped)
  storeReasonEmpty: 'nada foi salvo ainda',
  storeReasonSchemaTooNew: 'uma versão mais nova do companion salvou isso, e esta versão não consegue ler',
  storeReasonCorruptRebuilt: 'a cópia salva estava ilegível e precisou ser reconstruída',
  storeReasonNotWritable: 'o local de salvamento não pode ser gravado',
  storeReasonNoSqliteBinding: 'esta versão não consegue salvar neste sistema',
  storeReasonAccountMismatch: 'uma conta diferente está em execução no momento',

  // age* — relative-age words for format.ts. Singular/plural-agnostic by construction, matching
  // en.ts's own constraint (design §7 rule 3) — 'há {n}m' reads naturally for every n.
  ageJustNow: 'agora mesmo',
  ageMinutes: 'há {n}m',
  ageHours: 'há {n}h',
  ageDays: 'há {n}d',
  // 's' for seconds is the same abbreviation in PT-BR as in English — a legitimately identical
  // pair, declared in index.ts's IDENTICAL_IN_BOTH_LANGUAGES table rather than left to look like
  // an untranslated leftover (MIN-04).
  ageShortSeconds: '{n}s',
  ageShortMinutes: '{n}min',

  // settings* — the language control
  settingsNavLabel: 'Configurações',
  settingsLanguageSectionTitle: 'Idioma',
  settingsLanguageLabel: 'Idioma do aplicativo',
  settingsLanguageHelp: 'As mudanças têm efeito imediato.',
  settingsLanguageOptionEnglish: 'Inglês',
  settingsLanguageOptionPortuguese: 'Português (Brasil)',
  settingsLanguageNotSavedTitle: 'Idioma alterado, mas não salvo',
  settingsLanguageReasonNoStore:
    'Seu local de salvamento está indisponível, então isso não vai sobreviver a um reinício.',
  settingsLanguageReasonNotWritable:
    'Seu local de salvamento não pode ser gravado, então isso não vai sobreviver a um reinício.',
  settingsLanguageReasonUnknown: 'Essa escolha não pôde ser salva, então não vai sobreviver a um reinício.',

  // settingsConsent* — o controle de revogar o acesso à conta (Configurações só é alcançável já permitido)
  settingsConsentSectionTitle: 'Acesso à conta',
  settingsConsentStatusGranted: 'Acesso: permitido',
  settingsConsentHelpGranted: 'O companion lê sua conta e permanece conectado ao cliente do jogo.',
  settingsConsentRevokeAction: 'Desativar',

  // settingsDiagnostics* — o controle manual de gravação do anel de quadros (um recurso de relatório de erro)
  settingsDiagnosticsSectionTitle: 'Diagnóstico',
  settingsDiagnosticsSaveLabel: 'Salvar arquivo para relatório de erro',
  settingsDiagnosticsSaveHelp:
    'Grava um arquivo local com detalhes do tráfego recente do jogo. Nada é enviado a lugar nenhum — você decide se e quando compartilhar.',
  settingsDiagnosticsSaveAction: 'Salvar arquivo',
  settingsDiagnosticsSavedTitle: 'Arquivo salvo',
  settingsDiagnosticsSavedBody: 'Arquivo de diagnóstico salvo em {path}.',
  settingsDiagnosticsNotSavedTitle: 'Nada foi salvo',
  settingsDiagnosticsReasonRateLimited: 'Você acabou de salvar um. Espere alguns segundos e tente de novo.',
  settingsDiagnosticsReasonWriteFailed: 'Não foi possível gravar o arquivo. Verifique o local de salvamento e tente de novo.',
  settingsDiagnosticsReasonNoSource: 'Ainda não há nada para salvar. O app ainda não se conectou ao jogo.',

  // consentGate* — o portão de permissão mostrado no lugar do conteúdo do app quando o acesso não é permitido
  consentGateTitle: 'Este app precisa da sua permissão para funcionar',
  consentGateBody:
    'Desculpe — o companion não tem nada a mostrar sem acesso à sua conta. Ele lê sua conta e se conecta ao programa do jogo em execução, e não fará nenhuma das duas coisas até que você permita.',
  consentGateReadAgainAction: 'Ler o aviso novamente',
  consentGateLanguageLabel: 'Idioma',

  // error* — MP3 F4 §2.8
  errorAccountReadFailedDescription: 'Tente novamente depois que o jogo terminar de carregar, ou reinicie o app.',

  // live* — a tela Ao Vivo: rótulo de navegação e a linha de status de atualização no topo do painel
  liveNavLabel: 'Ao vivo',
  liveStatusLiveLabel: 'Transmitindo ao vivo do jogo',
  liveStatusNotLiveLabel: 'Não ao vivo — mostrando o último estado conhecido',

  // liveGapReason* — uma causa para cada LiveGapReason (@bombfarm/contracts), mapeada de forma
  // exaustiva por LIVE_GAP_REASON_COPY_KEY abaixo.
  liveGapReasonClientNotStreaming:
    'O jogo está aberto, mas não está enviando nada no momento — pode estar em um menu, parado ou deslogado. O app continua tentando por conta própria.',
  liveGapReasonNeverAttached: 'O app ainda não se conectou ao jogo nesta sessão. Ele continua tentando por conta própria.',
  liveGapReasonAttachFailed: 'O app tentou se conectar ao jogo e não conseguiu. Ele continua tentando por conta própria.',
  liveGapReasonDetached: 'O app estava conectado, mas o jogo foi fechado. Ele continua tentando por conta própria.',
  liveGapReasonHookSilent:
    'A conexão ficou muda sozinha, mesmo com o jogo ainda aberto. O app continua tentando.',
  liveGapReasonRuntimeUnavailable: 'A parte do app que lê o jogo não conseguiu carregar. Ele continua tentando por conta própria.',
  liveGapReasonRuntimeUnavailableQuarantine:
    'Um antivírus provavelmente bloqueou a parte do app que lê o jogo. Ele continua tentando por conta própria.',
  liveGapReasonConsentMissing: 'Você ainda não permitiu que o app leia sua conta e se conecte ao jogo.',

  liveHeroesTitle: 'Heróis',
  liveListOnFieldTitle: 'Campo',
  liveListRecoveringTitle: 'Descansando',
  liveListQueuedTitle: 'Ociosos',
  liveListBenchedTitle: 'No banco',
  liveListEmptyLine: 'Nenhum herói aqui no momento.',
  liveEnergyLabel: 'Energia',
  liveFieldSlotsHint: 'Compre mais vagas de campo na sua árvore de habilidades',
  liveRestingSlotsHint: 'Ative uma casa superior para mais vagas de descanso',
  liveRestingCycleValue: 'Ciclo completo de descanso {duration}',
  liveRestingSkipsValue: '{left} de {max} resgates restantes hoje',
  liveRestingSkipsNone: 'Nenhum resgate restante hoje',
  liveUnclassifiedCount: 'Heróis não classificados em nenhuma lista: {n}',
  liveFieldExitPendingCount: 'Heróis que acabaram de sair do campo, ainda atualizando: {n}',

  // liveCountdown* — contagens de campo/descanso, e os qualificadores que marcam uma como estimada ou
  // pausada. Toda contagem usa uma única cor, então o qualificador é a única coisa que marca uma delas.
  liveFieldCountdownLabel: 'Tempo restante no campo',
  liveRecoveryCountdownLabel: 'Tempo restante de descanso',
  liveCountdownEstimatedQualifier: 'estimativa, não uma leitura direta',
  liveCountdownPausedQualifier: 'não está contando no momento',

  // liveNeverRead* — nada foi lido da conta ainda nesta sessão
  liveNeverReadTitle: 'Nada foi lido da sua conta ainda',
  liveNeverReadDescription: 'Abra o jogo com o companion em execução, para que ele tenha algo para ler.',
  // inventory* — a tela de Inventário: todos os itens da conta, agrupados por tipo
  inventoryNavLabel: 'Inventário',
  inventoryTitle: 'Inventário',
  inventoryGroupEquipment: 'Equipamentos',
  inventoryGroupGem: 'Gemas',
  inventoryGroupKey: 'Chaves',
  inventoryGroupOther: 'Outros',
  inventoryBadgeLocked: 'Bloqueado',
  inventoryBadgeMarketBlocked: 'Não pode ser negociado',
  inventoryBadgeUnresolved: 'Ainda não está na lista de itens',
  inventoryDetailSetSlot: '{set} · {slot}',
  inventoryDetailLevel: 'Nível {level}',
  inventoryEquippedByHero: '{hero} · Nível {level}',
  inventoryGroupTime: 'Peças de Casa',
  inventoryGroupStone: 'Pedras de habilidade',
  inventoryGroupChest: 'Baús',
  inventoryGemAmethyst: 'Ametista',
  inventoryGemAquamarine: 'Água-marinha',
  inventoryGemCitrine: 'Citrino',
  inventoryGemDiamond: 'Diamante',
  inventoryGemEmerald: 'Esmeralda',
  inventoryGemOceanite: 'Oceanita',
  inventoryGemRoselite: 'Roselita',
  inventoryGemRuby: 'Rubi',
  inventoryGemSapphire: 'Safira',
  inventoryGemTopaz: 'Topázio',
  inventoryChestItem: 'Baú de item · Nv {level}',
  inventoryChestGem: 'Baú de gemas',
  inventoryChestKey: 'Baú de chaves',
  inventoryChestSkill: 'Baú de pedras',
  inventoryChestTime: 'Baú de peças de Casa',
  inventorySearchPlaceholder: 'Buscar itens…',
  inventorySearchLabel: 'Buscar no inventário',
  inventoryFilterAll: 'Todos',
  inventoryFilterEquipped: 'Equipados',
  inventoryFilterClear: 'Limpar',
  inventoryFilterCount: '{shown} de {total}',
  inventoryFilterNoMatches: 'Nenhum item corresponde a esses filtros.',
  inventoryEquippedByUnknown: 'Equipado',
  inventoryFilterHeroLabel: 'Filtrar por herói',
  inventoryFilterAllHeroes: 'Todos os heróis',
  inventorySortLabel: 'Ordenar por',
  inventorySortRarity: 'Raridade',
  inventorySortLevel: 'Nível',
  inventorySortValue: 'Valor',
  inventorySortName: 'Nome',
  inventorySortCount: 'Quantidade',
  inventorySortAscending: 'Crescente',
  inventorySortDescending: 'Decrescente',
  inventoryFilterSetsLabel: 'Filtrar por conjunto',
  inventoryFilterAllSets: 'Todos os conjuntos',
  inventoryFilterSetsSelected: '{chosen} de {total} conjuntos',
  inventorySetOption: 'Nível {level} · {set}',
  inventoryUnknownCategory: 'um tipo que este app ainda não reconhece ({codes})',
  inventorySkipped: '{count} entradas não puderam ser lidas e não aparecem aqui.',
  inventoryEmptyTitle: 'Nenhum item lido ainda',
  inventoryEmptyDescription: 'Abra o jogo com o companion em execução, para que ele tenha o que ler.',
  inventoryCountLabel: '{count} itens',
};
