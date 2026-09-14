'use client';

import { useCallback, useRef, type ReactNode } from 'react';
import { abilityName } from '@bombfarm/domain/game-labels';
import type { BreakdownStatId, FormulaPart, FormulaTermKey, StatBreakdown } from '@bombfarm/domain/stat-breakdown';
import { AbilityIcon } from '@bombfarm/game-art';
import { Tooltip, cn, mutedClass } from '@bombfarm/ui';
import { sub, type HeroCopy, type HeroCopyKey, type Lang, type StatPanelCopy } from '../copy';
import { groupLabel, ledgerStepNote, ledgerStepText } from '../model/breakdown-labels';
import { ledgerLines, type BreakdownCardData, type CardInputChip, type CardNote } from '../model/combat-breakdown';

const FORMULA_KEY: Partial<Record<BreakdownStatId, HeroCopyKey>> = {
  mitF: 'heroDetailBreakdownFormulaMitF',
  dmg: 'heroDetailBreakdownFormulaDmg',
  critFactor: 'heroDetailBreakdownFormulaCritFactor',
  fuse: 'heroDetailBreakdownFormulaFuse',
  fieldSeconds: 'heroDetailBreakdownFormulaField',
  rest: 'heroDetailBreakdownFormulaRest',
  hit: 'heroDetailBreakdownFormulaHit',
  criticalHit: 'heroDetailBreakdownFormulaCriticalHit',
  avgHit: 'heroDetailBreakdownFormulaAvgHit',
  bombsPerSecond: 'heroDetailBreakdownFormulaBombs',
  uptime: 'heroDetailBreakdownFormulaUptime',
  activeDps: 'heroDetailBreakdownFormulaActive',
  sustainedDps: 'heroDetailBreakdownFormulaSustained',
};

const TERM_KEY: Record<FormulaTermKey, HeroCopyKey> = {
  phaseMit: 'heroDetailBreakdownTermPhaseMit',
  penetration: 'heroDetailBreakdownTermPenetration',
  abilities: 'heroDetailBreakdownTermAbilities',
  pack: 'heroDetailBreakdownTermPack',
  extra: 'heroDetailBreakdownTermExtra',
  pulse: 'heroDetailBreakdownTermPulse',
  attack: 'heroDetailBreakdownTermAttack',
  mitF: 'heroDetailBreakdownTermMitF',
  dmg: 'heroDetailBreakdownTermDmg',
  hit: 'heroDetailBreakdownTermHit',
  critChance: 'heroDetailBreakdownTermCritChance',
  critDmg: 'heroDetailBreakdownTermCritDmg',
  critFactor: 'heroDetailBreakdownTermCritFactor',
  cdr: 'heroDetailBreakdownTermCdr',
  fuseFloor: 'heroDetailBreakdownTermFuseFloor',
  fuse: 'heroDetailBreakdownTermFuse',
  walk: 'heroDetailBreakdownTermWalk',
  band: 'heroDetailBreakdownTermBand',
  cycle: 'heroDetailBreakdownTermCycle',
  energy: 'heroDetailBreakdownTermEnergy',
  drain: 'heroDetailBreakdownTermDrain',
  restSeconds: 'heroDetailBreakdownTermRestSeconds',
  field: 'heroDetailBreakdownTermField',
  avgHit: 'heroDetailBreakdownTermAvgHit',
  bombs: 'heroDetailBreakdownTermBombs',
  range: 'heroDetailBreakdownTermRange',
  activeDps: 'heroDetailBreakdownTermActiveDps',
};

export function cardFormulaText(copy: HeroCopy, id: BreakdownStatId): string | null {
  const key = FORMULA_KEY[id];
  return key ? copy[key] : null;
}

export function penetrationText(copy: HeroCopy, note: Extract<CardNote, { kind: 'penetration' }>, formatNumber: (n: number, d?: number) => string): string {
  return note.reading.kind === 'covers'
    ? copy.heroDetailBreakdownPenCovers
    : sub(copy.heroDetailBreakdownPenShort, { gap: formatNumber(note.reading.gapPct, 1) });
}

function noteText(copy: HeroCopy, note: CardNote, lang: Lang, formatNumber: (n: number, d?: number) => string): string {
  switch (note.kind) {
    case 'fuseAtCeiling':
      return sub(copy.heroDetailBreakdownNoteFuseAtCeiling, { floor: formatNumber(note.floorSecs, 1), cap: formatNumber(note.capPct, 0) });
    case 'fuseFloor':
      return sub(copy.heroDetailBreakdownNoteFuseFloor, { floor: formatNumber(note.floorSecs, 1), cap: formatNumber(note.capPct, 0) });
    case 'avgHitEqualsHit':
      return copy.heroDetailBreakdownNoteAvgHitEqualsHit;
    case 'fieldWithoutTeamDrain':
      return sub(copy.heroDetailBreakdownNoteFieldWithoutTeamDrain, { name: abilityName(note.auraId, lang), secs: formatNumber(note.seconds, 0) });
    case 'penetration':
      return penetrationText(copy, note, formatNumber);
  }
}

function NamedFormula({ parts, copy }: { parts: readonly FormulaPart[]; copy: HeroCopy }) {
  return (
    <p className="m-0 font-mono text-[11px] leading-1.7 break-words text-muted" data-testid="breakdown-formula">
      {parts.map((part, index) =>
        typeof part === 'string' ? (
          <span key={index}>{part}</span>
        ) : (
          <span key={index} className="whitespace-nowrap">
            <b className="font-semibold text-ink">{part.text}</b>
            <span className="ml-0.5 font-sans text-[9px] tracking-[0.04em] uppercase">{copy[TERM_KEY[part.key]]}</span>
          </span>
        ),
      )}
    </p>
  );
}

/** A sheet stat's ledger, one line per run of the same game line, each line's steps beside it. */
function GroupedLedger({
  t,
  formatNumber,
  steps,
}: {
  t: StatPanelCopy;
  formatNumber: (n: number, d?: number) => string;
  steps: Extract<StatBreakdown, { kind: 'ledger' }>['steps'];
}) {
  const lines = ledgerLines(steps);
  return (
    <ol className="m-0 list-none p-0 text-[11px]" data-testid="breakdown-ledger">
      {lines.map((line, index) => (
        <li
          key={`${line.group}-${index}`}
          className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-x-3 border-b border-[color-mix(in_oklch,var(--line)_45%,transparent)] py-1 last:border-b-0"
          data-ledger-group={line.group}
        >
          <span className="min-w-0">
            <span className="font-semibold text-ink">{groupLabel(t, line.source)}</span>
            {line.steps.map((step, stepIndex) => {
              const note = ledgerStepNote(t, formatNumber, step);
              return note ? (
                <span key={stepIndex} className={cn('block text-[10px] leading-snug', mutedClass)}>
                  {note}
                </span>
              ) : null;
            })}
          </span>
          <span className="text-right font-mono tabular-nums text-accent">
            {line.steps.map((step, stepIndex) => (
              <span key={stepIndex} className="block">
                {ledgerStepText(step, formatNumber)}
              </span>
            ))}
          </span>
          <span className="text-right font-mono font-semibold tabular-nums text-ink">{formatNumber(line.running, 2)}</span>
        </li>
      ))}
    </ol>
  );
}

function InputChips({ chips, heading }: { chips: readonly CardInputChip[]; heading: string }) {
  if (chips.length === 0) return null;
  return (
    <ul className="m-0 mt-2 flex list-none flex-wrap gap-1 p-0" aria-label={heading} data-testid="breakdown-reads">
      {chips.map((chip) => (
        <li
          key={chip.label}
          className={cn(
            'rounded-sm border px-1.5 text-[10px] leading-4',
            chip.on ? 'border-accent text-accent' : 'border-line text-muted line-through',
          )}
        >
          {chip.label}
        </li>
      ))}
    </ul>
  );
}

/** The dictionaries and formatter every card reads, handed down once. */
export type BreakdownText = {
  readonly t: StatPanelCopy;
  readonly copy: HeroCopy;
  readonly lang: Lang;
  readonly formatNumber: (n: number, d?: number) => string;
};

export type CombatBreakdownCardProps = {
  card: BreakdownCardData;
  label: string;
  value: string;
  text: BreakdownText;
  lit: boolean;
  onLit: (id: BreakdownStatId | null) => void;
  cardRef: (element: HTMLElement | null) => void;
};

/**
 * One figure of the pipeline: its label, its value, the short form of what it is computed from,
 * and at its bottom edge the abilities and auras that reach it. Hovering or focusing it opens the
 * same popover on either layout — the ledger for a sheet stat, the substituted formula with every
 * term named for a derived one — and tells the panel to light the wires that feed it.
 */
export function CombatBreakdownCard({ card, label, value, text, lit, onLit, cardRef }: CombatBreakdownCardProps) {
  const { id, breakdown, badges, chips, note } = card;
  const { t, copy, lang, formatNumber } = text;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const setRoot = useCallback(
    (element: HTMLDivElement | null) => {
      rootRef.current = element;
      cardRef(element);
    },
    [cardRef],
  );
  const formula = cardFormulaText(copy, id);
  const isDps = id === 'activeDps' || id === 'sustainedDps';
  const penetration = note?.kind === 'penetration' ? penetrationText(copy, note, formatNumber) : null;

  const body: ReactNode =
    breakdown.kind === 'ledger' ? (
      <GroupedLedger t={t} formatNumber={formatNumber} steps={breakdown.steps} />
    ) : (
      <NamedFormula parts={breakdown.parts} copy={copy} />
    );

  const face = (
    <div
      tabIndex={0}
      className="flex min-w-0 flex-1 flex-col gap-0.5 px-2 pt-1.5 pb-1 outline-none focus-visible:ring-1 focus-visible:ring-accent"
    >
      <div className="flex min-w-0 items-baseline justify-between gap-2 @min-[820px]:flex-col @min-[820px]:items-stretch @min-[820px]:gap-0">
        <span className="min-w-0 text-[11px] leading-tight font-medium text-ink">{label}</span>
        <span
          className="shrink-0 font-mono text-[13px] font-semibold tabular-nums text-ink @min-[820px]:text-right"
          data-testid="breakdown-value"
        >
          {value}
        </span>
      </div>
      {formula ? (
        <span className="font-mono text-[9.5px] leading-tight break-words text-muted" data-testid="breakdown-symbolic">
          {formula}
        </span>
      ) : null}
      {penetration ? (
        <span
          className={cn(
            'text-[10px] leading-tight',
            note?.kind === 'penetration' && note.reading.kind === 'covers' ? 'text-up' : 'text-down',
          )}
          data-testid="breakdown-penetration"
        >
          {penetration}
        </span>
      ) : null}
    </div>
  );

  return (
    <div
      ref={setRoot}
      data-breakdown-card={id}
      data-lit={lit ? 'true' : undefined}
      onPointerEnter={() => onLit(id)}
      onPointerLeave={() => onLit(null)}
      onFocus={() => onLit(id)}
      onBlur={() => onLit(null)}
      className={cn(
        'relative flex min-w-0 flex-col rounded-sm border bg-bg',
        isDps ? 'border-[color-mix(in_oklch,var(--accent)_55%,var(--line))] bg-[color-mix(in_oklch,var(--accent)_10%,var(--bg))]' : 'border-line',
        lit && 'border-accent',
        '@min-[820px]:h-full',
      )}
    >
      <Tooltip.Root>
        <Tooltip.Trigger render={face} />
        <Tooltip.Portal>
          <Tooltip.Positioner side="bottom" sideOffset={6} anchor={rootRef}>
            <Tooltip.Popup className="max-w-104" data-testid={`breakdown-popover-${id}`}>
              <p className="m-0 mb-1 flex items-baseline justify-between gap-3 text-[12px] font-semibold text-ink">
                <span>{label}</span>
                <span className="font-mono tabular-nums">{value}</span>
              </p>
              {body}
              <InputChips chips={chips} heading={copy.heroDetailBreakdownReads} />
              {note && note.kind !== 'penetration' ? (
                <p className={cn('m-0 mt-2 text-[11px] leading-snug', mutedClass)}>{noteText(copy, note, lang, formatNumber)}</p>
              ) : null}
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
      {badges.length > 0 ? (
        <ul className="m-0 flex list-none flex-wrap gap-1 px-2 pb-1.5 @min-[820px]:mt-auto" data-testid="breakdown-badges">
          {badges.map((badge) => {
            const name = abilityName(badge.abilityId, lang);
            const text = badge.on ? name : sub(copy.heroDetailBreakdownIconOff, { name });
            return (
              <li key={badge.abilityId} data-badge={badge.abilityId} data-on={badge.on ? 'true' : 'false'}>
                <Tooltip.Root>
                  <Tooltip.Trigger
                    render={
                      <span
                        tabIndex={0}
                        aria-label={text}
                        className="inline-flex rounded-sm outline-none focus-visible:ring-1 focus-visible:ring-accent"
                      >
                        <AbilityIcon code={badge.abilityId} size="xs" className={cn(!badge.on && 'opacity-35')} />
                      </span>
                    }
                  />
                  <Tooltip.Portal>
                    <Tooltip.Positioner side="top" sideOffset={4}>
                      <Tooltip.Popup>{text}</Tooltip.Popup>
                    </Tooltip.Positioner>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
