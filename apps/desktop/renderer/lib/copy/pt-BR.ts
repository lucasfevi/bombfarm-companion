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
  shellDiagnosticsNavLabel: 'Diagnóstico',
  shellStatusConnected: 'Conectado',
  shellStatusNotRunning: 'O jogo não está aberto',
  shellStatusStale: 'Desatualizado',
  shellLoadingLabel: 'Carregando…',
  shellDiagnosticsSnapshotTitle: 'Estado atual (bruto e processado)',

  // empty* — placeholder states shown before real data has arrived
  emptyBridgeUnavailableTitle: 'Ponte de comunicação indisponível',
  emptyNoSnapshotTitle: 'Nenhum estado capturado ainda',
  emptyNoSnapshotDescription: 'Aguardando a primeira leitura do jogo.',

  // Account section names, in player language — never the raw section key
  sectionNameAccount: 'sua fase da fazenda',
  sectionNameHeroes: 'seus heróis',
  sectionNameSkills: 'sua árvore de habilidades',
  sectionNameCasa: 'sua casa',
  sectionNameItems: 'seu equipamento',

  // planning* — the Planning screen
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

  // settingsConsent* — o controle de revogar/permitir novamente o acesso à conta
  settingsConsentSectionTitle: 'Acesso à conta',
  settingsConsentStatusGranted: 'Acesso: permitido',
  settingsConsentStatusNotGranted: 'Acesso: não permitido',
  settingsConsentHelpGranted: 'O companion lê sua conta e permanece conectado ao cliente do jogo.',
  settingsConsentHelpNotGranted: 'O companion não está lendo sua conta nem conectado ao cliente do jogo.',
  settingsConsentRevokeAction: 'Desativar',
  settingsConsentReallowAction: 'Revisar e permitir',

  // error* — MP3 F4 §2.8
  errorAccountReadFailedDescription: 'Tente novamente depois que o jogo terminar de carregar, ou reinicie o app.',
};
