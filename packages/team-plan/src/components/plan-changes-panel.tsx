'use client';

/**
 * What broke the plan since it was computed: a hero it placed, or a piece it used, is gone.
 * Folded by default — the title and a one-line count are all that show; opening it reveals the
 * table. Everything the plan expected, made progress on, or does not care about is not this
 * panel's business: the plan is still good until something it depended on disappears, so a host
 * only ever mounts this panel once there is a breaking row to show.
 */
import { useMemo } from 'react';
import { Button, Collapsible, cn, panelTitleClass } from '@bombfarm/ui';
import { HeroIdentityChip, ItemIcon } from '@bombfarm/game-art';
import { abilityName, itemName, itemRarityLabel } from '@bombfarm/domain/game-labels';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import type { InventoryItem } from '@bombfarm/domain/inventory';
import type { HeroRune } from '@bombfarm/domain/runes';
import { sub, type Lang } from '@bombfarm/hero/copy';
import type { TeamPlanScreenCopy } from '../copy';
import type { PlanBasis, PlanChange, PlanChangeLedger, TreeAxis } from '../core/plan-changes';
import type { TeamPlanInputs } from '../core/team-plan-inputs';
import type { ScopeState } from '../core/hero-scope';
import { formatTreeAxisValue } from './plan-changes-format';

type Copy = TeamPlanScreenCopy;

/** A value that was not there, or is not there any more. Punctuation, so the same in both languages. */
const NONE = '—';

const RUNE_AXIS_STAT = { attack: 'attack', energy: 'energy', speed: 'speed', crit: 'critChance', critdmg: 'critDmg', cdr: 'cdr' } as const;
const TREE_AXIS_STAT = {
  treeDanoTotal: 'attack',
  treeEnergy: 'energy',
  treeSpeed: 'speed',
  treeCritChance: 'critChance',
  treeCritDmg: 'critDmg',
  treeLuckFlatPct: 'luck',
} as const;

function runeAxisLabel(axis: HeroRune['axis'], t: Copy): string {
  if (axis === 'xp') return t.teamPlanChangesXp;
  if (axis === 'gold') return t.teamPlanChangesRuneAxisGold;
  return t.statShort[RUNE_AXIS_STAT[axis]];
}

function treeAxisLabel(axis: TreeAxis, t: Copy): string {
  if (axis === 'treeTeamCoinPct') return t.teamPlanChangesTreeTeamCoin;
  if (axis === 'treeXpMult') return t.teamPlanChangesXp;
  return t.statShort[TREE_AXIS_STAT[axis]];
}

function scopeLabel(scope: ScopeState, t: Copy): string {
  return scope === 'optimize' ? t.teamPlanScopeOptimize : scope === 'donate' ? t.teamPlanScopeDonate : t.teamPlanScopeLeaveAlone;
}

const forge = (upgrade: number) => `+${String(upgrade)}`;

/** A hero, named for a chip; or a plain word. `before`/`after`/an "asked" note draw the chip
 *  when the value is a hero, and just print the word otherwise — the inventory word is always
 *  the latter, since there is no piece to show an identity for. */
export type PlanChangeCellValue = { kind: 'hero'; id: string; name: string } | { kind: 'text'; value: string };

/** The "plan asked …" note: plain words, or words split around the hero the plan asked for. */
export type PlanChangeNote =
  | { kind: 'text'; value: string }
  | { kind: 'askedHero'; before: string; hero: { id: string; name: string }; after: string };

/** Every cell of one row, already worded: the change's field name, its two values and the note
 *  after them ("plan asked +14", "as planned"). Exported for the test, which reads words. */
export type PlanChangeRow = { change: string; before: PlanChangeCellValue; after: PlanChangeCellValue; note: PlanChangeNote | null };

function text(value: string): PlanChangeCellValue {
  return { kind: 'text', value };
}

function heroRef(heroId: string, heroNames: ReadonlyMap<string, string>): { id: string; name: string } {
  return { id: heroId, name: heroNames.get(heroId) ?? heroId };
}

/** Who wears a piece, or the inventory word when it wears no one. */
function who(heroId: string | null, t: Copy, heroNames: ReadonlyMap<string, string>): PlanChangeCellValue {
  return heroId === null ? text(t.teamPlanChangesInventory) : { kind: 'hero', ...heroRef(heroId, heroNames) };
}

/** `'plan asked {value}'` split around its own placeholder, so a hero name can be a chip instead
 *  of a word spliced into the sentence. */
function splitAskedTemplate(template: string): [string, string] {
  const [before, after] = template.split('{value}');
  return [before ?? '', after ?? ''];
}

export function wordPlanChange(entry: PlanChange, t: Copy, lang: Lang, heroNames: ReadonlyMap<string, string>): PlanChangeRow {
  const none = NONE;
  const d = entry.detail;
  switch (d.field) {
    case 'heroAdded':
      return { change: `${t.teamPlanChangesHeroAdded} · ${t.rankLv} ${String(d.level)}`, before: text(''), after: text(''), note: null };
    case 'heroRemoved':
      return { change: d.used ? t.teamPlanChangesHeroRemovedUsed : t.teamPlanChangesHeroRemoved, before: text(''), after: text(''), note: null };
    case 'level':
      return { change: t.teamPlanChangesLevel, before: text(String(d.before)), after: text(String(d.after)), note: null };
    case 'stars':
      return { change: t.teamPlanChangesStars, before: text(String(d.before)), after: text(String(d.after)), note: null };
    case 'points': {
      const note = d.asked === null ? null : d.asked === d.after ? { kind: 'text' as const, value: t.teamPlanChangesAskedDone } : { kind: 'text' as const, value: sub(t.teamPlanChangesAsked, { value: d.asked }) };
      return { change: sub(t.teamPlanChangesPoints, { stat: t.statShort[d.stat] }), before: text(String(d.before)), after: text(String(d.after)), note };
    }
    case 'pointsAvailable':
      return { change: t.teamPlanChangesPointsAvailable, before: text(String(d.before)), after: text(String(d.after)), note: null };
    case 'ability':
      return { change: sub(t.teamPlanChangesAbility, { ability: abilityName(d.abilityId, lang) }), before: text(String(d.before)), after: text(String(d.after)), note: null };
    case 'runeGained':
      return { change: sub(t.teamPlanChangesRuneGained, { axis: runeAxisLabel(d.axis, t), pct: d.strengthPct }), before: text(none), after: text(''), note: null };
    case 'runeLost':
      return { change: sub(t.teamPlanChangesRuneLost, { axis: runeAxisLabel(d.axis, t), pct: d.strengthPct }), before: text(''), after: text(none), note: null };
    case 'heroOther':
      return { change: t.teamPlanChangesHeroOther, before: text(''), after: text(''), note: null };
    case 'itemAdded': {
      const rarity = entry.subject.kind === 'item' ? itemRarityLabel(entry.subject.rarityIdx, lang) : '';
      return { change: `${t.teamPlanChangesItemAdded} · ${rarity} · ${t.rankLv} ${String(d.level)}`, before: text(''), after: text(''), note: null };
    }
    case 'itemRemoved':
      return { change: d.used ? t.teamPlanChangesItemRemovedUsed : t.teamPlanChangesItemRemoved, before: text(''), after: text(''), note: null };
    case 'forge': {
      const note = d.asked === null ? null : d.asked === d.after ? { kind: 'text' as const, value: t.teamPlanChangesAskedDone } : { kind: 'text' as const, value: sub(t.teamPlanChangesAsked, { value: forge(d.asked) }) };
      return { change: t.teamPlanChangesForge, before: text(forge(d.before)), after: text(forge(d.after)), note };
    }
    case 'equippedBy': {
      const movedToInventory = d.before !== null && d.after === null;
      let note: PlanChangeNote | null = null;
      if (d.asked !== null) {
        if (d.asked === d.after) {
          note = { kind: 'text', value: t.teamPlanChangesAskedDone };
        } else {
          const [before, after] = splitAskedTemplate(t.teamPlanChangesAsked);
          note = { kind: 'askedHero', before, hero: heroRef(d.asked, heroNames), after };
        }
      }
      return {
        change: movedToInventory ? t.teamPlanChangesMovedToInventory : t.teamPlanChangesEquippedBy,
        before: who(d.before, t, heroNames),
        after: who(d.after, t, heroNames),
        note,
      };
    }
    case 'itemOther':
      return { change: t.teamPlanChangesItemOther, before: text(''), after: text(''), note: null };
    case 'tree':
      return { change: sub(t.teamPlanChangesTree, { axis: treeAxisLabel(d.axis, t) }), before: text(formatTreeAxisValue(d.axis, d.before, lang)), after: text(formatTreeAxisValue(d.axis, d.after, lang)), note: null };
    case 'accountField': {
      const label = {
        houseIdx: t.teamPlanChangesFieldHouseIdx,
        houseLevel: t.teamPlanChangesFieldHouseLevel,
        phase: t.teamPlanChangesFieldPhase,
        maxPhase: t.teamPlanChangesFieldMaxPhase,
        slots: t.teamPlanChangesFieldSlots,
        fieldSlots: t.teamPlanChangesFieldFieldSlots,
        houseCycleSecs: t.teamPlanChangesFieldHouseCycleSecs,
      }[d.name];
      return { change: label, before: text(d.before === null ? none : String(d.before)), after: text(d.after === null ? none : String(d.after)), note: null };
    }
    case 'control': {
      const label = {
        forgeFloor: t.teamPlanChangesControlForgeFloor,
        objective: t.teamPlanChangesControlObjective,
        allowedChanges: t.teamPlanChangesControlAllowedChanges,
        ignoreFieldCrowding: t.teamPlanChangesControlIgnoreFieldCrowding,
        aurasAtCap: t.teamPlanChangesControlAurasAtCap,
        targetPhase: t.teamPlanChangesControlTargetPhase,
      }[d.name];
      const value = (raw: string): string => {
        switch (d.name) {
          case 'forgeFloor':
            return forge(Number(raw));
          case 'objective':
            return raw === 'farm' ? t.teamPlanObjectiveOptionGold : t.teamPlanObjectiveOptionDamage;
          case 'allowedChanges':
            return raw === 'both' ? t.teamPlanAllowedChangesOptionBoth : raw === 'points' ? t.teamPlanAllowedChangesOptionPoints : t.teamPlanAllowedChangesOptionGear;
          case 'ignoreFieldCrowding':
            return raw === 'true' ? t.teamPlanChangesOn : t.teamPlanChangesOff;
          case 'aurasAtCap':
            return raw === '' ? none : raw.split(',').map((id) => abilityName(id, lang)).join(', ');
          case 'targetPhase':
            return raw === 'null' ? t.teamPlanPhaseNone : raw;
        }
      };
      return { change: label, before: text(value(d.before)), after: text(value(d.after)), note: null };
    }
    case 'scope':
      return { change: sub(t.teamPlanChangesScope, { hero: d.heroName }), before: text(scopeLabel(d.before, t)), after: text(scopeLabel(d.after, t)), note: null };
    case 'fieldRotation':
    case 'battleAllowed':
    case 'power':
      return { change: '', before: text(''), after: text(''), note: null };
  }
}

const cellClass = 'px-2 py-1.5 align-middle text-[12px]';
const headClass = 'px-2 pb-1 text-left text-[10px] font-semibold tracking-[0.06em] text-muted uppercase';
const groupHeadClass = 'text-[10px] font-semibold tracking-[0.06em] text-muted uppercase';

function isEmptyValue(value: PlanChangeCellValue): boolean {
  return value.kind === 'text' && value.value === '';
}

/** Sized to match the `xs` item icon beside the subject column, and with no record id — the
 *  Before → now cell reads two chips on one line, not a hero sheet. */
function CellValue({ value, lang, heroes }: { value: PlanChangeCellValue; lang: Lang; heroes: ReadonlyMap<string, HeroRecord> }) {
  if (value.kind === 'hero') return <HeroIdentityChip hero={heroes.get(value.id)} fallbackName={value.name} lang={lang} size="xs" showId={false} />;
  return <>{value.value}</>;
}

function Subject({ entry, t, lang, heroes, items }: { entry: PlanChange; t: Copy; lang: Lang; heroes: ReadonlyMap<string, HeroRecord>; items: ReadonlyMap<string, InventoryItem> }) {
  const subject = entry.subject;
  if (subject.kind === 'hero') return <HeroIdentityChip hero={heroes.get(subject.id)} fallbackName={subject.name} lang={lang} />;
  if (subject.kind === 'item') {
    const item = items.get(subject.id);
    return (
      <span className="inline-flex items-center gap-1.5">
        {item ? <ItemIcon item={item} size="xs" showLevel={false} showUpgrade={false} peek={{ lang }} /> : null}
        <span className="font-semibold text-ink">{itemName(subject, lang)}</span>
      </span>
    );
  }
  return <span className="font-semibold text-ink">{subject.kind === 'account' ? t.teamPlanChangesSubjectAccount : t.teamPlanChangesSubjectSetup}</span>;
}

/** Every row this panel ever draws is a break — nothing else earns the down tone. */
const VERDICT_TONE_CLASS = 'text-down';

function BreaksGroup({ rows, t, lang, heroes, items, heroNames }: { rows: readonly PlanChange[]; t: Copy; lang: Lang; heroes: ReadonlyMap<string, HeroRecord>; items: ReadonlyMap<string, InventoryItem>; heroNames: ReadonlyMap<string, string> }) {
  const verdict = t.teamPlanChangesGroupBreaks;
  return (
    <>
      <tr>
        <td colSpan={4} className="px-2 pt-2.5 pb-0.5">
          <span className={groupHeadClass}>{verdict}</span>
        </td>
      </tr>
      {rows.map((entry, index) => {
        const words = wordPlanChange(entry, t, lang, heroNames);
        const hasHeroValue = words.before.kind === 'hero' || words.after.kind === 'hero';
        return (
          <tr
            key={index}
            data-testid="team-plan-change"
            data-verdict={entry.verdict}
            data-field={entry.detail.field}
            className="border-t border-line/50"
          >
            <td className={cn(cellClass, 'whitespace-nowrap')}>
              <Subject entry={entry} t={t} lang={lang} heroes={heroes} items={items} />
            </td>
            <td className={cn(cellClass, 'text-muted')}>
              {words.change}
              {words.note ? (
                <span className="ml-1.5 text-muted">
                  {' '}
                  ·{' '}
                  {words.note.kind === 'text' ? (
                    words.note.value
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      {words.note.before}
                      <HeroIdentityChip hero={heroes.get(words.note.hero.id)} fallbackName={words.note.hero.name} lang={lang} size="xs" showId={false} />
                      {words.note.after}
                    </span>
                  )}
                </span>
              ) : null}
            </td>
            <td className={cn(cellClass, 'whitespace-nowrap', hasHeroValue ? 'text-ink' : 'font-mono tabular-nums text-ink')}>
              <span className="flex items-center gap-1.5">
                <CellValue value={words.before} lang={lang} heroes={heroes} />
                {isEmptyValue(words.before) || isEmptyValue(words.after) ? null : <span className="text-muted">→</span>}
                <CellValue value={words.after} lang={lang} heroes={heroes} />
              </span>
            </td>
            <td className={cn(cellClass, 'whitespace-nowrap text-[11px] font-semibold', VERDICT_TONE_CLASS)}>{verdict}</td>
          </tr>
        );
      })}
    </>
  );
}

/** The heroes, items and hero-name lookup a ledger's rows read from — everything the plan basis
 *  or the account's current state ever named, so a hero or piece that has since gone is still
 *  named by what the plan knew of it. */
export function planChangesViewModel(
  basis: PlanBasis,
  now: TeamPlanInputs,
): { heroes: ReadonlyMap<string, HeroRecord>; items: ReadonlyMap<string, InventoryItem>; heroNames: ReadonlyMap<string, string> } {
  const heroes = new Map([...basis.inputs.heroes, ...now.heroes].map((hero) => [hero.id, hero]));
  const heroNames = new Map([...heroes].map(([id, hero]) => [id, hero.name]));
  const items = new Map([...basis.inputs.inventory.items, ...now.inventory.items].map((item) => [item.id, item]));
  return { heroes, items, heroNames };
}

export function PlanChangesPanelBody({
  t,
  lang,
  ledger,
  heroes,
  items,
  heroNames,
}: {
  t: Copy;
  lang: Lang;
  ledger: PlanChangeLedger;
  heroes: ReadonlyMap<string, HeroRecord>;
  items: ReadonlyMap<string, InventoryItem>;
  heroNames: ReadonlyMap<string, string>;
}) {
  return (
    <div data-testid="team-plan-changes-body" className="flex flex-col gap-2 pt-2.5">
      {ledger.breaks.length === 0 ? null : (
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th scope="col" className={headClass}>{t.teamPlanChangesColWhat}</th>
              <th scope="col" className={headClass}>{t.teamPlanChangesColChange}</th>
              <th scope="col" className={headClass}>{t.teamPlanChangesColBeforeNow}</th>
              <th scope="col" className={headClass}>{t.teamPlanChangesColVerdict}</th>
            </tr>
          </thead>
          <tbody>
            <BreaksGroup rows={ledger.breaks} t={t} lang={lang} heroes={heroes} items={items} heroNames={heroNames} />
          </tbody>
        </table>
      )}
    </div>
  );
}

export function PlanChangesPanel({
  t,
  lang,
  ledger,
  basis,
  now,
  onRecompute,
  recomputeBlocked,
  busy,
}: {
  t: Copy;
  lang: Lang;
  ledger: PlanChangeLedger;
  basis: PlanBasis;
  now: TeamPlanInputs;
  onRecompute: () => void;
  recomputeBlocked: boolean;
  busy: boolean;
}) {
  const { heroes, items, heroNames } = useMemo(() => planChangesViewModel(basis, now), [basis, now]);

  if (ledger.breaks.length === 0) return null;

  const summaryLine = ledger.breaks.length === 1 ? t.teamPlanChangesCountOne : sub(t.teamPlanChangesCountMany, { n: ledger.breaks.length });

  return (
    <div
      role="status"
      data-testid="team-plan-changes"
      data-counted={ledger.counted}
      data-breaks="true"
      className="rounded-sm border border-down/50 bg-[color-mix(in_oklch,var(--down)_7%,transparent)] px-4 py-3"
    >
      <Collapsible.Root>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 className={panelTitleClass}>
            <Collapsible.Trigger tone="panel">{t.teamPlanChangesTitle}</Collapsible.Trigger>
          </h2>
          <span data-testid="team-plan-changes-count" className="text-[13px] text-muted">
            {summaryLine}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button type="button" variant="primary" data-testid="team-plan-changes-recompute" disabled={recomputeBlocked} aria-busy={busy} onClick={onRecompute}>
              {t.teamPlanChangesRecompute}
            </Button>
          </div>
        </div>
        <Collapsible.Panel>
          <PlanChangesPanelBody t={t} lang={lang} ledger={ledger} heroes={heroes} items={items} heroNames={heroNames} />
        </Collapsible.Panel>
      </Collapsible.Root>
    </div>
  );
}
