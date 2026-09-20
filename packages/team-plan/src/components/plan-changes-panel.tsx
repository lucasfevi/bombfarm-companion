'use client';

/**
 * What changed since the plan was computed, as a ledger: one row per change with its subject,
 * what moved, before → now, and whether the plan cares. Replaces the sentence that only said
 * inputs had changed — which, on a farming account, they had every minute, for reasons the plan
 * never depended on.
 *
 * Three verdicts, three groups. "Changes the plan" is the reason to build again. "Progress on
 * this plan" is a step the plan itself asked for, taken — the plan is partly done, not stale.
 * "Not counted" is the field rotation the reader may have noticed and wondered about; it is
 * one line, never a table row.
 */
import { useMemo, useState } from 'react';
import { Button, cn } from '@bombfarm/ui';
import { HeroIdentityChip, ItemIcon } from '@bombfarm/game-art';
import { abilityName, itemName } from '@bombfarm/domain/game-labels';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import type { InventoryItem } from '@bombfarm/domain/inventory';
import type { HeroRune } from '@bombfarm/domain/runes';
import { sub, type Lang } from '@bombfarm/hero/copy';
import type { TeamPlanScreenCopy } from '../copy';
import type { PlanBasis, PlanChange, PlanChangeLedger, TreeAxis } from '../core/plan-changes';
import type { TeamPlanInputs } from '../core/team-plan-inputs';
import type { ScopeState } from '../core/hero-scope';

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

/** Every cell of one row, already worded: the change's field name, its two values and the note
 *  after them ("plan asked +14", "as planned"). Exported for the test, which reads words. */
export type PlanChangeRow = { change: string; before: string; after: string; note: string | null };

export function wordPlanChange(entry: PlanChange, t: Copy, lang: Lang, heroNames: ReadonlyMap<string, string>, items: ReadonlyMap<string, InventoryItem>): PlanChangeRow {
  const none = NONE;
  const who = (heroId: string | null) => (heroId === null ? t.teamPlanChangesNobody : (heroNames.get(heroId) ?? heroId));
  const d = entry.detail;
  switch (d.field) {
    case 'heroAdded':
      return { change: t.teamPlanChangesHeroAdded, before: none, after: '', note: null };
    case 'heroRemoved':
      return { change: t.teamPlanChangesHeroRemoved, before: '', after: none, note: null };
    case 'level':
      return { change: t.teamPlanChangesLevel, before: String(d.before), after: String(d.after), note: null };
    case 'stars':
      return { change: t.teamPlanChangesStars, before: String(d.before), after: String(d.after), note: null };
    case 'points': {
      const note = d.asked === null ? null : d.asked === d.after ? t.teamPlanChangesAskedDone : sub(t.teamPlanChangesAsked, { value: d.asked });
      return { change: sub(t.teamPlanChangesPoints, { stat: t.statShort[d.stat] }), before: String(d.before), after: String(d.after), note };
    }
    case 'pointsAvailable':
      return { change: t.teamPlanChangesPointsAvailable, before: String(d.before), after: String(d.after), note: null };
    case 'ability':
      return { change: sub(t.teamPlanChangesAbility, { ability: abilityName(d.abilityId, lang) }), before: String(d.before), after: String(d.after), note: null };
    case 'runeGained':
      return { change: sub(t.teamPlanChangesRuneGained, { axis: runeAxisLabel(d.axis, t), pct: d.strengthPct }), before: none, after: '', note: null };
    case 'runeLost':
      return { change: sub(t.teamPlanChangesRuneLost, { axis: runeAxisLabel(d.axis, t), pct: d.strengthPct }), before: '', after: none, note: null };
    case 'heroOther':
      return { change: t.teamPlanChangesHeroOther, before: '', after: '', note: null };
    case 'itemAdded': {
      const item = entry.subject.kind === 'item' ? items.get(entry.subject.id) : undefined;
      return { change: t.teamPlanChangesItemAdded, before: none, after: item ? forge(item.upgrade) : '', note: null };
    }
    case 'itemRemoved':
      return { change: t.teamPlanChangesItemRemoved, before: '', after: none, note: null };
    case 'forge': {
      const note = d.asked === null ? null : d.asked === d.after ? t.teamPlanChangesAskedDone : sub(t.teamPlanChangesAsked, { value: forge(d.asked) });
      return { change: t.teamPlanChangesForge, before: forge(d.before), after: forge(d.after), note };
    }
    case 'equippedBy': {
      const note = d.asked === null ? null : d.asked === d.after ? t.teamPlanChangesAskedDone : sub(t.teamPlanChangesAsked, { value: who(d.asked) });
      return { change: t.teamPlanChangesEquippedBy, before: who(d.before), after: who(d.after), note };
    }
    case 'itemOther':
      return { change: t.teamPlanChangesItemOther, before: '', after: '', note: null };
    case 'tree':
      return { change: sub(t.teamPlanChangesTree, { axis: treeAxisLabel(d.axis, t) }), before: String(d.before), after: String(d.after), note: null };
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
      return { change: label, before: d.before === null ? none : String(d.before), after: d.after === null ? none : String(d.after), note: null };
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
      return { change: label, before: value(d.before), after: value(d.after), note: null };
    }
    case 'scope':
      return { change: sub(t.teamPlanChangesScope, { hero: d.heroName }), before: scopeLabel(d.before, t), after: scopeLabel(d.after, t), note: null };
    case 'fieldRotation':
    case 'battleAllowed':
    case 'power':
      return { change: '', before: '', after: '', note: null };
  }
}

const cellClass = 'px-2 py-1.5 align-middle text-[12px]';
const headClass = 'px-2 pb-1 text-left text-[10px] font-semibold tracking-[0.06em] text-muted uppercase';

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

function Group({ title, rows, tone, t, lang, heroes, items, heroNames }: { title: string; rows: readonly PlanChange[]; tone: 'plan' | 'progress'; t: Copy; lang: Lang; heroes: ReadonlyMap<string, HeroRecord>; items: ReadonlyMap<string, InventoryItem>; heroNames: ReadonlyMap<string, string> }) {
  if (rows.length === 0) return null;
  const verdict = tone === 'plan' ? t.teamPlanChangesGroupPlan : t.teamPlanChangesGroupProgress;
  return (
    <>
      <tr>
        <td colSpan={4} className="px-2 pt-2.5 pb-0.5 text-[10px] font-semibold tracking-[0.06em] text-muted uppercase">
          {title}
        </td>
      </tr>
      {rows.map((entry, index) => {
        const words = wordPlanChange(entry, t, lang, heroNames, items);
        return (
          <tr key={index} data-testid="team-plan-change" data-verdict={entry.verdict} data-field={entry.detail.field} className="border-t border-line/50">
            <td className={cn(cellClass, 'whitespace-nowrap')}>
              <Subject entry={entry} t={t} lang={lang} heroes={heroes} items={items} />
            </td>
            <td className={cn(cellClass, 'text-muted')}>
              {words.change}
              {words.note ? <span className={cn('ml-1.5', tone === 'progress' ? 'text-up' : 'text-muted')}>· {words.note}</span> : null}
            </td>
            <td className={cn(cellClass, 'font-mono whitespace-nowrap tabular-nums text-ink')}>
              {words.before}
              {words.before !== '' && words.after !== '' ? <span className="px-1.5 text-muted">→</span> : null}
              {words.after}
            </td>
            <td className={cn(cellClass, 'whitespace-nowrap text-[11px] font-semibold', tone === 'plan' ? 'text-warn' : 'text-up')}>{verdict}</td>
          </tr>
        );
      })}
    </>
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
  // A hero or piece that has since gone is still named by what the plan knew of it.
  const heroes = useMemo(() => new Map([...basis.inputs.heroes, ...now.heroes].map((hero) => [hero.id, hero])), [basis, now]);
  const heroNames = useMemo(() => new Map([...heroes].map(([id, hero]) => [id, hero.name])), [heroes]);
  const items = useMemo(() => new Map([...basis.inputs.inventory.items, ...now.inventory.items].map((item) => [item.id, item])), [basis, now]);

  // "Keep this plan" folds the table away for THESE changes; the next change unfolds it again.
  const ledgerKey = useMemo(() => JSON.stringify([...ledger.plan, ...ledger.progress].map((entry) => [entry.subject, entry.detail])), [ledger]);
  const [keptFor, setKeptFor] = useState<string | null>(null);
  const kept = keptFor === ledgerKey;

  if (ledger.counted === 0) return null;

  const countLine = ledger.counted === 1 ? t.teamPlanChangesCountOne : sub(t.teamPlanChangesCountMany, { n: ledger.counted });
  const rotated = ledger.noise.filter((entry) => entry.detail.field === 'fieldRotation').length;
  const rotationLine = rotated === 0 ? null : rotated === 1 ? t.teamPlanChangesRotationOne : sub(t.teamPlanChangesRotationMany, { n: rotated });

  return (
    <div
      role="status"
      data-testid="team-plan-changes"
      data-counted={ledger.counted}
      data-kept={kept}
      className="flex flex-col gap-2 rounded-sm border border-warn/50 bg-[color-mix(in_oklch,var(--warn)_7%,transparent)] px-4 py-3"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="m-0 text-sm font-semibold text-ink">{t.teamPlanChangesTitle}</h2>
        <span data-testid="team-plan-changes-count" className="text-[13px] text-muted">
          {countLine}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {kept ? null : (
            <Button type="button" variant="ghost" data-testid="team-plan-changes-keep" onClick={() => setKeptFor(ledgerKey)}>
              {t.teamPlanChangesKeep}
            </Button>
          )}
          <Button type="button" variant="primary" data-testid="team-plan-changes-recompute" disabled={recomputeBlocked} aria-busy={busy} onClick={onRecompute}>
            {t.teamPlanChangesRecompute}
          </Button>
        </div>
      </div>
      {kept ? null : (
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
            <Group title={t.teamPlanChangesGroupPlan} rows={ledger.plan} tone="plan" t={t} lang={lang} heroes={heroes} items={items} heroNames={heroNames} />
            <Group title={t.teamPlanChangesGroupProgress} rows={ledger.progress} tone="progress" t={t} lang={lang} heroes={heroes} items={items} heroNames={heroNames} />
          </tbody>
        </table>
      )}
      {rotationLine ? (
        <p data-testid="team-plan-changes-rotation" className="m-0 text-[12px] text-muted">
          <span className="font-semibold tracking-[0.04em] uppercase">{t.teamPlanChangesGroupNoise}</span> · {rotationLine}
        </p>
      ) : null}
    </div>
  );
}
