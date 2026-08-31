/**
 * Every player-facing string in the desktop renderer, flat and typed. Read only
 * through `useCopy()` (`./index.ts`) — never `import { en }` directly at a call site. That is
 * what keeps a second language a body replacement instead of an N-file edit.
 *
 * Grouped by the web's own i18n namespace prefixes (`apps/web/src/shared/i18n/namespaces/*`) so
 * a future merge into `STRINGS` (`apps/web/src/shared/i18n/strings.ts`) is mechanical: `shell*`,
 * `empty*`, `error*`.
 *
 * Every value here must satisfy `docs/i18n.md`'s player-facing plain-language rules — no
 * formulas, no camelCase identifiers, no field paths, no type names (`copy/en.test.ts` scans
 * this object and fails, naming the key, on any of the four).
 */
export const en = {
  // shell* — AppShell navigation and status chrome
  shellStatusConnected: 'Connected',
  shellStatusNotRunning: 'Game not running',
  shellStatusStale: 'Stale',
  shellLoadingLabel: 'Loading…',
  shellUpdateAvailable: 'Update available',
  shellUpdateDownloading: 'Updating… {percent}%',
  shellUpdateReady: 'Restart to update',
  shellUpdateOpenSettings: 'Open the Updates settings',

  // empty* — placeholder states shown before real data has arrived
  emptyBridgeUnavailableTitle: 'Preload bridge unavailable',
  // The stand-in the Live screen prints wherever a quantity has not been read yet.
  valueNotAvailable: 'not available',

  // account* — the shared account-read states every data screen shows
  accountLoadingTitle: 'Loading your account…',

  // error* — failure paths
  errorAccountReadFailed: 'The account could not be read',

  // age* — relative-age words for format.ts. format.ts owns no words of its
  // own; every one of its five relative-age buckets renders through one of these, via sub().
  // Singular/plural-agnostic by construction — no plural engine is built.
  ageJustNow: 'just now',
  ageMinutes: '{n}m ago',
  ageHours: '{n}h ago',
  ageDays: '{n}d ago',
  ageShortSeconds: '{n}s',
  ageShortMinutes: '{n}m',

  // settings* — the language control (a @bombfarm/ui primitive)
  settingsNavLabel: 'Settings',
  settingsLanguageSectionTitle: 'Language',
  settingsLanguageLabel: 'App language',
  settingsLanguageHelp: 'Changes take effect immediately.',
  settingsLanguageOptionEnglish: 'English',
  settingsLanguageOptionPortuguese: 'Portuguese (Brazil)',
  settingsLanguageNotSavedTitle: 'Language changed, but not saved',
  // One key per SettingsWriteReason (@bombfarm/contracts), mapped exhaustively by
  // SETTINGS_WRITE_REASON_COPY_KEY below.
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

  // settingsUpdates* — the update check/download/install control (`UpdateStatus`, @bombfarm/contracts)
  settingsUpdatesSectionTitle: 'Updates',
  settingsUpdatesCurrentVersionLabel: 'Installed version',
  settingsUpdatesChannelHelp: 'Update channel: {channel}.',
  settingsUpdatesCheckLabel: 'Check for updates',
  settingsUpdatesCheckHelp: 'Also checks on its own shortly after the app opens, and every six hours it stays open.',
  settingsUpdatesCheckAction: 'Check now',
  settingsUpdatesDownloadLabel: 'A new version is waiting',
  settingsUpdatesDownloadHelp: 'Downloading does not interrupt anything — you install it when you are ready.',
  settingsUpdatesDownloadAction: 'Download',
  settingsUpdatesInstallLabel: 'Finish updating',
  settingsUpdatesInstallHelp: 'Takes a few seconds. The app reopens on its own.',
  settingsUpdatesInstallAction: 'Restart and install',
  settingsUpdatesStatusChecking: 'Checking for updates…',
  settingsUpdatesStatusUpToDate: 'You are on the latest version.',
  settingsUpdatesStatusAvailableTitle: 'Version {version} is available',
  settingsUpdatesStatusAvailableBody: 'Download it now, or leave it — the app will ask again later.',
  settingsUpdatesStatusDownloading: 'Downloading version {version}… {percent}%',
  settingsUpdatesStatusReadyTitle: 'Version {version} is ready to install',
  settingsUpdatesStatusReadyBody: 'The app closes and reopens on the new version. Nothing you have saved is lost.',
  settingsUpdatesStatusDisabled:
    'Updates are off in this build. Installed Beta and stable builds update themselves; a local development build does not.',
  settingsUpdatesErrorTitle: 'Could not check for updates',
  // One key per UpdateErrorReason (@bombfarm/contracts), mapped exhaustively by
  // UPDATE_ERROR_REASON_COPY_KEY below.
  settingsUpdatesReasonOffline: 'Could not reach the update server. Check your internet connection and try again.',
  settingsUpdatesReasonRateLimited: 'The update server is asking us to slow down. Wait a few minutes and try again.',
  settingsUpdatesReasonNoRelease: 'There is no published release for this build yet.',
  settingsUpdatesReasonUnknown: 'Something went wrong. Try again, and save a bug report file below if it keeps failing.',

  // consentGate* — the permission gate shown instead of app content when access is not allowed
  consentGateTitle: 'This app needs your permission to work',
  consentGateBody:
    'Sorry — the companion has nothing to show without access to your account. It reads your account and attaches to the running game client, and it will not do either until you allow it.',
  consentGateReadAgainAction: 'Read the disclosure again',
  consentGateLanguageLabel: 'Language',

  // error* — §2.8: a main-process error crosses the boundary as a key, never as
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

  liveHeroesTitle: 'Heroes',
  liveListOnFieldTitle: 'Field',
  liveListRecoveringTitle: 'Resting',
  liveListQueuedTitle: 'Idle',
  liveListBenchedTitle: 'Benched',
  liveListEmptyLine: 'No heroes here right now.',
  liveHeroLevelValue: 'Lv {level}',
  liveEnergyLabel: 'Energy',
  liveFieldSlotsHint: 'Upgrade field slots in your skill tree',
  liveRestingSlotsHint: 'Upgrade to a later house for more rest slots',
  liveRestingCycleValue: 'Full rest cycle {duration}',
  liveRestingSkipsValue: '{left} of {max} skips left today',
  liveRestingSkipsNone: 'No skips left today',
  liveUnclassifiedCount: 'Heroes not sorted into a list: {n}',
  liveFieldExitPendingCount: 'Heroes just off the field, still updating: {n}',

  // liveCountdown* — field/rest countdowns, and the qualifiers that mark one as estimated or paused.
  // Every countdown reads in one colour, so a qualifier is the only thing that marks one.
  liveFieldCountdownLabel: 'Field time remaining',
  liveRecoveryCountdownLabel: 'Rest time remaining',
  liveCountdownEstimatedQualifier: 'estimate, not a direct reading',
  liveCountdownPausedQualifier: 'not currently counting down',

  // liveNeverRead* — nothing has been read from the account yet this session. The reason nothing
  // has arrived comes from the liveGapReason* copy above (this screen's empty state reuses it
  // rather than repeating "open the game" while the app is already working); this is the one
  // description left for the case where the stream is live and only the account read is pending.
  liveNeverReadTitle: 'Nothing read from your account yet',
  liveNeverReadAccountPendingDescription: 'The app is connected to the game and reading your account now.',

  // liveNeverReadFlavorLine* — quieter, rotating flavour text under the waiting sprite, shown
  // only while something is actually pending. Never a duration promise (the wait can legitimately
  // run a minute) — playful about waiting itself instead.
  liveNeverReadFlavorLine1: 'Counting the gold, one coin at a time.',
  liveNeverReadFlavorLine2: 'Saying hello to your heroes.',
  liveNeverReadFlavorLine3: 'Warming up the abacus.',
  liveNeverReadFlavorLine4: 'Waiting patiently. Very patiently.',
  liveNeverReadFlavorLine5: 'Giving the ledger a friendly nudge.',

  // liveEarnings* — the Earnings panel: measured gold/XP figures, sent as finished values and
  // only ever formatted here, never recomputed.
  liveEarningsTitle: 'Earnings',
  liveEarningsResetAria: 'Reset session',
  liveEarningsCurrentGoldLabel: 'Current gold',
  liveEarningsGoldHeadlineUnit: 'gold / h',
  liveEarningsXpHeadlineUnit: 'xp / h',
  liveEarningsRecentWindowLabel: 'last {minutes} min',
  liveEarningsGoldSessionLabel: 'Gold/hr',
  liveEarningsXpSessionLabel: 'XP/hr',
  liveEarningsGoldSessionTotalLabel: 'Gold total',
  liveEarningsXpSessionTotalLabel: 'XP total',
  liveEarningsElapsedLabel: 'Elapsed',
  liveEarningsXpHelpLabel: 'About this XP figure',
  liveEarningsXpHelpBody: 'Calculated from the props your heroes destroyed, not read directly from the game.',
  liveEarningsSeriesLabel: 'Gold / hr — last {minutes} min',
  liveEarningsSeriesAria: 'Gold per hour over the last {minutes} minutes',
  liveEarningsSeriesPeakLabel: 'peak {value}',
  liveEarningsMeasuredNote: 'Measured',
  liveEarningsMeasuredBody:
    'Measured from what actually dropped over the last 10 minutes — not estimated. Moving to another map mixes both maps’ payouts until the window has caught up.',
  liveEarningsGoldPerPropLabel: 'Gold / prop',
  liveEarningsPropsPerMinuteLabel: 'Props / min',
  liveEarningsPropsTotalLabel: 'Props',
  liveEarningsGoldPerPropUnder: '{percent}% under estimate',
  liveEarningsGoldPerPropOver: '{percent}% over estimate',
  liveEarningsGoldPerPropOnEstimate: 'on estimate',

  // liveMap* — the Map panel: which map is being played, and how far through it the run is.
  liveMapTitle: 'Map',
  liveMapHealthLabel: 'Map health',
  liveMapPropsLabel: 'Props alive',
  liveMapUnknownName: 'Unknown map',
  liveMapXpPerPropLabel: 'XP / prop',
  liveMapGoldPerPropLabel: 'Gold / prop',
  liveMapGoldPerClearLabel: 'Gold / clear',
  liveMapEstimateNote: 'Estimated',
  liveMapEstimateBody:
    'Estimated from this map’s wiki values and your own bonuses — the average a prop or a full clear pays out, not what you have actually earned.',

  // inventory* — the Inventory screen: every item the account carries, grouped by kind
  inventoryNavLabel: 'Inventory',
  inventoryTitle: 'Inventory',
  inventoryGroupEquipment: 'Gear',
  inventoryGroupGem: 'Gems',
  inventoryGroupKey: 'Keys',
  inventoryGroupOther: 'Other',
  inventoryBadgeLocked: 'Locked',
  inventoryBadgeMarketBlocked: 'Cannot be traded away',
  inventoryBadgeUnresolved: 'Not in the item list yet',
  inventoryDetailSetSlot: '{set} · {slot}',
  inventoryDetailLevel: 'Level {level}',
  inventoryEquippedByHero: '{hero} · Level {level}',
  inventoryGroupTime: 'House parts',
  inventoryGroupStone: 'Skill stones',
  inventoryGroupChest: 'Chests',
  inventoryGemAmethyst: 'Amethyst',
  inventoryGemAquamarine: 'Aquamarine',
  inventoryGemCitrine: 'Citrine',
  inventoryGemDiamond: 'Diamond',
  inventoryGemEmerald: 'Emerald',
  inventoryGemOceanite: 'Oceanite',
  inventoryGemRoselite: 'Roselite',
  inventoryGemRuby: 'Ruby',
  inventoryGemSapphire: 'Sapphire',
  inventoryGemTopaz: 'Topaz',
  inventoryChestItem: 'Item chest · Lv {level}',
  inventoryChestGem: 'Gem chest',
  inventoryChestKey: 'Key chest',
  inventoryChestSkill: 'Skill stone chest',
  inventoryChestTime: 'House part chest',
  inventorySearchPlaceholder: 'Search items…',
  inventorySearchLabel: 'Search your inventory',
  inventoryFilterAll: 'All',
  inventoryFilterEquipped: 'Equipped',
  inventoryFilterPriced: 'Priced',
  inventoryTotalsTitle: 'Market value',
  inventoryTotalsCoverage: '{priced} of {tradable} tradable items priced',
  inventoryFilterClear: 'Clear',
  inventoryFilterCount: '{shown} of {total}',
  inventoryFilterNoMatches: 'No items match those filters.',
  inventoryEquippedByUnknown: 'Equipped',
  inventoryFilterHeroLabel: 'Filter by hero',
  inventoryFilterAllHeroes: 'All heroes',
  inventorySortLabel: 'Sort by',
  inventorySortRarity: 'Rarity',
  inventorySortLevel: 'Level',
  inventorySortValue: 'Value',
  inventorySortName: 'Name',
  inventorySortCount: 'Quantity',
  inventorySortMarket: 'Market price',
  inventoryViewLabel: 'Layout',
  inventoryViewCards: 'Cards',
  inventoryViewList: 'List',
  inventoryTableCaption: 'Every item on the account, as a sortable table',
  inventoryColumnEquippedBy: 'Equipped by',
  inventoryColumnActions: 'Actions',
  inventoryRowAction: 'Details for {item}',
  marketNoListings: 'No listings',
  marketNotOnMarket: 'Not on the market',
  marketRefreshItem: 'Refresh the market price for {item}',
  marketNativeTooltip: 'Lowest listing on Steam, in {currency} — quoted {age}',
  marketConvertedTooltip: 'Approximate: converted from USD, so Steam may show a different figure — {age}',
  marketAgeJustNow: 'just now',
  marketAgeMinutes: '{count} min ago',
  marketAgeHours: '{count} h ago',
  marketAgeDays: '{count} d ago',
  marketAgeUnknown: 'at an unknown time',
  inventorySortAscending: 'Ascending',
  inventorySortDescending: 'Descending',
  inventoryFilterSetsLabel: 'Filter by set',
  inventoryFilterAllSets: 'All sets',
  inventoryFilterSetsOwned: 'Sets you own',
  inventoryFilterSetsSelected: '{chosen} of {total} sets',
  inventoryFilterSelectAllSets: 'Select all',
  inventorySetOption: 'Level {level} · {set}',
  inventoryUnknownCategory: 'a kind this app does not recognise yet ({codes})',
  inventorySkipped: '{count} entries could not be read and are not shown.',
  inventoryEmptyTitle: 'No items read yet',
  inventoryEmptyDescription: 'Open the game with the companion running, so it has something to read.',

  // farm* — the Farm screen's own chrome. The board and the phase panels print their own
  // dictionary, which the farm package ships; these are the strings only this app owns.
  farmNavLabel: 'Farm',
  farmRefresh: 'Refresh',
  farmRefreshBusy: 'Working…',
  farmRefreshedAge: 'worked out {age}',
  farmRefreshStale: 'out of date',
  farmUnavailableTitle: 'Not enough of your account has been read',
  farmUnavailableDescription: 'The board needs every part of your account. Open the game with the companion running and leave it open for a moment.',
  // The stat vocabulary the farm screen borrows from this app. Every other stat name comes from
  // the game data itself; loot-facing Luck is the one the shared map does not carry.
  farmStatColumn: 'Stat',
  farmStatLuck: 'Luck',

  // hero*/gear*/import*/roster*/switch*/mode*/rank* — hero-identity vocabulary the farm screen's
  // roster surfaces read as one structural contract. Named exactly as that contract names them.
  heroAvatarCol: 'Avatar',
  heroBattleActive: 'Enabled',
  heroBattleActiveTitle: 'Enabled for the rotation',
  heroBattleInactive: 'Disabled',
  heroBattleInactiveTitle: 'Disabled for the rotation',
  heroBattleToggleAria: 'Enable or disable this hero for the rotation',
  heroRank: 'Rank',
  heroStripSwitch: 'Switch hero',
  gearSlotEmptyAria: '{slot} — empty',
  gearSlotEmptyTip: 'Empty',
  importClose: 'Close',
  importColLevel: 'Lv',
  importColName: 'Name',
  importColPower: 'Power',
  importColRank: 'Rank',
  importColRarity: 'Rarity',
  modeDps: 'DPS',
  rankLv: 'Lv',
  rosterColAbilities: 'Abilities',
  rosterColGear: 'Gear',
  rosterColStatus: 'Status',
  switchHero: 'Switch hero',
  switchHeroDesc: 'Pick from {n} heroes on your account. Sorted by power by default.',
  switchHeroShort: 'Roster',
} as const;
