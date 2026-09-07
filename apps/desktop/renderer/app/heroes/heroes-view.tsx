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
  HeroAbilitiesPanel,
  HeroCopyProvider,
  HeroIdentityRollPanel,
  HeroPickerDialogView,
  PhasesHeroPanel,
} from '@bombfarm/hero/components';
import { abilityGainFor, type AbilityGain } from '@bombfarm/domain/ability-gain';
import { statLabel } from '@bombfarm/domain/game-labels';
import { pipelineForHero } from '@bombfarm/domain/roster-dps';
import type { SheetKey } from '@bombfarm/domain/planner-constants';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { useCopy, useLocale } from '../../lib/copy';
import { useAccountView } from '../../lib/account/use-account-view';
import { farmScreenCopy, rosterCopyFrom, useFarmCopy, useHeroDetailCopy } from '../screen-copy';
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
  const { lang } = useLocale();
  const t = useCopy();
  const heroCopy = useHeroDetailCopy();
  const farmCopy = useFarmCopy();
  const [pickedHeroId, setPickedHeroId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // View-local, and stored nowhere: leaving the screen unmounts this and the next visit opens on
  // the Farm selection again. It outlives a hero switch on purpose — comparing two heroes at one
  // phase is the reason to override at all.
  const [overridePhase, setOverridePhase] = useState<number | null>(null);
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
          />
          <PhaseControl
            phase={shownHeroPhase(phaseReading, overridePhase)}
            overridden={overridePhase !== null}
            onOverridePhase={setOverridePhase}
            onClearOverride={onClearOverride}
          />
          <HeroCombat heroes={heroes} hero={active.hero} figures={figures} onSelectHero={onSelectHero} />
          <HeroAbilitiesPanel hero={active.hero} abilityGains={abilityGains} t={heroCopy} lang={lang} />
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
  figures,
  onSelectHero,
}: {
  heroes: HeroRecord[];
  hero: HeroRecord;
  figures: HeroFigures;
  onSelectHero: (hero: HeroRecord) => void;
}) {
  const t = useCopy();
  const combat = useMemo(
    () =>
      figures.kind === 'at'
        ? pipelineForHero(hero, figures.inputs.account, figures.inputs.phase, figures.inputs.mitigationPct)
        : null,
    [hero, figures],
  );

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
