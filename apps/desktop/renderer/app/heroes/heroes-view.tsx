'use client';

/**
 * The Heroes screen — the whole roster down one side, and one hero's detail beside it.
 *
 * The panels are `@bombfarm/hero`'s; this file is their connector, the way the Farm screen's is
 * theirs. Every judgement it would otherwise take inside JSX lives in a sibling module and is
 * proved there: which hero is selected, how the roster is ordered, which of the two empty answers
 * to give, and whether the per-hero figures may be computed at all.
 *
 * Nothing here reads the game. It draws the account the shared seam already holds, and that seam
 * sits behind the consent gate with every other screen.
 */
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import {
  Banner,
  Button,
  EmptyState,
  Icon,
  Panel,
  Tabs,
  adviceSplitClass,
  cn,
  colClass,
  numberFormatterFor,
  panelHClass,
  panelTitleClass,
  type Lang,
} from '@bombfarm/ui';
import { HeroIdentityChip } from '@bombfarm/game-art';
import type { MarketQuoteCurrency } from '@bombfarm/contracts';
import { phaseSearchOptions } from '@bombfarm/farm';
import { CombatPhasePanel } from '@bombfarm/farm/components';
import {
  AbilitiesAurasPanel,
  CombatBreakdownPanel,
  GearTab,
  HeroAbilitiesPanel,
  HeroCopyProvider,
  HeroIdentityRollPanel,
  HeroRunesPanel,
  HeroPickerDialogView,
  NextPointRanking,
  PointsTable,
  RosterCards,
  RosterLeaderboard,
  RosterRail,
  RosterSummaryStrip,
  RosterToolbar,
  ShareCardDialog,
  SheetTable,
} from '@bombfarm/hero/components';
import type { ShareCardActions, ShareCardData } from '@bombfarm/hero/components';
import {
  DEFAULT_LEADERBOARD_VIEW,
  DEFAULT_ROSTER_BOARD_SORT,
  DEFAULT_SHOWCASE_VIEW,
  EMPTY_ROSTER_BOARD_FILTER,
  filterRosterRows,
  heroPickOutcome,
  sortRosterRows,
} from '@bombfarm/hero/model';
import type {
  HeroMarketPrice,
  LeaderboardStatSource,
  LeaderboardView,
  RosterBoardFilter,
  RosterBoardSort,
  RosterHeroRow,
  RosterViewMode,
  ShowcaseView,
} from '@bombfarm/hero/model';
import { resolveHeroPrice } from '@bombfarm/pricing';
import { RARITIES } from '@bombfarm/domain/planner-constants';
import { formatMoney } from '../../lib/format';
import { useMarketSnapshot } from '../../lib/market/use-market-snapshot';
import { abilityGainFor, type AbilityGain } from '@bombfarm/domain/ability-gain';
import type { AdvisorPipelineResult } from '@bombfarm/domain/advisor-pipeline';
import { statLabel } from '@bombfarm/domain/game-labels';
import type { RankMode } from '@bombfarm/domain/model';
import { advisorInputForHero, pipelineForHero } from '@bombfarm/domain/roster-dps';
import type { PipelineFacts } from '@bombfarm/domain/stat-breakdown';
import type { SheetKey } from '@bombfarm/domain/planner-constants';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { teamAuraDpsDeltas } from '@bombfarm/domain/team-aura-deltas';
import {
  TEAM_AURA_SWITCH_IDS,
  noTeamAuraSwitches,
  type TeamAuraSwitches,
  type TeamAuraId,
} from '@bombfarm/domain/team-buffs';
import { accountAroundHero, type AccountBlock } from '../../lib/account/account-shared';
import { rosterHeroStatSource } from '../../lib/account/account-roster';
import { useCopy, useLocale } from '../../lib/copy';
import { useAccountView } from '../../lib/account/use-account-view';
import {
  farmScreenCopy,
  rosterBoardCopyFrom,
  rosterCopyFrom,
  useFarmCopy,
  useGearPanelCopy,
  useHeroDetailCopy,
  useShareCardCopy,
  useStatPanelCopy,
} from '../screen-copy';
import { heroNextPointRanking } from './hero-detail-panels';
import { heroesScreenModel, type HeroesScreenModel } from './heroes-screen-model';
import { resolveSelectedHeroId, selectedRow } from './hero-selection';
import { LAST_KNOWN_PHASE, readHeroPhase, shownHeroPhase } from './hero-phase';
import { createShareCardDps } from './share-card-dps';
import { copyCardImage } from './copy-card-image';
import { useFarmSelectedPhase } from './use-farm-selected-phase';
import { heroFigures, type HeroFigures } from './hero-figures';
import { cachedAbilityGains, createAbilityGainCache } from './ability-gain-cache';

type RosterModel = Extract<HeroesScreenModel, { kind: 'roster' }>;

/** Every stat name but one comes from the game data itself; loot-facing Luck is the one the shared
 *  map does not carry, so this app supplies it — the same substitution the Farm screen makes. */
function sheetKeyLabel(key: SheetKey, lang: Lang, luckLabel: string): string {
  return key === 'luck' ? luckLabel : statLabel(key, lang);
}

export function HeroesView({ marketQuoteCurrency }: { marketQuoteCurrency: MarketQuoteCurrency }) {
  const t = useCopy();
  const account = useAccountView();
  const model = useMemo(() => heroesScreenModel(account), [account]);

  switch (model.kind) {
    case 'loading':
      return (
        <HeroesScreenFrame>
          <EmptyState title={t.shellLoadingLabel} />
        </HeroesScreenFrame>
      );
    case 'bridgeUnavailable':
      return (
        <HeroesScreenFrame>
          <EmptyState title={t.emptyBridgeUnavailableTitle} />
        </HeroesScreenFrame>
      );
    case 'readFailed':
      // The raw message from main is untranslatable English, so it is carried as diagnostic data
      // only and never rendered as player-facing copy — the same treatment the Farm screen gives it.
      return (
        <HeroesScreenFrame>
          <Banner tone="warn" title={t.errorAccountReadFailed} data-account-error-detail={model.message}>
            {t.errorAccountReadFailedDescription}
          </Banner>
        </HeroesScreenFrame>
      );
    case 'neverRead':
      return (
        <HeroesScreenFrame>
          <EmptyState icon="user-group" title={t.heroesNeverReadTitle} description={t.heroesNeverReadDescription} />
        </HeroesScreenFrame>
      );
    case 'noHeroes':
      return (
        <HeroesScreenFrame>
          <EmptyState icon="user-group" title={t.heroesNoneTitle} description={t.heroesNoneDescription} />
        </HeroesScreenFrame>
      );
    default:
      return (
        <HeroesScreenFrame>
          <HeroesRoster model={model} marketQuoteCurrency={marketQuoteCurrency} />
        </HeroesScreenFrame>
      );
  }
}

/** The test id six smoke specs locate this screen by lives on the frame, so it is present in every
 *  state the screen can be in — including the ones that draw no roster. */
function HeroesScreenFrame({ children }: { children: ReactNode }) {
  return (
    <div data-testid="heroes-view" className={cn(colClass, 'flex-1')}>
      {children}
    </div>
  );
}

function HeroesRoster({
  model,
  marketQuoteCurrency,
}: {
  model: RosterModel;
  marketQuoteCurrency: MarketQuoteCurrency;
}) {
  const { lang, locale } = useLocale();
  const t = useCopy();
  const heroCopy = useHeroDetailCopy();
  const farmCopy = useFarmCopy();
  const [pickedHeroId, setPickedHeroId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // View-local and stored nowhere, like the phase override and the rank mode below it: the board
  // is a way of looking at the roster you are in now, not a setting about this account.
  const [viewMode, setViewMode] = useState<RosterViewMode>('list');
  // The roster's order and narrowing, view-local like the mode itself: they are ways of looking
  // at the roster you are in now, not settings about this account. Shared by both presentations,
  // so switching between them never changes which heroes are on screen.
  const [rosterSort, setRosterSort] = useState<RosterBoardSort>(DEFAULT_ROSTER_BOARD_SORT);
  const [rosterFilter, setRosterFilter] = useState<RosterBoardFilter>(EMPTY_ROSTER_BOARD_FILTER);
  const [leaderboardView, setLeaderboardView] = useState<LeaderboardView>(DEFAULT_LEADERBOARD_VIEW);
  const [showcaseView, setShowcaseView] = useState<ShowcaseView>(DEFAULT_SHOWCASE_VIEW);
  // View-local, and stored nowhere: leaving the screen unmounts this and the next visit opens on
  // the Farm selection again. It outlives a hero switch on purpose — comparing two heroes at one
  // phase is the reason to override at all.
  const [overridePhase, setOverridePhase] = useState<number | null>(null);
  // Which target the next-point ranking is read against. View-local and stored nowhere, like the
  // phase override above — it changes what this screen prints, never anything on the account.
  const [rankMode, setRankMode] = useState<RankMode>('dps');
  // Which team auras the shown hero is priced under at their cap, on top of its own. All off on
  // every visit, like the phase override: a what-if that outlived the screen would inflate every
  // figure here with no control in sight to explain it.
  const [auraSwitches, setAuraSwitches] = useState<TeamAuraSwitches>(noTeamAuraSwitches);
  const onAuraSwitch = useCallback((buffId: TeamAuraId, enabled: boolean) => {
    setAuraSwitches((current) =>
      current[buffId] === enabled ? current : { ...current, [buffId]: enabled },
    );
  }, []);
  const farmPhase = useFarmSelectedPhase();

  const { rows, roster } = model;
  // The same tree and withheld heroes the detail pane composes and withholds its sheet against, read
  // straight off the account, so the table does not wait on a phase the way the per-hero figures do.
  const leaderboardStats = useMemo<LeaderboardStatSource>(() => rosterHeroStatSource(roster), [roster]);
  // The whole roster in the order the toolbar asks for, before any narrowing: the default
  // selection is whichever hero that order puts first, and a filter must not move it.
  const orderedRows = useMemo(() => sortRosterRows(rows, rosterSort), [rows, rosterSort]);
  // Re-resolved on every render rather than mirrored into an effect: the roster arrives from a
  // fresh parse on every account read, and a selection stored as anything but an id would follow
  // the list's shape instead of the hero's identity.
  const selectedId = resolveSelectedHeroId(pickedHeroId, orderedRows);
  const active = selectedRow(selectedId, orderedRows) ?? rows[0];

  const phaseReading = useMemo(
    () => readHeroPhase(farmPhase, overridePhase),
    [farmPhase, overridePhase],
  );
  const figures = useMemo(
    () => heroFigures(phaseReading, roster, active.hero.id),
    [phaseReading, roster, active.hero.id],
  );

  // The shown hero's own account: the shared block with its own aura total overlaid — its own
  // aura always, any other at its cap through the switches above.
  const heroAccount = useMemo(
    () =>
      figures.kind === 'at'
        ? accountAroundHero(figures.inputs.account, active.hero, auraSwitches, roster.heroes)
        : null,
    [active.hero, figures, auraSwitches, roster.heroes],
  );

  // One pipeline run for the whole detail pane. Every panel below the identity panel reads off it
  // — combat, the ranking, the stat sheet, the items and the breakdown — so running it once here
  // is what keeps a hero switch from costing five identical runs.
  const combat = useMemo(
    () =>
      figures.kind === 'at' && heroAccount
        ? pipelineForHero(active.hero, heroAccount, figures.inputs.phase, figures.inputs.mitigationPct)
        : null,
    [active.hero, figures, heroAccount],
  );

  // What each aura switch would do to sustained DPS: one more run per aura, on the same input.
  const auraDeltas = useMemo(
    () =>
      figures.kind === 'at' && heroAccount && combat
        ? teamAuraDpsDeltas(
            advisorInputForHero(active.hero, heroAccount, figures.inputs.phase, figures.inputs.mitigationPct),
            combat.dps,
          )
        : NO_AURA_DELTAS,
    [active.hero, figures, heroAccount, combat],
  );

  const gainsCache = useRef(createAbilityGainCache());
  const abilityGains =
    figures.kind === 'at' && heroAccount
      ? cachedAbilityGains(
          gainsCache.current,
          abilityGainFor,
          active.hero,
          heroAccount,
          figures.inputs.phase,
          figures.inputs.mitigationPct,
          [figures.inputs.account, auraSwitches],
        )
      : NO_ABILITY_GAINS;

  const boundStatLabel = useCallback(
    (key: SheetKey) => sheetKeyLabel(key, lang, t.farmStatLuck),
    [lang, t],
  );
  const boundFormatNumber = useMemo(() => numberFormatterFor(lang), [lang]);

  // A hero's market identity is its rarity alone, so this needs no item def. The panel is handed
  // the number rather than the snapshot, so it carries none of the market vocabulary itself.
  const { snapshot } = useMarketSnapshot();
  const marketPrice = useMemo(
    () =>
      resolveHeroPrice(
        { rarity: RARITIES.indexOf(active.hero.rarity), marketable: active.hero.marketable ?? false },
        snapshot,
        marketQuoteCurrency,
      ),
    [active.hero, snapshot, marketQuoteCurrency],
  );
  const formatAmount = useCallback(
    (value: number, currency: string) => formatMoney(value, locale, currency),
    [locale],
  );
  const pickerCopy = useMemo(() => rosterCopyFrom(t), [t]);
  const rosterCopy = useMemo(() => rosterBoardCopyFrom(t), [t]);
  const panelCopy = useMemo(() => farmScreenCopy(farmCopy, t), [farmCopy, t]);
  const heroes = useMemo(() => rows.map((row) => row.hero), [rows]);

  const onSelectHeroId = useCallback(
    (heroId: string) => {
      const outcome = heroPickOutcome(viewMode, heroId);
      setPickedHeroId(outcome.heroId);
      if (outcome.showDetail) setViewMode('list');
    },
    [viewMode],
  );

  const onSelectHero = useCallback((hero: HeroRecord) => {
    setPickedHeroId(hero.id);
  }, []);

  // What either presentation draws. `active` is resolved from the WHOLE roster above, so
  // narrowing the list never changes which hero the detail beside it is about — a filter is a
  // question about the roster, not a hero switch.
  const shownRows = useMemo(
    () => filterRosterRows(orderedRows, rosterFilter),
    [orderedRows, rosterFilter],
  );
  const toolbarActions = useMemo(
    () => ({ onSort: setRosterSort, onFilter: setRosterFilter, onViewMode: setViewMode }),
    [],
  );

  const onOpenPicker = useCallback(() => {
    setPickerOpen(true);
  }, []);

  // "Back to your current phase" drops the aura switches with the phase pick: the two are the
  // same kind of what-if, and a reader clearing one expects the figures to be the account's.
  const onClearOverride = useCallback(() => {
    setOverridePhase(null);
    setAuraSwitches(noTeamAuraSwitches());
  }, []);

  return (
    <div className={cn(colClass, 'min-h-0 flex-1')}>
      <RosterSummaryStrip
        rows={rows}
        maxPhase={roster.account.maxPhase}
        lang={lang}
      />
      {/* The toolbar is the web planner's too; sharing is this app's alone, so it sits beside it
          rather than inside it. */}
      <div className="flex min-w-0 items-start gap-2.5">
        <div className="min-w-0 flex-1">
          <RosterToolbar
            rows={rows}
            sort={rosterSort}
            filter={rosterFilter}
            viewMode={viewMode}
            actions={toolbarActions}
            t={rosterCopy}
            lang={lang}
          />
        </div>
        <RosterShare rows={rows} roster={roster} lang={lang} />
      </div>
      {/* One presentation at a time, cross-faded: `mode="wait"` lets the outgoing one finish
          before the incoming one lays out, which is what keeps a board of twenty-two cards from
          measuring itself against a rail that is still on screen. `reducedMotion="user"` turns
          the whole thing off for a reader who asked for that. */}
      <MotionConfig reducedMotion="user">
        <AnimatePresence mode="wait" initial={false}>
          {viewMode === 'cards' ? (
            <motion.div
              key="cards"
              className="min-w-0"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <RosterCards
                rows={shownRows}
                selectedId={active.id}
                onSelectHeroId={onSelectHeroId}
                view={showcaseView}
                onViewChange={setShowcaseView}
                t={rosterCopy}
                lang={lang}
              />
            </motion.div>
          ) : viewMode === 'table' ? (
            <motion.div
              key="table"
              className="min-w-0"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <RosterLeaderboard
                rows={shownRows}
                statSource={leaderboardStats}
                view={leaderboardView}
                onViewChange={setLeaderboardView}
                selectedId={active.id}
                onSelectHeroId={onSelectHeroId}
                t={rosterCopy}
                lang={lang}
              />
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              // Rail beside detail above 1100px, detail alone below it — the same
              // side-by-side-or-stacked threshold the phase board's own roster row is drawn at.
              className="grid min-h-0 grid-cols-1 gap-2.5 min-[1100px]:grid-cols-[19rem_minmax(0,1fr)]"
            >
              <div className="min-w-0 max-[1099px]:hidden">
                <RosterRail
                  rows={shownRows}
                  selectedId={active.id}
                  onSelectHeroId={onSelectHeroId}
                  t={rosterCopy}
                  lang={lang}
                />
              </div>
              <HeroCopyProvider t={panelCopy} lang={lang}>
                <div className={cn(colClass, 'min-w-0')}>
                  {/* The rail's stand-in below that width: the same roster, reached through the picker. */}
                  <Panel className="min-[1100px]:hidden">
                    <div className={panelHClass}>
                      <h2 className={panelTitleClass}>{t.heroesRosterTitle}</h2>
                      <Button variant="ghost" onClick={onOpenPicker}>
                        {t.switchHeroShort}
                      </Button>
                    </div>
                    <HeroIdentityChip hero={active.hero} fallbackName={active.hero.name} lang={lang} />
                  </Panel>
                  <HeroDetailTabs
                    active={active}
                    heroCopy={heroCopy}
                    lang={lang}
                    abilityGains={abilityGains}
                    combat={combat}
                    figures={figures}
                    phase={shownHeroPhase(phaseReading, overridePhase)}
                    overridden={overridePhase !== null}
                    onOverridePhase={setOverridePhase}
                    onClearOverride={onClearOverride}
                    auraSwitches={auraSwitches}
                    auraDeltas={auraDeltas}
                    onAuraSwitch={onAuraSwitch}
                    rankMode={rankMode}
                    onRankMode={setRankMode}
                    statLabel={boundStatLabel}
                    marketPrice={marketPrice}
                    formatAmount={formatAmount}
                  />
                </div>
              </HeroCopyProvider>
            </motion.div>
          )}
        </AnimatePresence>
      </MotionConfig>
      <HeroPickerDialogView
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        lang={lang}
        t={pickerCopy}
        data={{ heroes, heroId: active.id, formatNumber: boundFormatNumber }}
        actions={{ onSelectHero }}
      />
    </div>
  );
}

function writeClipboardImage(png: Uint8Array) {
  const bridge = (window as unknown as { bfc?: NonNullable<Window['bfc']> }).bfc;
  if (bridge === undefined) return Promise.resolve({ ok: false as const, reason: 'write-failed' as const });
  return bridge.invoke('clipboard:writeImage', png);
}

const SHARE_ACTIONS: ShareCardActions = {
  copyImage: (card) => copyCardImage(card, writeClipboardImage),
};

function RosterShare({ rows, roster, lang }: { rows: RosterModel['rows']; roster: RosterModel['roster']; lang: Lang }) {
  const [open, setOpen] = useState(false);
  const shareCopy = useShareCardCopy();
  const data = useMemo<ShareCardData>(
    () => ({
      rows,
      identity: {
        playerName: roster.account.playerName ?? null,
        accountId: roster.account.accountId ?? null,
        phase: roster.account.phase,
        maxPhase: roster.account.maxPhase ?? null,
      },
      lastKnownPhase: LAST_KNOWN_PHASE,
      phaseOptions: phaseSearchOptions(lang),
      dpsAt: createShareCardDps(roster),
    }),
    [rows, roster, lang],
  );
  return (
    <>
      <Button
        variant="ghost"
        className="inline-flex shrink-0 items-center gap-1.5"
        onClick={() => {
          setOpen(true);
        }}
        data-testid="heroes-share-open"
      >
        <Icon name="share" size="sm" />
        {shareCopy.openButton}
      </Button>
      <ShareCardDialog open={open} onOpenChange={setOpen} data={data} actions={SHARE_ACTIONS} lang={lang} />
    </>
  );
}

/**
 * The detail pane's four stages, grouped the way the web planner groups its three.
 *
 * Hero, Combat, Gear and Points hold what the planner's tabs of those names hold, panel for
 * panel — both apps draw them from one implementation, so a player who has learned one has
 * learned the other. The phase control lives on Combat, beside the figures it was added for.
 *
 * Which stage is open is view-local and stored nowhere, like the phase override and the rank mode
 * beside it — leaving the screen and coming back opens on the hero again.
 */
function HeroDetailTabs({
  active,
  heroCopy,
  lang,
  abilityGains,
  combat,
  figures,
  phase,
  overridden,
  onOverridePhase,
  onClearOverride,
  auraSwitches,
  auraDeltas,
  onAuraSwitch,
  rankMode,
  onRankMode,
  statLabel: boundStatLabel,
  marketPrice,
  formatAmount,
}: {
  active: RosterHeroRow;
  heroCopy: ReturnType<typeof useHeroDetailCopy>;
  lang: Lang;
  abilityGains: readonly AbilityGain[];
  combat: AdvisorPipelineResult | null;
  figures: HeroFigures;
  phase: number;
  overridden: boolean;
  onOverridePhase: (phase: number) => void;
  onClearOverride: () => void;
  auraSwitches: TeamAuraSwitches;
  auraDeltas: Record<TeamAuraId, number>;
  onAuraSwitch: (buffId: TeamAuraId, on: boolean) => void;
  rankMode: RankMode;
  onRankMode: (next: RankMode) => void;
  statLabel: (key: SheetKey) => string;
  marketPrice: HeroMarketPrice | null;
  formatAmount: (value: number, currency: string) => string;
}) {
  const t = useCopy();
  const statCopy = useStatPanelCopy();
  const [tab, setTab] = useState('hero');

  return (
    <Tabs.Root value={tab} onValueChange={setTab}>
      <Tabs.List>
        <Tabs.Tab value="hero">{t.heroesTabHero}</Tabs.Tab>
        <Tabs.Tab value="combat">{t.heroesTabCombat}</Tabs.Tab>
        <Tabs.Tab value="gear">{t.heroesTabGear}</Tabs.Tab>
        <Tabs.Tab value="points">{t.heroesTabPoints}</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panels>
        <Tabs.Panel value="hero">
          <div className={colClass}>
            <HeroIdentityRollPanel
              hero={active.hero}
              rollQuality={active.report}
              t={heroCopy}
              lang={lang}
              statLabel={boundStatLabel}
              marketPrice={marketPrice}
              formatAmount={formatAmount}
            />
            <HeroAbilitiesPanel
              hero={active.hero}
              abilityGains={abilityGains}
              t={heroCopy}
              lang={lang}
            />
          </div>
        </Tabs.Panel>
        <Tabs.Panel value="combat">
          {/* Mounted only while shown: the stage holds no state of its own (the phase override
              lives above it), and its picker and breakdown would otherwise re-render on every
              account read while another stage is open. */}
          {tab === 'combat' ? (
            <div className={colClass}>
              {/* The phase the figures below were computed at. It is the only control on this
                  screen that changes what a stage prints, and it changes Points as well as this
                  one — Points has no control of its own and follows whatever is set here. */}
              <CombatPhasePanel
                phase={phase}
                overridden={overridden}
                onOverridePhase={onOverridePhase}
                onClearOverride={onClearOverride}
                lang={lang}
              />
              {/* On the record, not a figure: a still-blocked hero shows its runes all the same. */}
              <HeroRunesPanel hero={active.hero} lang={lang} statLabel={boundStatLabel} />
              {figures.kind !== 'at' ? <FiguresNotice figures={figures} /> : null}
              {/* The combat sheet those figures were computed from — beside them rather than at the
                  bottom of Points, where it was the one phase-scoped panel in a stage of sheet
                  arithmetic. */}
              {figures.kind === 'at' && combat ? (
                <CombatBreakdownPanel
                  t={statCopy}
                  facts={effectiveFacts(active.hero, figures.inputs.account, combat)}
                  hero={active.hero}
                  phase={figures.inputs.phase}
                  switches={auraSwitches}
                  lang={lang}
                />
              ) : null}
              {/* What those figures were priced with, last: the hero's own abilities, and every
                  team aura the game has behind a switch. A switch is a what-if held like the
                  phase pick above, and it reaches Gear and Points as the phase does. */}
              {figures.kind === 'at' ? (
                <AbilitiesAurasPanel
                  hero={active.hero}
                  phase={figures.inputs.phase}
                  switches={auraSwitches}
                  deltas={auraDeltas}
                  onSwitch={onAuraSwitch}
                  lang={lang}
                />
              ) : null}
            </div>
          ) : null}
        </Tabs.Panel>
        <Tabs.Panel value="gear">
          {figures.kind === 'at' && combat ? (
            <HeroGear hero={active.hero} combat={combat} />
          ) : (
            <FiguresNotice figures={figures} />
          )}
        </Tabs.Panel>
        <Tabs.Panel value="points">
          {figures.kind === 'at' && combat ? (
            <HeroReference
              hero={active.hero}
              combat={combat}
              rankMode={rankMode}
              onRankMode={onRankMode}
            />
          ) : (
            <FiguresNotice figures={figures} />
          )}
        </Tabs.Panel>
      </Tabs.Panels>
    </Tabs.Root>
  );
}

/**
 * Why a phase-scoped stage has nothing to print.
 *
 * Every stage but Hero is computed at a phase, so the three fail together and for the same two
 * reasons. Saying so on the stage the player is actually looking at is what keeps an unreadable
 * phase from reading as a blank panel.
 */
function FiguresNotice({ figures }: { figures: HeroFigures }) {
  const t = useCopy();

  switch (figures.kind) {
    case 'pending':
      return null;
    case 'unknownPhase':
      return (
        <Banner tone="warn" title={t.heroesPhaseUnknownTitle}>
          {t.heroesPhaseUnknownDescription}
        </Banner>
      );
    case 'pointsUnread':
      return (
        <Banner tone="warn" title={t.heroesPointsUnreadTitle}>
          {t.heroesPointsUnreadDescription}
        </Banner>
      );
    default:
      return (
        <Banner tone="warn" title={t.heroesFiguresWithheldTitle}>
          {t.heroesFiguresWithheldDescription}
        </Banner>
      );
  }
}

/** One frozen empty array, so a screen with nothing to compute hands the panel the same reference
 *  on every render rather than a fresh one that re-renders it. */
const NO_ABILITY_GAINS: readonly AbilityGain[] = Object.freeze([]);

const NO_AURA_DELTAS: Record<TeamAuraId, number> = Object.freeze(
  Object.fromEntries(TEAM_AURA_SWITCH_IDS.map((auraId) => [auraId, 0])) as Record<TeamAuraId, number>,
);

/**
 * What the per-statistic breakdown reads: one hero, the account it shares, and the pipeline run
 * they produced. A plain function rather than a hook, so the Combat stage can build it at the
 * point of use without a second pipeline run.
 */
function effectiveFacts(
  hero: HeroRecord,
  account: AccountBlock,
  combat: AdvisorPipelineResult,
): PipelineFacts {
  return {
    geared: hero.gearedOverride,
    adjusted: combat.adjusted,
    pts: hero.pts,
    delta: combat.pointDelta,
    effective: combat.effective,
    mods: combat.mods,
    sheetOther: combat.sheetOther,
    naked: hero.naked,
    level: hero.level,
    stars: hero.stars,
    attackMult: combat.attackMult,
    energyMult: combat.energyMult,
    speedMult: combat.speedMult,
    teamCritFlat: combat.teamCritFlat,
    teamPenFlat: combat.teamPenFlat,
    packMult: combat.packMult,
    entryPulseMult: combat.entryPulse.expectedMult,
    treeSpeed: account.tree.speed,
    treeCritChance: account.tree.critChance,
    treeCritDmg: account.tree.critDmg,
    treeEnergy: account.tree.energy,
    treeLuckFlatPct: combat.treeSheet.luckFlatPct,
    context: combat.context,
    dmgMult: combat.hitMult * combat.entryPulse.expectedMult,
    treeDanoTotal: account.tree.danoTotal,
    // The planner's Math-check override, which this app has no surface for.
    extraDmgPct: 0,
    active: combat.active,
    dps: combat.dps,
    uptime: combat.uptime,
    rest: combat.rest,
    runes: hero.runes,
  };
}

/**
 * The Points stage: the points placed and what to spend the next one on, then the stat sheet they
 * build. Stacked in the planner's own order, and the first pair sits side by side at the same
 * width the planner pairs them at.
 *
 * Every one of these panels takes its editing callbacks as optional props, and this screen passes
 * none. That is the whole read-only posture: no stepper, no Reset, no Optimize build, no slot
 * editor, and a loadout comparison with no control that changes either loadout.
 * `heroes-read-only.test.ts` holds it there.
 */
function HeroReference({
  hero,
  combat,
  rankMode,
  onRankMode,
}: {
  hero: HeroRecord;
  combat: AdvisorPipelineResult;
  rankMode: RankMode;
  onRankMode: (next: RankMode) => void;
}) {
  const { lang } = useLocale();
  const statCopy = useStatPanelCopy();

  const ranking = useMemo(
    () => heroNextPointRanking(rankMode, combat.ranking),
    [rankMode, combat],
  );

  return (
    <div className={colClass}>
      <div className={adviceSplitClass}>
        <PointsTable
          t={statCopy}
          lang={lang}
          level={hero.level}
          pts={hero.pts}
          pipeline={combat}
          heroBattleAllowed={hero.battleAllowed !== false}
        />
        <NextPointRanking
          t={statCopy}
          lang={lang}
          ranking={ranking}
          rankMode={rankMode}
          onRankMode={onRankMode}
        />
      </div>
      <SheetTable
        t={statCopy}
        lang={lang}
        input={{
          birth: hero.birth,
          level: hero.level,
          stars: hero.stars,
          sheetOther: combat.sheetOther,
          loadout: hero.loadout,
          pts: hero.pts,
          tree: combat.treeSheet,
          runes: hero.runes,
        }}
      />
    </div>
  );
}

/** The Gear stage — the planner's own Items panel, handed no editing callback. */
function HeroGear({ hero, combat }: { hero: HeroRecord; combat: AdvisorPipelineResult }) {
  const { lang } = useLocale();
  const gearCopy = useGearPanelCopy();

  return (
    <GearTab
      t={gearCopy}
      lang={lang}
      loadout={hero.loadout}
      altLoadout={hero.altLoadout}
      pipeline={combat}
    />
  );
}
