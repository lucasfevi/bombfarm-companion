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
import {
  Banner,
  Button,
  EmptyState,
  Num,
  Panel,
  cn,
  colClass,
  numberFormatterFor,
  panelHClass,
  panelTitleClass,
  type Lang,
} from '@bombfarm/ui';
import { HeroIdentityChip } from '@bombfarm/game-art';
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

  const onSelectHeroId = useCallback((heroId: string) => {
    setPickedHeroId(heroId);
  }, []);

  const onSelectHero = useCallback((hero: HeroRecord) => {
    setPickedHeroId(hero.id);
  }, []);

  const onOpenPicker = useCallback(() => {
    setPickerOpen(true);
  }, []);

  const onClearOverride = useCallback(() => {
    setOverridePhase(null);
  }, []);

  return (
    // Rail beside detail above 1100px, detail alone below it — the same side-by-side-or-stacked
    // threshold the phase board's own roster row is drawn at.
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-2.5 min-[1100px]:grid-cols-[19rem_minmax(0,1fr)]">
      <div className="min-w-0 max-[1099px]:hidden">
        <RosterRail rows={rows} selectedId={active.id} onSelectHeroId={onSelectHeroId} />
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
          <HeroIdentityRollPanel
            hero={active.hero}
            rollQuality={active.report}
            t={heroCopy}
            lang={lang}
            statLabel={boundStatLabel}
            marketPrice={marketPrice}
            formatAmount={formatAmount}
          />
          <PhaseControl
            phase={shownHeroPhase(phaseReading, overridePhase)}
            overridden={overridePhase !== null}
            onOverridePhase={setOverridePhase}
            onClearOverride={onClearOverride}
          />
          <HeroCombat
            heroes={heroes}
            hero={active.hero}
            combat={combat}
            figures={figures}
            onSelectHero={onSelectHero}
          />
          <HeroAbilitiesPanel hero={active.hero} abilityGains={abilityGains} t={heroCopy} lang={lang} />
          {figures.kind === 'at' && combat && (
            <HeroReference
              hero={active.hero}
              account={figures.inputs.account}
              combat={combat}
              rankMode={rankMode}
              onRankMode={setRankMode}
              formatNumber={boundFormatNumber}
            />
          )}
        </div>
      </HeroCopyProvider>
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
    case 'withheld':
      return (
        <Banner tone="warn" title={t.heroesFiguresWithheldTitle}>
          {t.heroesFiguresWithheldDescription}
        </Banner>
      );
    default:
      return (
        <PhasesHeroPanel
          heroes={heroes}
          hero={hero}
          combat={combat}
          phaseSelection={figures.selection}
          onSelectHero={onSelectHero}
        />
      );
  }
}

/**
 * The reference half of the detail: what to spend the next point on, then the tables the answer is
 * read out of — points placed, the stat sheet they build, the items feeding it, and finally how
 * each combat figure above was arrived at.
 *
 * Every one of these panels takes its editing callbacks as optional props, and this screen passes
 * none. That is the whole read-only posture: no stepper, no Reset, no Optimize build, no slot
 * editor, and a loadout comparison with no control that changes either loadout.
 * `heroes-read-only.test.ts` holds it there.
 */
function HeroReference({
  hero,
  account,
  combat,
  rankMode,
  onRankMode,
  formatNumber,
}: {
  hero: HeroRecord;
  account: AccountShared;
  combat: AdvisorPipelineResult;
  rankMode: RankMode;
  onRankMode: (next: RankMode) => void;
  formatNumber: (n: number, d?: number) => string;
}) {
  const { lang } = useLocale();
  const statCopy = useStatPanelCopy();
  const gearCopy = useGearPanelCopy();

  const ranking = useMemo(
    () => heroNextPointRanking(rankMode, combat.ranking),
    [rankMode, combat],
  );

  const facts: PipelineFacts = useMemo(
    () => ({
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
    }),
    [hero, account, combat],
  );

  return (
    <>
      <NextPointRanking
        t={statCopy}
        lang={lang}
        ranking={ranking}
        rankMode={rankMode}
        onRankMode={onRankMode}
      />
      <PointsTable
        t={statCopy}
        lang={lang}
        level={hero.level}
        pts={hero.pts}
        pipeline={combat}
        heroBattleAllowed={hero.battleAllowed !== false}
      />
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
      <GearTab
        t={gearCopy}
        lang={lang}
        loadout={hero.loadout}
        altLoadout={hero.altLoadout}
        pipeline={combat}
      />
      <HeroEffectiveStats t={statCopy} facts={facts} formatNumber={formatNumber} />
    </>
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
        <HeroIdentityChip hero={row.hero} fallbackName={row.hero.name} lang={lang} />
        {/* Roll quality is a column players read down, and the sans face this app ships has no
            tabular figures — so the mono face is what actually keeps the digits in line. */}
        <span className="shrink-0 font-mono text-xs tabular-nums text-muted">
          {rollQualityText(row, lang)}
        </span>
      </button>
    </li>
  );
}
