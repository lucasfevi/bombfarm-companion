'use client';

import type { ReactNode } from 'react';
import { HeroAvatar } from '@bombfarm/game-art';
import { Button, Num, SegmentedToggle, Slider, Switch, cn, formatCompactNumber } from '@bombfarm/ui';
import { shareCardCopyFor, sub, type Lang, type ShareCardCopy } from '../../copy';
import {
  clampSharePhase,
  sharePicksFor,
  togglePick,
  type RosterHeroRow,
  type ShareCardSettings,
  type ShareFeature,
  type SharePickShortcut,
} from '../../model';
import { rarityIndexOf, shareEyebrowClass } from './share-card-parts';

export type ShareCopyStatus = 'idle' | 'copying' | 'copied' | 'failed';

export type SharePhaseBounds = {
  readonly accountPhase: number | null;
  readonly lastKnownPhase: number;
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
      <Field title={copy.featureTitle}>
        <SegmentedToggle
          ariaLabel={copy.featureTitle}
          options={[
            { id: 'power', label: copy.featurePower },
            { id: 'roll', label: copy.featureRoll },
          ]}
          value={settings.feature}
          onChange={(id) => {
            onSettings({ feature: id as ShareFeature });
          }}
        />
      </Field>
      <PhaseField phase={settings.phase} bounds={phaseBounds} onSettings={onSettings} copy={copy} />
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
        <Button
          variant="primary"
          className="justify-self-start"
          disabled={settings.picked.size === 0 || copyControl.status === 'copying'}
          onClick={copyControl.onCopy}
          data-testid="share-card-copy"
        >
          {copyControl.status === 'copying' ? copy.copying : copy.copyImage}
        </Button>
        <p
          className={cn('m-0', 'min-h-5', 'text-xs', copyControl.status === 'failed' ? 'text-down' : 'text-up')}
          aria-live="polite"
          data-testid="share-card-copy-status"
        >
          {copyControl.status === 'copied' ? copy.copied : copyControl.status === 'failed' ? copy.copyFailed : null}
        </p>
      </Field>
    </div>
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

function PhaseField({
  phase,
  bounds,
  onSettings,
  copy,
}: {
  phase: number;
  bounds: SharePhaseBounds;
  onSettings: (patch: SettingsPatch) => void;
  copy: ShareCardCopy;
}) {
  const setPhase = (value: number) => {
    const next = clampSharePhase(value, bounds.lastKnownPhase);
    if (next !== null && next !== phase) onSettings({ phase: next });
  };
  const accountPhase = bounds.accountPhase === null ? null : clampSharePhase(bounds.accountPhase, bounds.lastKnownPhase);
  return (
    <Field title={copy.phaseTitle}>
      <div className="grid grid-cols-[minmax(0,1fr)_88px] items-center gap-2.5" data-testid="share-card-phase">
        <Slider
          value={phase}
          min={1}
          max={bounds.lastKnownPhase}
          step={1}
          onValueChange={setPhase}
          aria-label={copy.phaseAria}
        />
        <Num
          value={phase}
          step={1}
          decimals={0}
          onChange={setPhase}
          incrementLabel={copy.phaseIncrement}
          decrementLabel={copy.phaseDecrement}
        />
      </div>
      {accountPhase === null ? null : (
        <Button
          variant="text"
          className="justify-self-start normal-case tracking-normal text-accent"
          disabled={accountPhase === phase}
          onClick={() => {
            setPhase(accountPhase);
          }}
          data-testid="share-card-phase-reset"
        >
          {sub(copy.phaseReset, { phase: accountPhase })}
        </Button>
      )}
    </Field>
  );
}

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
  return (
    <Field title={sub(copy.pickerTitle, { count: picked.size })}>
      <div className="flex gap-3">
        {PICK_SHORTCUTS.map((shortcut) => (
          <Button
            key={shortcut}
            variant="text"
            className="normal-case tracking-normal text-accent"
            onClick={() => {
              onSettings({ picked: sharePicksFor(rows, shortcut) });
            }}
            data-testid={`share-card-pick-${shortcut}`}
          >
            {shortcutLabel(shortcut, copy)}
          </Button>
        ))}
      </div>
      <ul
        className="m-0 grid max-h-85 list-none gap-0.5 overflow-y-auto rounded-sm border border-line bg-bg-2 p-1"
        data-testid="share-card-picker"
      >
        {rows.map((row) => (
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
