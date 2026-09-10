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
  shellCoffeeLabel: 'Buy me a coffee',
  // The top bar's overflow button, and the referral row inside it — a menu row is read on its own
  // line, so it says what the click does rather than repeating the chip's whole sentence.
  shellMoreActionsLabel: 'More actions',
  shellReferralMenuLabel: 'Copy referral code',
  shellReferralLabel: 'Copy my referral code — we both get a reward once you clear stage 151',
  shellReferralCopied: 'Referral code copied',
  shellReferralCopyManual:
    'Clipboard unavailable — the code is selected, press Control and C to copy it.',

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

  settingsWindowSectionTitle: 'Window',
  settingsAlwaysOnTopMainLabel: 'Keep the main window on top',
  settingsAlwaysOnTopMainHelp:
    'The companion stays above other windows while this is on. Takes effect immediately.',
  settingsAlwaysOnTopNotSavedTitle: 'Always-on-top changed, but not saved',
  settingsAlwaysOnTopMiniLabel: 'Keep the mini window on top',
  settingsAlwaysOnTopMiniHelp:
    'The compact Live window stays above other windows while this is on. Takes effect immediately.',
  settingsAlwaysOnTopMiniNotSavedTitle: 'Mini always-on-top changed, but not saved',

  // settingsForge* — the one switch that lets the Forge tab spend gold (off by default)
  settingsForgeSectionTitle: 'Forge',
  settingsForgeWritesLabel: 'Let Forge spend gold',
  settingsForgeWritesHelp:
    'Off: the Forge tab plans climbs and never rolls. On: the Forge button spends gold on your account, one confirmed run at a time.',
  settingsForgeWritesNotSavedTitle: 'Forge setting changed, but not saved',

  // settingsGame*/settingsRestartGameOnExit* — the one switch that lets Steam bring the game
  // back after it exits (off by default)
  settingsGameSectionTitle: 'Game',
  settingsRestartGameOnExitLabel: 'Restart Bomb Farm if it exits',
  settingsRestartGameOnExitHelp:
    'When this is on, if the game closes while the companion is already running, Steam starts it again. The companion will not start the game when it itself opens. Off by default.',
  settingsRestartGameOnExitNotSavedTitle: 'Game setting changed, but not saved',

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
  settingsUpdatesCheckHelp:
    'Also checks on its own shortly after the app opens, and every twenty minutes it stays open.',
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

  // settingsSupport* — the labelled half of the support link; the top bar carries the icon-only half
  settingsSupportSectionTitle: 'Support the project',
  settingsSupportCoffeeLabel: 'Buy me a coffee',
  settingsSupportCoffeeHelp: 'The companion is free and stays free. Opens the page in your browser.',
  settingsSupportCoffeeAction: 'Buy me a coffee',
  settingsSupportReferralLabel: 'Referral code',
  settingsSupportReferralHelp:
    'Paste it on the game’s invite screen. Each account uses one referral code, and when you clear stage 151 we both get a reward.',

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

  // miniLive* — the compact second Live window: its opener on the Live tab, its own chrome, and
  // the panel-layout menu. `*Aria` keys label icon-only controls for assistive technology.
  miniLiveOpenLabel: 'Open mini',
  miniLiveCloseAria: 'Close mini',
  miniLiveGearAria: 'Panel layout',
  miniLiveAxisLabel: 'Growth direction',
  miniLiveAxisVerticalLabel: 'Stacked',
  miniLiveAxisHorizontalLabel: 'Side by side',
  miniLiveLastSectionNote: 'At least one panel must stay on',

  // windowControl* — the header's own caption buttons, which are icon-only, so each key is the
  // control's accessible name. Maximize and restore are two names for one button: which one it is
  // depends on whether the window is already maximized.
  windowControlMinimizeAria: 'Minimize',
  windowControlMaximizeAria: 'Maximize',
  windowControlRestoreAria: 'Restore down',
  windowControlCloseAria: 'Close to tray',

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
  liveEnergyRisingLabel: 'Rising',
  liveEnergyFallingLabel: 'Falling',
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
  inventoryDetailLevel: 'Lv {level}',
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
  inventoryTotalsTitle: 'What your inventory could sell',
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
  inventoryColumnForge: 'Forge',
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

  // forge* — the Forge screen: pick a piece, pick a target, see what the climb should cost, and
  // forge it. Forge levels reach these strings as values (`{target}` is "+13"), never as
  // characters of their own — a bare plus in copy reads as a formula.
  forgeNavLabel: 'Forge',
  forgeTitle: 'Forge',
  forgeSearchPlaceholder: 'Search gear…',
  forgeSearchLabel: 'Search your gear',
  forgeSlotLabel: 'Filter by slot',
  forgeAllSlots: 'All slots',
  forgeBandLabel: 'Filter by forge level',
  forgeBandAny: 'Any forge',
  forgeBandOnly: '{level} only',
  forgeBandRange: '{from} to {to}',
  forgeBandFrom: '{level} and higher',
  forgeHeroHint: 'Showing what {hero} wears',
  forgeTableCaption: 'Every piece of gear on the account, ranked by forge level',
  forgeRowSelect: 'Plan a climb for {item}',
  forgeItemTitle: 'Item',
  forgePickTitle: 'Pick a piece',
  forgePickDescription: 'Click a row to see what a climb should cost.',
  forgeStatsCaption: 'Every roll on the piece now and at the target',
  forgeColumnChange: 'Change',
  forgeStatsNote:
    'Every roll scales by the same factor — ×{factor} at {target} against ×{now} now — so this is what the piece becomes if the climb lands, not an average of where it might stop.',
  forgePlanTitle: 'Plan',
  forgeTargetLabel: 'Target',
  forgeTargetLower: 'Lower the target',
  forgeTargetRaise: 'Raise the target',
  forgeSpanSafe: 'safe span — every step lands',
  forgeSpanRisky: 'risky span — {chance} at the top',
  forgeMaxGoldLabel: 'Max gold',
  forgeMaxGoldPlaceholder: 'no budget',
  forgeAttemptsLabel: 'Attempts',
  forgeAttemptsPlaceholder: 'no limit',
  forgeLadderCaption: 'The risky rungs of the climb and their odds',
  forgeLadderFailTo: 'fail → {floor}',
  forgeFactRolls: 'Expected rolls',
  forgeFactGold: 'Expected gold',
  forgeFactBadRun: 'A bad run (p90)',
  forgeFactWallet: 'Wallet',
  forgeWarnMax:
    '{max} is the only rung that wipes the piece to {floor}. Expect to rebuild from the safe floor about {times} times on the way.',
  forgeWarnRisky:
    'A failed roll at {from}…{to} drops the piece back to {floor} and the gold is charged either way.',
  forgeButton: 'Forge to {target}',
  forgeReasonMaxed: 'Already at {max} — nothing left to forge',
  forgeReasonFixture: 'No server to forge on',
  forgeReasonSwitchOff: 'Turn on "{switch}" in Settings to forge from here',
  forgeReasonReady: 'Spends gold on your account — the button asks twice',
  forgeReasonRunning: 'Rolling — the run stops after the roll in flight',
  forgeReasonCancelling: 'Cancelling — waiting for the roll in flight to settle',
  forgeButtonConfirm: 'Confirm — spends gold',
  forgeButtonCancel: 'Cancel after this roll',
  forgeButtonCancelPending: 'Cancelling after this roll…',
  // forgeStart* — why main refused to start a run the panel asked for. The fixture and the
  // switch reuse the reason lines above; these are the ones only main can know.
  forgeStartBusy: 'A run is already in progress',
  forgeStartNotConsented: 'Accept the account read in Settings before forging',
  forgeStartGameNotRunning: 'Open the game before forging',
  forgeStartTokenUnavailable: 'The game session could not be read — open the game and try again',
  forgeStartUnknownItem: 'This piece is not in the account any more — refresh the bag',
  forgeStartBadTarget: 'The target is behind the piece now — refresh the bag',
  forgeStartUnavailable: 'The app is still starting — try again in a moment',
  // accountRead* — every Refresh that goes and reads the account shares these, so they name no
  // one screen's subject. They cover the reasons a read can fail, plus the floor that stops two
  // presses becoming two reads. Two more reuse the forgeStart* lines above, which already say the
  // same thing in the same words.
  forgeRefreshWorking: 'Reading…',
  accountReadRecent: 'Just read a moment ago — the account is as fresh as it gets',
  accountReadFixture: 'No server to read from',
  accountReadNotConsented: 'Accept the account read in Settings to refresh',
  accountReadGameNotRunning: 'Open the game to read the account again',
  // forgeLedger* — the run history at the foot of the screen. The header line is what the
  // section says with the table shut, so it carries the two figures worth knowing at a glance.
  forgeLedgerTitle: 'Run ledger',
  forgeLedgerSummary: '{runs} runs',
  // Its own clause rather than part of the two lines above, so the coin beside it marks the gold
  // and not the run and roll counts standing next to it.
  forgeLedgerGold: '{spent} gold',
  forgeLedgerCaption: 'Every forge run this app has made on the account, newest first',
  forgeLedgerEmptyTitle: 'No runs yet',
  forgeLedgerEmptyDescription: 'A run started from the plan panel is kept here.',
  forgeLedgerColumnWhen: 'When',
  forgeLedgerColumnItem: 'Piece',
  forgeLedgerColumnClimb: 'Climb',
  forgeLedgerColumnOutcome: 'Outcome',
  forgeLedgerColumnRolls: 'Rolls',
  forgeLedgerColumnFails: 'Fails',
  forgeLedgerColumnCrits: 'Crits',
  forgeLedgerColumnSafeJumps: 'Safe jumps',
  forgeLedgerColumnGold: 'Gold',
  forgeLedgerColumnDuration: 'Duration',
  forgeLedgerTotals: '{runs} runs · {rolls} rolls · {fails} fails',
  forgeLedgerClear: 'Clear the ledger',
  forgeLedgerClearTitle: 'Clear the forge ledger?',
  forgeLedgerClearDescription: 'Every past run and the totals go with it. The gold was spent either way.',
  forgeLedgerClearConfirm: 'Clear',
  forgeLedgerClearCancel: 'Keep',
  // forgeStop* — why a run ended, short enough for a table cell. The result heading says the same
  // thing at length, with the rung it stopped on.
  forgeStopTarget: 'Reached',
  forgeStopCancelled: 'Cancelled',
  forgeStopShortfall: 'Out of gold',
  forgeStopBudget: 'Gold budget',
  forgeStopAttempts: 'Attempt limit',
  forgeStopCooldown: 'Server cooldown',
  forgeStopMissing: 'Item refused',
  forgeStopError: 'Error',
  // The running rail: the climb so far, one dot per call, and the tally by rung.
  forgeRailRolls: '{rolls} rolls',
  forgeRailSpent: '{spent} gold',
  forgeRailWallet: 'wallet {wallet}',
  forgeRailTallyCaption: 'Rolls by rung',
  forgeRailTallyRung: 'Rung',
  forgeRailTallyRolls: 'Rolls',
  forgeRailTallyFails: 'Fails',
  forgeRailTallyGold: 'Gold',
  forgeChartLabel: 'The climb, one dot per call',
  forgeChartFloor: 'floor',
  forgeChartTarget: 'target',
  forgeMarkSuccess: 'landed',
  forgeMarkCritical: 'critical',
  forgeMarkFail: 'missed',
  forgeMarkSafe: 'safe jump',
  // A run leaves a gap between its rolls on purpose, and the chart holds the next roll's place
  // while it is in flight — never that anything is holding the run back, because nothing is.
  forgeMarkPending: 'rolling',
  // The result block, in the player's terms: what happened and what it cost against the plan.
  forgeResultReached: 'Reached {level}',
  forgeResultCancelled: 'Stopped at {level} — cancelled after roll {rolls}',
  forgeResultShortfall: 'Out of gold at {level}',
  forgeResultBudget: 'Stopped by the gold budget at {level}',
  forgeResultAttempts: 'Stopped by the attempt limit at {level}',
  forgeResultCooldown: 'Server cooldown at {level}',
  forgeResultMissing: 'Server refused the item',
  forgeResultError: 'Stopped by an error at {level}',
  forgeResultClimb: 'Climb',
  forgeResultRolls: 'Rolls · fails · crits',
  forgeResultSpent: 'Spent',
  forgeResultDuration: 'Duration',
  forgeAgainstPlanTitle: 'Against the plan',
  // Bare labels: each figure's amount is drawn beside its label rather than substituted into it,
  // so the coin marking it as gold stands next to the number and not in front of the word.
  forgeAgainstExpected: 'expected',
  forgeAgainstBadRun: 'a bad run',
  forgeAgainstUnder: 'under what the plan expected',
  forgeAgainstOver: 'over what the plan expected',
  forgeAgainstWorse: 'worse than a bad run',
  forgeAgainstExact: 'exactly what the plan expected',
  forgeAgainstNoPlan: 'No plan to compare against — this run was not started from the panel',
  forgeDone: 'Done',

  // account* — the Account screen: what the account could sell, who it belongs to, and what its
  // House and skill tree grant. The panels are shared drawings that take a label for every string
  // and never see a language; these are the words this app hands them.
  accountNavLabel: 'Account',
  accountPanelTitle: 'Your account',
  accountReadAge: 'Account read {age}',
  accountUnavailableTitle: 'Your account has not been read yet',
  accountUnavailableDescription: 'Open the game with the companion running and leave it open for a moment.',

  accountIdentityTip: 'Who this account belongs to and how far it has come, read from the game while it runs.',
  accountPlayerName: 'Player',
  accountIdLabel: 'Account ID',
  accountCurrentPhase: 'Current phase',
  accountMaxPhase: 'Furthest phase',

  accountHouse: 'House',
  accountHouseLevel: 'House level',
  accountHouseTip: 'Your House sets how long a hero spends recovering between deployments, and how many recover at once. The next House is shown at its own level 1, which is what you get the moment you unlock it.',
  accountHouseTipMaxed: 'Your House sets how long a hero spends recovering between deployments, and how many recover at once. Casa V is the last one — there is nothing above it.',
  accountHouseCycle: 'Recovery cycle',
  accountHouseCycleTip: 'One hero going from empty to full. Taken from the game when it reports a figure for this exact House and level, and otherwise read off the House’s own level 1 and level 20 figures.',
  accountHouseSlots: 'Recovery slots',
  accountHouseSlotsTip: 'How many heroes the House refills at the same time. Heroes beyond this wait at frozen energy until a slot frees up.',
  accountNextHouse: 'Next House — {house}',

  accountTreePanelTitle: 'Skill tree',
  accountTreeTip: 'Every account-wide bonus your skill tree grants, as the game totals them.',
  accountTreeGroupDamage: 'Damage',
  accountTreeGroupField: 'Field',
  accountTreeGroupRewards: 'Rewards',
  accountSquadDamage: 'Squad damage',
  accountGeoMultiplier: 'Multiplicative damage',
  accountTotalDamage: 'Total damage',
  accountTotalDamageTip: 'Total damage is the two above multiplied together, not a third bonus of its own: squad damage of {squad}% at a multiplier of {geo} lands on {total}. Every damage figure in this app already carries it, so never count squad or multiplicative damage on top again.',
  accountCritChance: 'Crit chance',
  accountCritDamage: 'Crit damage',
  accountSpeed: 'Speed',
  accountEnergy: 'Max energy',
  accountFieldSlots: 'Field slots',
  accountFieldSlotsTip: 'The game’s own summary shows what the tree adds; the total, counting the one slot every account starts with, is what actually caps your field.',
  accountBonusOfTotal: '{bonus} ({total} total)',
  accountGold: 'Gold per target',
  accountGoldTip: 'The skill tree’s gold bonus — it scales the gold every prop pays out.',
  accountLuck: 'Luck',
  accountXp: 'Hero experience',
  accountBagTabs: 'Bag tabs',

  accountHoldingsTotal: 'What this account could sell',
  accountHoldingsPartial: 'part of the account only',
  accountHoldingsCoverage: '{priced} of {eligible} sellable things priced right now',
  accountHoldingsMissing: 'Not counted here: {rows}.',
  accountHoldingsPricesOldest: 'oldest price {age}',
  accountHoldingsUnpriced: 'not listed',
  accountHoldingsInventory: 'Inventory',
  accountHoldingsInventoryCoverage: '{priced} of {eligible} tradable items priced',
  accountHoldingsInventoryWithheld: 'Your inventory has not been read yet',
  accountHoldingsInventoryLink: 'Open the inventory',
  accountHoldingsHeroes: 'Heroes',
  accountHoldingsHeroesCoverage: '{priced} of {eligible} sellable heroes priced',
  accountHoldingsHeroesWithheld: 'Your heroes have not been read yet',
  accountHoldingsHeroesFloor: 'A hero listing is priced by rarity alone — level, gear and abilities count for nothing — so this is a floor, never what a well built hero fetches.',
  accountHoldingsSkins: 'Skins in use',
  accountHoldingsSkinsCoverage: '{priced} of {eligible} bought skins priced',
  accountHoldingsSkinsWithheld: 'Your heroes have not been read yet',
  accountHoldingsSkinsWorn: 'A bought skin counts once however many heroes wear it, and only while one of them still does — dress every hero back to a birth skin and this figure falls with nothing sold.',

  // farm* — the Farm screen's own chrome. The board and the phase panels print their own
  // dictionary, which the farm package ships; these are the strings only this app owns.
  farmNavLabel: 'Farm',
  farmRefresh: 'Refresh',
  farmRefreshBusy: 'Working…',
  farmRefreshedAge: 'account read {age}',
  farmRefreshStale: 'out of date',
  farmUnavailableTitle: 'Not enough of your account has been read',
  farmUnavailableDescription: 'The board needs every part of your account. Open the game with the companion running and leave it open for a moment.',
  // The stat vocabulary the farm screen borrows from this app. Every other stat name comes from
  // the game data itself; loot-facing Luck is the one the shared map does not carry.
  farmStatColumn: 'Stat',
  farmStatLuck: 'Luck',

  // heroes* — the Heroes screen's own chrome, distinct from the hero* vocabulary below, which is
  // the shared per-hero field names the farm surfaces also read.
  heroesNavLabel: 'Heroes',
  heroesNeverReadTitle: 'Nothing read from your account yet',
  heroesNeverReadDescription: 'Open the game with the companion running, and your heroes will appear here.',
  heroesNoneTitle: 'This account has no heroes',
  heroesNoneDescription: 'Your account was read, and it holds nobody to show here yet.',
  heroesTabHero: 'Hero',
  heroesTabCombat: 'Combat',
  heroesTabGear: 'Gear',
  heroesTabPoints: 'Points',
  heroesRosterTitle: 'Your roster',
  heroesRosterListLabel: 'Your heroes, best birth roll first',
  heroesRollQualityLabel: 'Roll',
  heroesFiguresWithheldTitle: 'Not enough of your account has been read',
  heroesFiguresWithheldDescription: 'The per-hero numbers need your skill tree and your House. Leave the game open for a moment and they will fill in.',
  heroesPhaseTitle: 'Phase these numbers are for',
  heroesPhaseLabel: 'Phase',
  heroesPhaseUseFarm: 'Back to your Farm phase',
  heroesPhaseUnknownTitle: 'That is not a phase this app knows',
  heroesPhaseUnknownDescription: 'Pick a phase the game actually has, and the numbers come back.',
  heroesEffectiveTitle: 'Effective stats',
  heroesEffectiveTip: 'Includes gear, points, skill tree, abilities and team buffs.',
  heroesEffectiveGroupSheet: 'Sheet stats',
  heroesEffectiveGroupDerived: 'Derived combat',
  heroesEffectiveTriggerAria: 'Show breakdown of {stat}',

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
