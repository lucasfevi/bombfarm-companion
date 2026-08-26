/**
 * Every player-facing string in the desktop renderer, flat and typed (`AD-040`). Read only
 * through `useCopy()` (`./index.ts`) — never `import { en }` directly at a call site. That is
 * what keeps F4's PT-BR swap a body replacement instead of an N-file edit.
 *
 * Grouped by the web's own i18n namespace prefixes (`apps/web/src/shared/i18n/namespaces/*`) so
 * a future merge into `STRINGS` (`apps/web/src/shared/i18n/strings.ts`) is mechanical: `shell*`,
 * `planning*`, `fidelity*`, `advice*`, `empty*`, `error*`.
 *
 * Every value here must satisfy `docs/i18n.md`'s player-facing plain-language rules — no
 * formulas, no camelCase identifiers, no field paths, no type names (`copy/en.test.ts` scans
 * this object and fails, naming the key, on any of the four).
 */
export const en = {
  // shell* — AppShell navigation and status chrome
  shellPlanningNavLabel: 'Planning',
  shellStatusConnected: 'Connected',
  shellStatusNotRunning: 'Game not running',
  shellStatusStale: 'Stale',
  shellLoadingLabel: 'Loading…',

  // empty* — placeholder states shown before real data has arrived
  emptyBridgeUnavailableTitle: 'Preload bridge unavailable',

  // Account section names, in player language — never the raw section key (MPV-07, MPV-18)
  sectionNameAccount: 'your farm phase',
  sectionNameHeroes: 'your heroes',
  sectionNameSkills: 'your skill tree',
  sectionNameCasa: 'your house',
  sectionNameItems: 'your gear',

  // planning* — the Planning screen
  planningRosterColumnAvatar: 'Avatar',
  planningRosterColumnName: 'Hero',
  planningRosterColumnLevel: 'Level',
  planningRosterColumnStars: 'Stars',
  planningRosterColumnRarity: 'Rarity',
  planningSelectHeroPrompt: 'Select a hero from the list to see their next-point advice.',
  planningNoRosterTitle: 'No heroes to plan for yet',
  planningNoRosterDescription: 'We could not read a usable hero list from your account.',
  planningNothingPersistedTitle: 'Nothing saved yet',
  planningNothingPersistedDescription: 'Open the game with the companion running once, so it can remember your account.',
  planningRejectedTitleMissingBirthStats: 'Your save is missing hero data the app needs',
  planningRejectedDescriptionMissingBirthStats: 'These heroes could not be read from a recent enough version of the game:',
  planningRejectedTitleNotASaveFile: 'That does not look like account data',
  planningStoreUnavailableNotice: 'Nothing will be remembered after the app closes.',
  planningGearSummaryLabel: 'Gear equipped',

  // fidelity* — provenance / degradation display
  fidelityNoticeTitle: 'Some of your account is not fully up to date',
  fidelityMissingKeysLabel: 'Fields the game did not send',
  fidelityStatusResolved: 'read just now',
  fidelityStatusStale: 'remembered from your last session',
  fidelityStatusMissing: 'not available',
  fidelityStatusDegraded: 'sent in a shape this version does not understand yet',

  // advice* — next-point ranking, DPS, reset advice
  adviceNextPointTitle: 'Next-point ranking',
  adviceNextPointStatColumn: 'Stat',
  adviceNextPointGainColumn: 'Gain',
  adviceDpsLabel: 'Solo DPS',
  adviceResetAdviceRecommended: 'A stat reset looks worth it for this hero.',
  adviceResetAdviceNotRecommended: 'No stat reset needed right now.',

  // Stat names, in player language — pipelineForHero's own PointValue.label is Portuguese-only
  // (a pre-i18n artifact), so the renderer names each stat itself, keyed by StatKey.
  statNameEnergy: 'Energy',
  statNameAttack: 'Attack',
  statNameCritDmg: 'Crit damage',
  statNameSpeed: 'Speed',
  statNameCritChance: 'Crit chance',
  statNamePenetration: 'Penetration',
  statNameCdr: 'Cooldown reduction',
  planningLoadingTitle: 'Loading your account…',

  // withheld* — the always-mounted notice slot for a withheld quantity (MPV-09/10, no-layout-shift)
  withheldRosterRowTitle: 'Roster withheld',
  withheldGearSummaryTitle: 'Gear summary withheld',
  withheldDpsTitle: 'DPS withheld',
  withheldNextPointRankingTitle: 'Next-point ranking withheld',
  withheldResetAdviceTitle: 'Reset advice withheld',
  withheldBecause: 'Waiting on {sections}.',

  // error* — failure paths
  errorAccountReadFailed: 'The account could not be read',

  // store.reason, in player language (AccountStoreReason, exhaustively mapped)
  storeReasonEmpty: 'nothing has been saved yet',
  storeReasonSchemaTooNew: 'a newer version of the companion saved this, so this version cannot read it',
  storeReasonCorruptRebuilt: 'the saved copy was unreadable and had to be rebuilt',
  storeReasonNotWritable: 'the save location is not writable',
  storeReasonNoSqliteBinding: 'this build cannot save on this system',
  storeReasonAccountMismatch: 'a different account is currently running',

  // age* — relative-age words for format.ts (MP3 F4, AD-054). format.ts owns no words of its
  // own; every one of its five relative-age buckets renders through one of these, via sub().
  // Singular/plural-agnostic by construction (design §7 rule 3) — no plural engine is built.
  ageJustNow: 'just now',
  ageMinutes: '{n}m ago',
  ageHours: '{n}h ago',
  ageDays: '{n}d ago',
  ageShortSeconds: '{n}s',
  ageShortMinutes: '{n}m',

  // settings* — the language control (MP3 F4, MIN-16)
  settingsNavLabel: 'Settings',
  settingsLanguageSectionTitle: 'Language',
  settingsLanguageLabel: 'App language',
  settingsLanguageHelp: 'Changes take effect immediately.',
  settingsLanguageOptionEnglish: 'English',
  settingsLanguageOptionPortuguese: 'Portuguese (Brazil)',
  settingsLanguageNotSavedTitle: 'Language changed, but not saved',
  // One key per SettingsWriteReason (@bombfarm/contracts), mapped exhaustively by
  // SETTINGS_WRITE_REASON_COPY_KEY below (MIN-11).
  settingsLanguageReasonNoStore: 'Your save location is unavailable, so this will not survive a restart.',
  settingsLanguageReasonNotWritable: 'Your save location is not writable, so this will not survive a restart.',
  settingsLanguageReasonUnknown: 'This choice could not be saved, so it will not survive a restart.',

  // settingsConsent* — the account access revoke control (Settings is reachable only once granted)
  settingsConsentSectionTitle: 'Account access',
  settingsConsentStatusGranted: 'Access: allowed',
  settingsConsentHelpGranted: 'The companion reads your account and stays attached to the game client.',
  settingsConsentRevokeAction: 'Turn off',

  // settingsDiagnostics* — the manual frame-ring dump control (a bug-report affordance)
  settingsDiagnosticsSectionTitle: 'Diagnostics',
  settingsDiagnosticsSaveLabel: 'Save a bug report file',
  settingsDiagnosticsSaveHelp:
    'Writes a local file with details about recent game traffic. Nothing is sent anywhere — you choose if and when to share it.',
  settingsDiagnosticsSaveAction: 'Save file',
  settingsDiagnosticsSavedTitle: 'File saved',
  settingsDiagnosticsSavedBody: 'Wrote a diagnostics file to {path}.',
  settingsDiagnosticsNotSavedTitle: 'Nothing saved',
  // One key per LiveDiagnosticsDumpReason (@bombfarm/contracts), mapped exhaustively by
  // DIAGNOSTICS_DUMP_REASON_COPY_KEY below.
  settingsDiagnosticsReasonRateLimited: 'You just saved one. Wait a few seconds and try again.',
  settingsDiagnosticsReasonWriteFailed: 'The file could not be written. Check your save location and try again.',
  settingsDiagnosticsReasonNoSource: 'There is nothing to save yet. The app has not connected to the game.',

  // consentGate* — the permission gate shown instead of app content when access is not allowed
  consentGateTitle: 'This app needs your permission to work',
  consentGateBody:
    'Sorry — the companion has nothing to show without access to your account. It reads your account and attaches to the running game client, and it will not do either until you allow it.',
  consentGateReadAgainAction: 'Read the disclosure again',
  consentGateLanguageLabel: 'Language',

  // error* — MP3 F4 §2.8: a main-process error crosses the boundary as a key, never as
  // pre-rendered English. The raw message is kept as diagnostic data only.
  errorAccountReadFailedDescription: 'Try again after the game finishes loading, or restart the app.',

  // live* — the Live screen: nav label and the top-of-panel freshness status line
  liveNavLabel: 'Live',
  liveStatusLiveLabel: 'Streaming live from the game',
  liveStatusNotLiveLabel: 'Not live — showing the last known state',

  // liveGapReason* — one cause per LiveGapReason (@bombfarm/contracts), exhaustively mapped by
  // LIVE_GAP_REASON_COPY_KEY below. Every reason but consentMissing describes a gap the app is
  // already retrying on its own, so no "try again" action is offered for those. consentMissing
  // is the one reason with a real action, and it reuses the existing disclosure control rather
  // than a second copy key.
  liveGapReasonClientNotStreaming:
    'The game is open, but it is not sending anything right now — a menu, an idle screen, or being logged out. The app keeps trying on its own.',
  liveGapReasonNeverAttached: 'The app has not connected to the game yet this session. It keeps trying on its own.',
  liveGapReasonAttachFailed: 'The app tried to connect to the game and could not. It keeps trying on its own.',
  liveGapReasonDetached: 'The app was connected, but the game closed. It keeps trying on its own.',
  liveGapReasonHookSilent:
    'The connection went quiet on its own, even though the game is still open. The app keeps trying.',
  liveGapReasonRuntimeUnavailable: 'The part of the app that reads the game could not load. It keeps trying on its own.',
  liveGapReasonRuntimeUnavailableQuarantine:
    'Security software likely blocked the part of the app that reads the game. It keeps trying on its own.',
  liveGapReasonConsentMissing: 'You have not allowed the app to read your account and connect to the game yet.',

  // liveList* — the four hero lists' headings, plus the lines shared by every list
  liveListOnFieldTitle: 'On the field',
  liveListRecoveringTitle: 'Recovering',
  liveListQueuedTitle: 'Waiting for a rest slot',
  liveListBenchedTitle: 'Benched',
  liveListEmptyLine: 'No heroes here right now.',
  liveUnclassifiedCount: 'Heroes not sorted into a list: {n}',
  liveFieldExitPendingCount: 'Heroes just off the field, still updating: {n}',

  // liveOccupancy* — field occupancy, reported as plain information, never a warning
  liveOccupancyLabel: 'Field',
  liveOccupancyValue: 'Field slots in use: {occupied} of {total}',
  liveOccupancyValueUnknownTotal: 'Heroes on the field: {occupied}',

  // liveHouse* — the house panel
  liveHouseTitle: 'House',
  liveHouseActiveLabel: 'Active house',
  liveHouseLevelLabel: 'Level',
  liveHouseSlotsLabel: 'Rest slots',
  liveHouseCycleLabel: 'Full rest cycle',
  liveHouseRescuesLabel: 'Daily rescues',
  liveHouseRescuesValue: '{left} of {max} left today',
  liveHouseAbsent: 'House data has not been sent for this account.',

  // liveCountdown* — field/rest countdowns, and the qualifiers that mark one as estimated or paused
  liveFieldCountdownLabel: 'Field time remaining',
  liveRecoveryCountdownLabel: 'Rest time remaining',
  liveCountdownEstimatedQualifier: 'estimate, not a direct reading',
  liveCountdownPausedQualifier: 'not currently counting down',
  liveCountdownLegend: 'Countdowns with a dashed underline are estimates, not direct readings.',

  // liveNeverRead* — nothing has been read from the account yet this session
  liveNeverReadTitle: 'Nothing read from your account yet',
  liveNeverReadDescription: 'Open the game with the companion running, so it has something to read.',
} as const;
