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
  Num,
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
import {
  HeroIdentityChip,
  InventoryLayoutToggle,
  rosterInactiveChromeClass,
} from '@bombfarm/game-art';
import {
  GearTab,
  HeroAbilitiesPanel,
  HeroCopyProvider,
  HeroIdentityRollPanel,
  HeroPickerDialogView,
  NextPointRanking,
  PhasesHeroPanel,
  PointsTable,
  SheetTable,
} from '@bombfarm/hero/components';
import type { HeroMarketPrice } from '@bombfarm/hero/model';
import { resolveHeroPrice } from '@bombfarm/pricing';
import { RARITIES } from '@bombfarm/domain/planner-constants';
import { formatMoney } from '../../lib/format';
import { HOLDINGS_CURRENCY } from '../../lib/account/account-holdings';
import { useMarketSnapshot } from '../../lib/market/use-market-snapshot';
import { abilityGainFor, type AbilityGain } from '@bombfarm/domain/ability-gain';
import type { AdvisorPipelineResult } from '@bombfarm/domain/advisor-pipeline';
import { statLabel } from '@bombfarm/domain/game-labels';
import type { RankMode } from '@bombfarm/domain/model';
import { pipelineForHero } from '@bombfarm/domain/roster-dps';
import type { PipelineFacts } from '@bombfarm/domain/stat-breakdown';
import type { SheetKey } from '@bombfarm/domain/planner-constants';
import type { AccountShared, HeroRecord } from '@bombfarm/domain/shims/storage';
import { useCopy, useLocale } from '../../lib/copy';
import { useAccountView } from '../../lib/account/use-account-view';
import {
  farmScreenCopy,
  rosterCopyFrom,
  useFarmCopy,
  useGearPanelCopy,
  useHeroDetailCopy,
  useStatPanelCopy,
} from '../screen-copy';
import { heroNextPointRanking } from './hero-detail-panels';
import { HeroEffectiveStats } from './hero-effective-stats';
import { heroesScreenModel, type HeroesScreenModel } from './heroes-screen-model';
import { rollQualityText, type RosterHeroRow } from './hero-roster-order';
import { resolveSelectedHeroId, selectedRow } from './hero-selection';
import { readHeroPhase, shownHeroPhase } from './hero-phase';
import { useFarmSelectedPhase } from './use-farm-selected-phase';
import { heroFigures, type HeroFigures } from './hero-figures';
import { RosterCards } from './roster-cards';
import { RosterToolbar } from './roster-toolbar';
import { heroPickOutcome, type RosterViewMode } from './roster-view-mode';
import {
  rosterRowsShown,
  DEFAULT_ROSTER_SORT,
  EMPTY_ROSTER_FILTER,
  type RosterFilter,
  type RosterSort,
} from './roster-order';
import { cachedAbilityGains, createAbilityGainCache } from './ability-gain-cache';

type RosterModel = Extract<HeroesScreenModel, { kind: 'roster' }>;

/** Every stat name but one comes from the game data itself; loot-facing Luck is the one the shared
 *  map does not carry, so this app supplies it — the same substitution the Farm screen makes. */
function sheetKeyLabel(key: SheetKey, lang: Lang, luckLabel: string): string {
  return key === 'luck' ? luckLabel : statLabel(key, lang);
}

export function HeroesView() {
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
          <HeroesRoster model={model} />
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

function HeroesRoster({ model }: { model: RosterModel }) {
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
  const [rosterSort, setRosterSort] = useState<RosterSort>(DEFAULT_ROSTER_SORT);
  const [rosterFilter, setRosterFilter] = useState<RosterFilter>(EMPTY_ROSTER_FILTER);
  // View-local, and stored nowhere: leaving the screen unmounts this and the next visit opens on
  // the Farm selection again. It outlives a hero switch on purpose — comparing two heroes at one
  // phase is the reason to override at all.
  const [overridePhase, setOverridePhase] = useState<number | null>(null);
  // Which target the next-point ranking is read against. View-local and stored nowhere, like the
  // phase override above — it changes what this screen prints, never anything on the account.
  const [rankMode, setRankMode] = useState<RankMode>('dps');
  const farmPhase = useFarmSelectedPhase();

  const { rows, roster } = model;
  // Re-resolved on every render rather than mirrored into an effect: the roster arrives from a
  // fresh parse on every account read, and a selection stored as anything but an id would follow
  // the list's shape instead of the hero's identity.
  const selectedId = resolveSelectedHeroId(pickedHeroId, rows);
  const active = selectedRow(selectedId, rows) ?? rows[0];

  const phaseReading = useMemo(
    () => readHeroPhase(farmPhase, overridePhase),
    [farmPhase, overridePhase],
  );
  const figures = useMemo(() => heroFigures(phaseReading, roster), [phaseReading, roster]);

  // One pipeline run for the whole detail pane. Every panel below the identity panel reads off it
  // — combat, the ranking, the stat sheet, the items and the breakdown — so running it once here
  // is what keeps a hero switch from costing five identical runs.
  const combat = useMemo(
    () =>
      figures.kind === 'at'
        ? pipelineForHero(
            active.hero,
            figures.inputs.account,
            figures.inputs.phase,
            figures.inputs.mitigationPct,
          )
        : null,
    [active.hero, figures],
  );

  const gainsCache = useRef(createAbilityGainCache());
  const abilityGains =
    figures.kind === 'at'
      ? cachedAbilityGains(
          gainsCache.current,
          abilityGainFor,
          active.hero,
          figures.inputs.account,
          figures.inputs.phase,
          figures.inputs.mitigationPct,
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
        HOLDINGS_CURRENCY,
      ),
    [active.hero, snapshot],
  );
  const formatAmount = useCallback(
    (value: number, currency: string) => formatMoney(value, locale, currency),
    [locale],
  );
  const pickerCopy = useMemo(() => rosterCopyFrom(t), [t]);
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
    () => rosterRowsShown(rows, rosterFilter, rosterSort),
    [rows, rosterFilter, rosterSort],
  );
  const toolbarActions = useMemo(
    () => ({ onSort: setRosterSort, onFilter: setRosterFilter }),
    [],
  );

  const viewToggleLabels = useMemo(
    () => ({ group: t.heroesViewLabel, cards: t.heroesViewCards, list: t.heroesViewList }),
    [t],
  );

  const onOpenPicker = useCallback(() => {
    setPickerOpen(true);
  }, []);

  const onClearOverride = useCallback(() => {
    setOverridePhase(null);
  }, []);

  const toolbar = (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2.5">
      <RosterToolbar
        rows={rows}
        sort={rosterSort}
        filter={rosterFilter}
        actions={toolbarActions}
      />
      {/* The Inventory's own control, for the same two shapes: one pair of glyphs means one
          thing wherever this app switches between a board and a list. */}
      <InventoryLayoutToggle layout={viewMode} onChange={setViewMode} labels={viewToggleLabels} />
    </div>
  );

  return (
    <div className={cn(colClass, 'min-h-0 flex-1')}>
      {toolbar}
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
                statLabel={boundStatLabel}
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
                    heroes={heroes}
                    heroCopy={heroCopy}
                    lang={lang}
                    abilityGains={abilityGains}
                    combat={combat}
                    figures={figures}
                    phase={shownHeroPhase(phaseReading, overridePhase)}
                    overridden={overridePhase !== null}
                    onOverridePhase={setOverridePhase}
                    onClearOverride={onClearOverride}
                    rankMode={rankMode}
                    onRankMode={setRankMode}
                    statLabel={boundStatLabel}
                    formatNumber={boundFormatNumber}
                    marketPrice={marketPrice}
                    formatAmount={formatAmount}
                    onSelectHero={onSelectHero}
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

/**
 * The detail pane's four stages, grouped the way the web planner groups its three.
 *
 * Hero, Gear and Points hold what the planner's tabs of those names hold, panel for panel — both
 * apps draw them from one implementation, so a player who has learned one has learned the other.
 * Combat is the fourth because this screen computes something the planner has no tab for: the
 * phase-scoped figures, which over there are folded into the hero strip above the tab list. The
 * phase control lives on it, beside the figures it was added for.
 *
 * Which stage is open is view-local and stored nowhere, like the phase override and the rank mode
 * beside it — leaving the screen and coming back opens on the hero again.
 */
function HeroDetailTabs({
  active,
  heroes,
  heroCopy,
  lang,
  abilityGains,
  combat,
  figures,
  phase,
  overridden,
  onOverridePhase,
  onClearOverride,
  rankMode,
  onRankMode,
  statLabel: boundStatLabel,
  formatNumber,
  marketPrice,
  formatAmount,
  onSelectHero,
}: {
  active: RosterHeroRow;
  heroes: HeroRecord[];
  heroCopy: ReturnType<typeof useHeroDetailCopy>;
  lang: Lang;
  abilityGains: readonly AbilityGain[];
  combat: AdvisorPipelineResult | null;
  figures: HeroFigures;
  phase: number;
  overridden: boolean;
  onOverridePhase: (phase: number) => void;
  onClearOverride: () => void;
  rankMode: RankMode;
  onRankMode: (next: RankMode) => void;
  statLabel: (key: SheetKey) => string;
  formatNumber: (n: number, d?: number) => string;
  marketPrice: HeroMarketPrice | null;
  formatAmount: (value: number, currency: string) => string;
  onSelectHero: (hero: HeroRecord) => void;
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
          <div className={colClass}>
            {/* The phase the figures below were computed at. It is the only control on this
                screen that changes what a stage prints, and it changes Points as well as this
                one — Points has no control of its own and follows whatever is set here. */}
            <PhaseControl
              phase={phase}
              overridden={overridden}
              onOverridePhase={onOverridePhase}
              onClearOverride={onClearOverride}
            />
            <HeroCombat
              heroes={heroes}
              hero={active.hero}
              combat={combat}
              figures={figures}
              onSelectHero={onSelectHero}
            />
            {/* The combat sheet those figures were computed from — beside them rather than at the
                bottom of Points, where it was the one phase-scoped panel in a stage of sheet
                arithmetic. */}
            {figures.kind === 'at' && combat ? (
              <HeroEffectiveStats
                t={statCopy}
                facts={effectiveFacts(active.hero, figures.inputs.account, combat)}
                formatNumber={formatNumber}
              />
            ) : null}
          </div>
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

function PhaseControl({
  phase,
  overridden,
  onOverridePhase,
  onClearOverride,
}: {
  phase: number;
  overridden: boolean;
  onOverridePhase: (phase: number) => void;
  onClearOverride: () => void;
}) {
  const t = useCopy();

  return (
    <Panel focus>
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.heroesPhaseTitle}</h2>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex w-29 shrink-0 flex-col gap-[3px] text-[11px] tracking-[0.03em] text-muted uppercase">
          <span>{t.heroesPhaseLabel}</span>
          <Num value={phase} onChange={onOverridePhase} step={1} decimals={0} />
        </label>
        <Button variant="ghost" onClick={onClearOverride} disabled={!overridden}>
          {t.heroesPhaseUseFarm}
        </Button>
      </div>
    </Panel>
  );
}

/**
 * The phase-scoped half of the detail. `PhasesHeroPanel` names the phase it was computed at and
 * whether that phase came from the Farm screen or from this screen's own override — which is why
 * the selection travels with the figures rather than being restated here.
 */
function HeroCombat({
  heroes,
  hero,
  combat,
  figures,
  onSelectHero,
}: {
  heroes: HeroRecord[];
  hero: HeroRecord;
  combat: AdvisorPipelineResult | null;
  figures: HeroFigures;
  onSelectHero: (hero: HeroRecord) => void;
}) {
  if (figures.kind !== 'at') return <FiguresNotice figures={figures} />;

  return (
    <PhasesHeroPanel
      heroes={heroes}
      hero={hero}
      combat={combat}
      phaseSelection={figures.selection}
      onSelectHero={onSelectHero}
      breakdownShownElsewhere
    />
  );
}

/**
 * What the per-statistic breakdown reads: one hero, the account it shares, and the pipeline run
 * they produced. A plain function rather than a hook, so the Combat stage can build it at the
 * point of use without a second pipeline run.
 */
function effectiveFacts(
  hero: HeroRecord,
  account: AccountShared,
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
    critDmgMult: combat.critDmgMult,
    teamCritFlat: combat.teamCritFlat,
    treeSpeed: account.tree.speed,
    treeCritChance: account.tree.critChance,
    treeCritDmg: account.tree.critDmg,
    treeEnergy: account.tree.energy,
    treeLuckFlatPct: combat.treeSheet.luckFlatPct,
    context: combat.context,
    dmgMult: combat.dmgMult,
    treeDanoTotal: account.tree.danoTotal,
    // The planner's Math-check override, which this app has no surface for.
    extraDmgPct: 0,
    active: combat.active,
    dps: combat.dps,
    uptime: combat.uptime,
    rest: combat.rest,
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

function RosterRail({
  rows,
  selectedId,
  onSelectHeroId,
}: {
  rows: readonly RosterHeroRow[];
  selectedId: string;
  onSelectHeroId: (heroId: string) => void;
}) {
  const t = useCopy();
  const { lang } = useLocale();

  return (
    <Panel className="min-w-0">
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.heroesRosterTitle}</h2>
        <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">
          {t.heroesRollQualityLabel}
        </span>
      </div>
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0" aria-label={t.heroesRosterListLabel}>
        {rows.map((row) => (
          <RosterRailRow
            key={row.id}
            row={row}
            lang={lang}
            selected={row.id === selectedId}
            onSelectHeroId={onSelectHeroId}
          />
        ))}
      </ul>
    </Panel>
  );
}

function RosterRailRow({
  row,
  lang,
  selected,
  onSelectHeroId,
}: {
  row: RosterHeroRow;
  lang: Lang;
  selected: boolean;
  onSelectHeroId: (heroId: string) => void;
}) {
  const inactiveChrome = row.hero.battleAllowed === false ? rosterInactiveChromeClass : undefined;

  return (
    <li>
      <button
        type="button"
        data-testid={`heroes-roster-row-${row.id}`}
        aria-current={selected ? 'true' : undefined}
        onClick={() => {
          onSelectHeroId(row.id);
        }}
        className={cn(
          'flex',
          'w-full',
          'min-w-0',
          'cursor-pointer',
          'items-center',
          'justify-between',
          'gap-2',
          'rounded-sm',
          'px-1.5',
          'py-1',
          'text-left',
          selected
            ? 'bg-[color-mix(in_oklch,var(--accent)_10%,transparent)] shadow-[inset_3px_0_0_var(--accent)]'
            : 'hover:bg-[color-mix(in_oklch,var(--accent)_6%,transparent)]',
        )}
      >
        {/* A shelved hero is greyed here exactly as it is on the board and in the picker. The
            mute rides on the row's contents, never on the row's own selection chrome. */}
        <span className={cn('flex', 'min-w-0', 'flex-1', 'items-center', 'gap-2', inactiveChrome)}>
          <HeroIdentityChip hero={row.hero} fallbackName={row.hero.name} lang={lang} />
        </span>
        {/* Roll quality is a column players read down, and the sans face this app ships has no
            tabular figures — so the mono face is what actually keeps the digits in line. */}
        <span className={cn('shrink-0', 'font-mono', 'text-xs', 'tabular-nums', 'text-muted', inactiveChrome)}>
          {rollQualityText(row, lang)}
        </span>
      </button>
    </li>
  );
}
