'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { rarityLabel } from '@bombfarm/domain/game-labels';
import { RARITIES } from '@bombfarm/domain/planner-constants';
import { HeroAvatar, inventoryChipRecipe, inventoryFieldClass, rarityTextClass } from '@bombfarm/game-art';
import {
  Button,
  Icon,
  SearchSelect,
  Switch,
  cn,
  formatCompactNumber,
  formatNumber,
  selectFieldHeightClass,
  type SearchSelectOption,
} from '@bombfarm/ui';
import { heroCopyFor, shareCardCopyFor, sub, type Lang, type ShareCardCopy } from '../../copy';
import {
  EMPTY_SHARE_PICKER_FILTER,
  clampSharePhase,
  filterSharePickerRows,
  sharePickerRarities,
  sharePicksFor,
  togglePick,
  toggleSharePickerRarity,
  type RosterHeroRow,
  type ShareCardSettings,
  type SharePickShortcut,
} from '../../model';
import { rarityIndexOf, shareEyebrowClass } from './share-card-parts';

export type ShareCopyStatus = 'idle' | 'copying' | 'copied' | 'failed';

export type SharePhaseBounds = {
  readonly accountPhase: number | null;
  readonly lastKnownPhase: number;
  /** Every phase the picker offers, under the app's one phase spelling — the host's to supply. */
  readonly options: readonly SearchSelectOption[];
};

export type ShareCopyControl = {
  readonly status: ShareCopyStatus;
  readonly onCopy: () => void;
};

type SettingsPatch = Partial<ShareCardSettings>;

const PICK_SHORTCUTS: readonly SharePickShortcut[] = ['squad', 'everyone', 'none'];

function shortcutLabel(shortcut: SharePickShortcut, copy: ShareCardCopy): string {
  if (shortcut === 'squad') return copy.pickSquad;
  if (shortcut === 'everyone') return copy.pickEveryone;
  return copy.pickNone;
}

export function ShareCardControls({
  rows,
  settings,
  onSettings,
  phaseBounds,
  copyControl,
  lang,
}: {
  /** Every hero on the roster, strongest first — the picker offers them all. */
  rows: readonly RosterHeroRow[];
  settings: ShareCardSettings;
  onSettings: (patch: SettingsPatch) => void;
  phaseBounds: SharePhaseBounds;
  copyControl: ShareCopyControl;
  lang: Lang;
}) {
  const copy = shareCardCopyFor(lang);
  return (
    <div className="grid min-w-0 content-start gap-[18px]" data-testid="share-card-controls">
      <PhaseField phase={settings.phase} bounds={phaseBounds} onSettings={onSettings} copy={copy} lang={lang} />
      <HeroPicker rows={rows} picked={settings.picked} onSettings={onSettings} copy={copy} lang={lang} />
      <Field title={copy.showTitle}>
        <ShowSwitch label={copy.showGear} checked={settings.showGear} onChange={(showGear) => { onSettings({ showGear }); }} testId="share-card-show-gear" />
        <ShowSwitch label={copy.showAuras} checked={settings.showAuras} onChange={(showAuras) => { onSettings({ showAuras }); }} testId="share-card-show-auras" />
        <ShowSwitch
          label={copy.showAccountNumber}
          checked={settings.showAccountNumber}
          onChange={(showAccountNumber) => {
            onSettings({ showAccountNumber });
          }}
          testId="share-card-show-account"
        />
      </Field>
      <Field title={copy.shareTitle}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Button
            variant="primary"
            disabled={settings.picked.size === 0 || copyControl.status === 'copying'}
            onClick={copyControl.onCopy}
            data-testid="share-card-copy"
          >
            {copyControl.status === 'copying' ? copy.copying : copy.copyImage}
          </Button>
          <CopyStatus status={copyControl.status} copy={copy} />
        </div>
      </Field>
    </div>
  );
}

/** The check and the word the Optimizer's ledger marks a finished step with. */
function CopyStatus({ status, copy }: { status: ShareCopyStatus; copy: ShareCardCopy }) {
  return (
    <p
      className={cn('m-0', 'flex', 'min-h-5', 'items-center', 'gap-1.5', 'text-xs', status === 'failed' ? 'text-down' : 'text-up')}
      aria-live="polite"
      data-testid="share-card-copy-status"
    >
      {status === 'copied' ? (
        <>
          <span className="flex size-4 shrink-0 items-center justify-center" data-testid="share-card-copied-icon">
            <Icon name="check-circle" className="size-4 text-up" />
          </span>
          {copy.copied}
        </>
      ) : status === 'failed' ? (
        copy.copyFailed
      ) : null}
    </p>
  );
}

function Field({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid min-w-0 gap-2">
      <p className={shareEyebrowClass}>{title}</p>
      {children}
    </section>
  );
}

/** The Combat tab's and the Optimizer's searchable phase picker, with the way back to the
 *  account's own phase beside it. */
function PhaseField({
  phase,
  bounds,
  onSettings,
  copy,
  lang,
}: {
  phase: number;
  bounds: SharePhaseBounds;
  onSettings: (patch: SettingsPatch) => void;
  copy: ShareCardCopy;
  lang: Lang;
}) {
  const heroCopy = heroCopyFor(lang);
  const setPhase = (value: number) => {
    const next = clampSharePhase(value, bounds.lastKnownPhase);
    if (next !== null && next !== phase) onSettings({ phase: next });
  };
  const accountPhase = bounds.accountPhase === null ? null : clampSharePhase(bounds.accountPhase, bounds.lastKnownPhase);
  return (
    <Field title={copy.phaseTitle}>
      <div className="grid min-w-0 gap-2" data-testid="share-card-phase">
        <SearchSelect
          aria-label={copy.phaseAria}
          options={bounds.options}
          value={String(phase)}
          onValueChange={(next) => {
            setPhase(Number.parseInt(next, 10));
          }}
          searchPlaceholder={heroCopy.heroDetailPhaseSearchPlaceholder}
          emptyLabel={heroCopy.heroDetailPhaseNoMatch}
          overflowLabel={(shown, matched) =>
            sub(heroCopy.heroDetailPhaseMoreMatches, {
              shown: formatNumber(shown, lang, 0),
              matched: formatNumber(matched, lang, 0),
            })
          }
        />
        {accountPhase === null ? null : (
          <Button
            variant="ghost"
            className={cn(selectFieldHeightClass, 'justify-self-start')}
            disabled={accountPhase === phase}
            onClick={() => {
              setPhase(accountPhase);
            }}
            data-testid="share-card-phase-reset"
          >
            {sub(copy.phaseReset, { phase: accountPhase })}
          </Button>
        )}
      </div>
    </Field>
  );
}

/** The name filter and rarity chips narrow the list shown; they never take a hero off the card. */
function HeroPicker({
  rows,
  picked,
  onSettings,
  copy,
  lang,
}: {
  rows: readonly RosterHeroRow[];
  picked: ReadonlySet<string>;
  onSettings: (patch: SettingsPatch) => void;
  copy: ShareCardCopy;
  lang: Lang;
}) {
  const [filter, setFilter] = useState(EMPTY_SHARE_PICKER_FILTER);
  const rarities = useMemo(() => sharePickerRarities(rows), [rows]);
  const shown = useMemo(() => filterSharePickerRows(rows, filter), [rows, filter]);
  return (
    <Field title={sub(copy.pickerTitle, { count: picked.size })}>
      <div className="flex flex-wrap gap-1.5">
        {PICK_SHORTCUTS.map((shortcut) => (
          <Button
            key={shortcut}
            onClick={() => {
              onSettings({ picked: sharePicksFor(rows, shortcut) });
            }}
            data-testid={`share-card-pick-${shortcut}`}
          >
            {shortcutLabel(shortcut, copy)}
          </Button>
        ))}
      </div>
      <input
        type="search"
        value={filter.text}
        onChange={(event) => {
          setFilter({ ...filter, text: event.target.value });
        }}
        placeholder={copy.pickerFilterPlaceholder}
        aria-label={copy.pickerFilterLabel}
        className={cn(inventoryFieldClass, 'w-full', 'min-w-0')}
        data-testid="share-card-picker-filter"
      />
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={copy.pickerRarityLabel}>
        {rarities.map((rarityIdx) => {
          const rarity = RARITIES[rarityIdx];
          if (rarity === undefined) return null;
          const active = filter.rarities.includes(rarityIdx);
          return (
            <button
              key={rarityIdx}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setFilter(toggleSharePickerRarity(filter, rarityIdx));
              }}
              className={cn(inventoryChipRecipe({ active }), !active && rarityTextClass(rarityIdx))}
              data-testid={`share-card-picker-rarity-${String(rarityIdx)}`}
            >
              {rarityLabel(rarity, lang)}
            </button>
          );
        })}
      </div>
      <ul
        className="m-0 grid max-h-85 list-none gap-0.5 overflow-y-auto rounded-sm border border-line bg-bg-2 p-1"
        data-testid="share-card-picker"
      >
        {shown.length === 0 ? (
          <li className="px-1.5 py-1 text-[13px] text-muted" data-testid="share-card-picker-empty">
            {copy.pickerNoMatch}
          </li>
        ) : null}
        {shown.map((row) => (
          <li key={row.id}>
            <label className="grid cursor-pointer grid-cols-[auto_28px_minmax(0,1fr)_auto] items-center gap-2 rounded-sm px-1.5 py-1 text-[13px] hover:bg-surface">
              <input
                type="checkbox"
                checked={picked.has(row.id)}
                onChange={(event) => {
                  onSettings({ picked: togglePick(picked, row.id, event.target.checked) });
                }}
                data-testid={`share-card-pick-hero-${row.id}`}
              />
              <HeroAvatar skin={row.hero.skin ?? 0} rarityIdx={rarityIndexOf(row.hero)} size="xs" name={row.hero.name} />
              <span className="min-w-0 truncate text-ink">
                {row.hero.name}{' '}
                <span className="text-xs text-muted">{sub(copy.pickerLevel, { level: row.hero.level })}</span>
              </span>
              <span className="font-mono text-xs text-muted tabular-nums">
                {row.hero.power == null ? '—' : formatCompactNumber(row.hero.power, lang)}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </Field>
  );
}

function ShowSwitch({
  label,
  checked,
  onChange,
  testId,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  testId: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted" data-testid={testId}>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
      {label}
    </label>
  );
}
