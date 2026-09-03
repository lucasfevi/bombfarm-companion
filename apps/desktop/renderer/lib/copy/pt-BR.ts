/**
 * The Portuguese (Brazil) translation of `en.ts`. `Copy` is a value-widening
 * mapped type (`export type Copy = { readonly [K in keyof typeof en]: string }` — `index.ts`), so
 * this file is annotated `: Copy`, never `as Copy`/`satisfies Copy`/an index signature: the
 * annotation is what makes a missing key here a compile error naming the key (`TS2741`) and a
 * typo'd extra key a compile error too (`TS2353`) — both directions of the same compile-time guarantee.
 *
 * Key set and every `{placeholder}` must match `en.ts` exactly — `parity.test.ts` proves both at
 * runtime as a second, independent line of defence (a future widening of `Copy` must not silently
 * disable the compile-time proof). Natural PT-BR at the concept level, not word-for-word English
 * calques (`docs/i18n.md`, "Portuguese chrome quality"); no invented aliases for official in-game
 * names (those come from `@bombfarm/domain/game-labels` — this file carries none).
 */
import type { Copy } from './index';

export const ptBR: Copy = {
  // shell* — AppShell navigation and status chrome
  shellStatusConnected: 'Conectado',
  shellStatusNotRunning: 'O jogo não está aberto',
  shellStatusStale: 'Desatualizado',
  shellLoadingLabel: 'Carregando…',
  shellUpdateAvailable: 'Atualização disponível',
  shellUpdateDownloading: 'Atualizando… {percent}%',
  shellUpdateReady: 'Reinicie para atualizar',
  shellUpdateOpenSettings: 'Abrir as configurações de atualização',
  shellCoffeeLabel: 'Me pague um café',
  shellReferralLabel:
    'Copiar meu código de indicação — nós dois ganhamos uma recompensa quando você passar da fase 151',
  shellReferralCopied: 'Código de indicação copiado',
  shellReferralCopyManual:
    'Área de transferência indisponível — o código está selecionado, aperte Control e C para copiar.',

  // empty* — placeholder states shown before real data has arrived
  emptyBridgeUnavailableTitle: 'Ponte de comunicação indisponível',
  valueNotAvailable: 'não disponível',

  // account* — the shared account-read states every data screen shows
  accountLoadingTitle: 'Carregando sua conta…',

  // error* — failure paths
  errorAccountReadFailed: 'Não foi possível ler a conta',

  // age* — relative-age words for format.ts. Singular/plural-agnostic by construction, matching
  // en.ts's own constraint — 'há {n}m' reads naturally for every n.
  ageJustNow: 'agora mesmo',
  ageMinutes: 'há {n}m',
  ageHours: 'há {n}h',
  ageDays: 'há {n}d',
  // 's' for seconds is the same abbreviation in PT-BR as in English — a legitimately identical
  // pair, declared in index.ts's IDENTICAL_IN_BOTH_LANGUAGES table rather than left to look like
  // an untranslated leftover.
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

  settingsWindowSectionTitle: 'Janela',
  settingsAlwaysOnTopMainLabel: 'Manter a janela principal no topo',
  settingsAlwaysOnTopMainHelp:
    'O companion fica acima das outras janelas enquanto isso estiver ligado. Tem efeito imediato.',
  settingsAlwaysOnTopNotSavedTitle: 'Sempre no topo alterado, mas não salvo',
  settingsAlwaysOnTopMiniLabel: 'Manter a janela compacta no topo',
  settingsAlwaysOnTopMiniHelp:
    'A janela compacta do Ao vivo fica acima das outras janelas enquanto isso estiver ligado. Tem efeito imediato.',
  settingsAlwaysOnTopMiniNotSavedTitle: 'Sempre no topo da janela compacta alterado, mas não salvo',

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

  // settingsUpdates* — o controle de procurar/baixar/instalar atualizações
  settingsUpdatesSectionTitle: 'Atualizações',
  settingsUpdatesCurrentVersionLabel: 'Versão instalada',
  settingsUpdatesChannelHelp: 'Canal de atualização: {channel}.',
  settingsUpdatesCheckLabel: 'Procurar atualizações',
  settingsUpdatesCheckHelp:
    'Também procura sozinho pouco depois de o app abrir, e a cada seis horas enquanto ele ficar aberto.',
  settingsUpdatesCheckAction: 'Procurar agora',
  settingsUpdatesDownloadLabel: 'Uma versão nova está esperando',
  settingsUpdatesDownloadHelp: 'Baixar não interrompe nada — você instala quando quiser.',
  settingsUpdatesDownloadAction: 'Baixar',
  settingsUpdatesInstallLabel: 'Terminar a atualização',
  settingsUpdatesInstallHelp: 'Leva alguns segundos. O app abre de novo sozinho.',
  settingsUpdatesInstallAction: 'Reiniciar e instalar',
  settingsUpdatesStatusChecking: 'Procurando atualizações…',
  settingsUpdatesStatusUpToDate: 'Você está na versão mais recente.',
  settingsUpdatesStatusAvailableTitle: 'A versão {version} está disponível',
  settingsUpdatesStatusAvailableBody: 'Baixe agora, ou deixe para depois — o app pergunta de novo mais tarde.',
  settingsUpdatesStatusDownloading: 'Baixando a versão {version}… {percent}%',
  settingsUpdatesStatusReadyTitle: 'A versão {version} está pronta para instalar',
  settingsUpdatesStatusReadyBody: 'O app fecha e abre de novo na versão nova. Nada do que você salvou é perdido.',
  settingsUpdatesStatusDisabled:
    'As atualizações estão desligadas nesta versão. As versões Beta e estável instaladas se atualizam sozinhas; uma versão de desenvolvimento local não.',
  settingsUpdatesErrorTitle: 'Não foi possível procurar atualizações',
  settingsUpdatesReasonOffline:
    'Não foi possível acessar o servidor de atualizações. Verifique sua conexão e tente de novo.',
  settingsUpdatesReasonRateLimited:
    'O servidor de atualizações está pedindo para irmos mais devagar. Espere alguns minutos e tente de novo.',
  settingsUpdatesReasonNoRelease: 'Ainda não existe uma versão publicada para esta build.',
  settingsUpdatesReasonUnknown:
    'Algo deu errado. Tente de novo e, se continuar falhando, salve um arquivo para relatório de erro abaixo.',

  // settingsSupport* — a metade com rótulo do link de apoio; a barra superior tem a metade só com ícone
  settingsSupportSectionTitle: 'Apoie o projeto',
  settingsSupportCoffeeLabel: 'Me pague um café',
  settingsSupportCoffeeHelp: 'O companion é gratuito e continua gratuito. Abre a página no seu navegador.',
  settingsSupportCoffeeAction: 'Me pague um café',
  settingsSupportReferralLabel: 'Código de indicação',
  settingsSupportReferralHelp:
    'Cola na tela de convite do jogo. Cada conta usa um código de indicação só, e quando você passar da fase 151 a gente ganha uma recompensa.',

  // consentGate* — o portão de permissão mostrado no lugar do conteúdo do app quando o acesso não é permitido
  consentGateTitle: 'Este app precisa da sua permissão para funcionar',
  consentGateBody:
    'Desculpe — o companion não tem nada a mostrar sem acesso à sua conta. Ele lê sua conta e se conecta ao programa do jogo em execução, e não fará nenhuma das duas coisas até que você permita.',
  consentGateReadAgainAction: 'Ler o aviso novamente',
  consentGateLanguageLabel: 'Idioma',

  // error* — §2.8
  errorAccountReadFailedDescription: 'Tente novamente depois que o jogo terminar de carregar, ou reinicie o app.',

  // live* — a tela Ao Vivo: rótulo de navegação e a linha de status de atualização no topo do painel
  liveNavLabel: 'Ao vivo',

  // miniLive* — a segunda janela compacta do Ao Vivo: o botão que a abre na aba Ao vivo, o
  // próprio chrome dela e o menu de layout dos painéis. Chaves `*Aria` rotulam controles só de ícone.
  miniLiveOpenLabel: 'Abrir mini',
  miniLiveCloseAria: 'Fechar mini',
  miniLiveGearAria: 'Layout dos painéis',
  miniLiveAxisLabel: 'Direção de crescimento',
  miniLiveAxisVerticalLabel: 'Empilhado',
  miniLiveAxisHorizontalLabel: 'Em linha',
  miniLiveLastSectionNote: 'Pelo menos um painel precisa permanecer ligado',

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
  liveHeroLevelValue: 'Nv {level}',
  liveEnergyLabel: 'Energia',
  liveEnergyRisingLabel: 'Subindo',
  liveEnergyFallingLabel: 'Caindo',
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

  // liveNeverRead* — nada foi lido da conta ainda nesta sessão. O motivo de nada ter chegado vem
  // das strings liveGapReason* acima (esta tela reutiliza o texto em vez de repetir "abra o jogo"
  // enquanto o app já está funcionando); esta é a única descrição restante, para o caso em que a
  // transmissão já está ao vivo e só falta a leitura da conta.
  liveNeverReadTitle: 'Nada foi lido da sua conta ainda',
  liveNeverReadAccountPendingDescription: 'O app está conectado ao jogo e lendo sua conta agora.',

  // liveNeverReadFlavorLine* — texto de humor, mais discreto e rotativo, abaixo do sprite de
  // espera, mostrado só enquanto algo está realmente em andamento. Nunca promete um prazo (a
  // espera pode legitimamente durar um minuto) — é bem-humorado sobre a própria espera.
  liveNeverReadFlavorLine1: 'Contando o ouro, moeda por moeda.',
  liveNeverReadFlavorLine2: 'Dando um oi para os seus heróis.',
  liveNeverReadFlavorLine3: 'Esquentando o ábaco.',
  liveNeverReadFlavorLine4: 'Esperando com paciência. Bastante paciência.',
  liveNeverReadFlavorLine5: 'Dando uma cutucada amigável na planilha.',

  // liveEarnings* — o painel de Ganhos: valores medidos de ouro/XP, enviados já prontos e só
  // formatados aqui, nunca recalculados.
  liveEarningsTitle: 'Ganhos',
  liveEarningsResetAria: 'Reiniciar sessão',
  liveEarningsCurrentGoldLabel: 'Ouro atual',
  liveEarningsGoldHeadlineUnit: 'ouro / h',
  liveEarningsXpHeadlineUnit: 'xp / h',
  liveEarningsRecentWindowLabel: 'últimos {minutes} min',
  liveEarningsGoldSessionLabel: 'Ouro/h',
  liveEarningsXpSessionLabel: 'XP/h',
  liveEarningsGoldSessionTotalLabel: 'Total de ouro',
  liveEarningsXpSessionTotalLabel: 'Total de XP',
  liveEarningsElapsedLabel: 'Decorrido',
  liveEarningsXpHelpLabel: 'Sobre esse número de XP',
  liveEarningsXpHelpBody: 'Calculado a partir dos props que seus heróis destruíram, não lido diretamente do jogo.',
  liveEarningsSeriesLabel: 'Ouro / h — últimos {minutes} min',
  liveEarningsSeriesAria: 'Ouro por hora nos últimos {minutes} minutos',
  liveEarningsSeriesPeakLabel: 'pico {value}',
  liveEarningsMeasuredNote: 'Medido',
  liveEarningsMeasuredBody:
    'Medido a partir do que realmente caiu nos últimos 10 minutos — não estimado. Trocar de mapa mistura o que os dois pagaram até a janela se atualizar.',
  liveEarningsGoldPerPropLabel: 'Ouro / prop',
  liveEarningsPropsPerMinuteLabel: 'Props / min',
  liveEarningsPropsTotalLabel: 'Props',
  liveEarningsGoldPerPropUnder: '{percent}% abaixo da estimativa',
  liveEarningsGoldPerPropOver: '{percent}% acima da estimativa',
  liveEarningsGoldPerPropOnEstimate: 'na estimativa',

  // liveMap* — o painel de Mapa: em qual mapa se está jogando e o quanto da run já passou.
  liveMapTitle: 'Mapa',
  liveMapHealthLabel: 'Vida do mapa',
  liveMapPropsLabel: 'Props vivos',
  liveMapUnknownName: 'Mapa desconhecido',
  liveMapXpPerPropLabel: 'XP / prop',
  liveMapGoldPerPropLabel: 'Ouro / prop',
  liveMapGoldPerClearLabel: 'Ouro / limpeza',
  liveMapEstimateNote: 'Estimativa',
  liveMapEstimateBody:
    'Estimado a partir dos valores da wiki deste mapa e dos seus próprios bônus — a média que um prop ou uma limpeza completa paga, não o que você realmente ganhou.',

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
  inventoryFilterPriced: 'Com preço',
  inventoryTotalsTitle: 'O que seu inventário poderia vender',
  inventoryTotalsCoverage: '{priced} de {tradable} itens negociáveis com preço',
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
  inventorySortMarket: 'Preço de mercado',
  inventoryViewLabel: 'Layout',
  inventoryViewCards: 'Cartões',
  inventoryViewList: 'Lista',
  inventoryTableCaption: 'Todos os itens da conta, em tabela ordenável',
  inventoryColumnEquippedBy: 'Equipado por',
  inventoryColumnActions: 'Ações',
  inventoryRowAction: 'Detalhes de {item}',
  marketNoListings: 'Sem anúncios',
  marketNotOnMarket: 'Fora do mercado',
  marketRefreshItem: 'Atualizar o preço de mercado de {item}',
  marketNativeTooltip: 'Menor anúncio na Steam, em {currency} — cotado {age}',
  marketConvertedTooltip: 'Aproximado: convertido do dólar, então a Steam pode mostrar outro valor — {age}',
  marketAgeJustNow: 'agora',
  marketAgeMinutes: 'há {count} min',
  marketAgeHours: 'há {count} h',
  marketAgeDays: 'há {count} d',
  marketAgeUnknown: 'em momento desconhecido',
  inventorySortAscending: 'Crescente',
  inventorySortDescending: 'Decrescente',
  inventoryFilterSetsLabel: 'Filtrar por set',
  inventoryFilterAllSets: 'Todos os sets',
  inventoryFilterSetsOwned: 'Sets que você tem',
  inventoryFilterSetsSelected: '{chosen} de {total} sets',
  inventoryFilterSelectAllSets: 'Selecionar todos',
  inventorySetOption: 'Nível {level} · {set}',
  inventoryUnknownCategory: 'um tipo que este app ainda não reconhece ({codes})',
  inventorySkipped: '{count} entradas não puderam ser lidas e não aparecem aqui.',
  inventoryEmptyTitle: 'Nenhum item lido ainda',
  inventoryEmptyDescription: 'Abra o jogo com o companion em execução, para que ele tenha o que ler.',

  accountNavLabel: 'Conta',
  accountPanelTitle: 'Sua conta',
  accountReadAge: 'Conta lida {age}',
  accountUnavailableTitle: 'Sua conta ainda não foi lida',
  accountUnavailableDescription: 'Abra o jogo com o companion em execução e deixe aberto por um instante.',

  accountIdentityTip: 'De quem é esta conta e até onde ela chegou, lido do jogo enquanto ele roda.',
  accountPlayerName: 'Jogador',
  accountIdLabel: 'ID da conta',
  accountCurrentPhase: 'Fase atual',
  accountMaxPhase: 'Fase mais distante',

  accountHouse: 'Casa',
  accountHouseLevel: 'Nível da casa',
  accountHouseTip: 'Sua Casa define quanto tempo um herói descansa entre as idas ao campo, e quantos descansam ao mesmo tempo. A próxima Casa aparece no nível 1 dela, que é o que você recebe assim que desbloqueá-la.',
  accountHouseTipMaxed: 'Sua Casa define quanto tempo um herói descansa entre as idas ao campo, e quantos descansam ao mesmo tempo. A Casa V é a última — não há nada acima dela.',
  accountHouseCycle: 'Ciclo de descanso',
  accountHouseCycleTip: 'Um herói indo de vazio a cheio. Vem do jogo quando ele informa um valor para esta Casa e nível exatos; caso contrário, sai dos valores de nível 1 e nível 20 da própria Casa.',
  accountHouseSlots: 'Vagas de descanso',
  accountHouseSlotsTip: 'Quantos heróis a Casa recupera ao mesmo tempo. Heróis além disso esperam com energia congelada até vagar um espaço.',
  accountNextHouse: 'Próxima Casa — {house}',

  accountTreePanelTitle: 'Árvore de habilidades',
  accountTreeTip: 'Todos os bônus da conta que sua árvore de habilidades concede, como o jogo os soma.',
  accountTreeGroupDamage: 'Dano',
  accountTreeGroupField: 'Campo',
  accountTreeGroupRewards: 'Recompensas',
  accountSquadDamage: 'Dano do esquadrão',
  accountGeoMultiplier: 'Dano multiplicativo',
  accountTotalDamage: 'Dano total',
  accountTotalDamageTip: 'O dano total é a multiplicação dos dois acima, não um terceiro bônus à parte: um dano de esquadrão de {squad}% com multiplicador de {geo} chega a {total}. Todo número de dano deste app já inclui isso, então nunca some dano do esquadrão ou multiplicativo de novo.',
  accountCritChance: 'Chance de crítico',
  accountCritDamage: 'Dano crítico',
  accountSpeed: 'Velocidade',
  accountEnergy: 'Energia máxima',
  accountFieldSlots: 'Vagas no campo',
  accountFieldSlotsTip: 'O resumo do próprio jogo mostra o que a árvore adiciona; o total, contando a vaga que toda conta já tem, é o que realmente limita seu campo.',
  accountBonusOfTotal: '{bonus} ({total} no total)',
  accountGold: 'Ouro por alvo',
  accountGoldTip: 'O bônus de ouro da árvore de habilidades — escala o ouro que cada prop paga.',
  accountLuck: 'Sorte',
  accountXp: 'Experiência do herói',
  accountBagTabs: 'Abas da bolsa',

  accountHoldingsTotal: 'O que esta conta poderia vender',
  accountHoldingsPartialTotal: 'Parte do que esta conta poderia vender',
  accountHoldingsCoverage: '{priced} de {eligible} coisas vendáveis com preço agora',
  accountHoldingsMissing: 'Fora desta conta: {rows}.',
  accountHoldingsPricesUpdated: 'preços {age}',
  accountHoldingsUnpriced: 'sem oferta',
  accountHoldingsInventory: 'Inventário',
  accountHoldingsInventoryCoverage: '{priced} de {eligible} itens negociáveis com preço',
  accountHoldingsInventoryWithheld: 'Seu inventário ainda não foi lido',
  accountHoldingsInventoryLink: 'Abrir o inventário',
  accountHoldingsHeroes: 'Heróis',
  accountHoldingsHeroesCoverage: '{priced} de {eligible} heróis vendáveis com preço',
  accountHoldingsHeroesWithheld: 'Seus heróis ainda não foram lidos',
  accountHoldingsHeroesFloor: 'Uma oferta de herói é precificada só pela raridade — nível, equipamento e habilidades não valem nada nela — então este é um piso, nunca o que um herói bem construído alcança.',
  accountHoldingsSkins: 'Skins em uso',
  accountHoldingsSkinsCoverage: '{priced} de {eligible} skins compradas com preço',
  accountHoldingsSkinsWithheld: 'Seus heróis ainda não foram lidos',
  accountHoldingsSkinsWorn: 'Uma skin comprada conta uma vez, por mais heróis que a usem, e só enquanto algum deles ainda a usa — devolva todos à skin de nascimento e este valor cai sem nada ter sido vendido.',

  farmNavLabel: 'Farm',
  farmRefresh: 'Atualizar',
  farmRefreshBusy: 'Calculando…',
  farmRefreshedAge: 'calculado {age}',
  farmRefreshStale: 'desatualizado',
  farmUnavailableTitle: 'Ainda falta ler parte da sua conta',
  farmUnavailableDescription: 'O quadro precisa de todas as partes da sua conta. Abra o jogo com o companion em execução e deixe aberto por um instante.',
  farmStatColumn: 'Atributo',
  farmStatLuck: 'Sorte',

  heroAvatarCol: 'Avatar',
  heroBattleActive: 'Ativado',
  heroBattleActiveTitle: 'Ativado no rodízio',
  heroBattleInactive: 'Desativado',
  heroBattleInactiveTitle: 'Desativado no rodízio',
  heroBattleToggleAria: 'Ativar ou desativar este herói no rodízio',
  heroRank: 'Rank',
  heroStripSwitch: 'Trocar herói',
  gearSlotEmptyAria: '{slot} — vazio',
  gearSlotEmptyTip: 'Vazio',
  importClose: 'Fechar',
  importColLevel: 'Nv',
  importColName: 'Nome',
  importColPower: 'Poder',
  importColRank: 'Rank',
  importColRarity: 'Raridade',
  modeDps: 'DPS',
  rankLv: 'Nv',
  rosterColAbilities: 'Habilidades',
  rosterColGear: 'Equip.',
  rosterColStatus: 'Status',
  switchHero: 'Trocar herói',
  switchHeroDesc: 'Escolha entre {n} heróis da sua conta. Ordenados por poder por padrão.',
  switchHeroShort: 'Elenco',
};
