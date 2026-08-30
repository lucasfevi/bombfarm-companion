'use client';

import type { ImportCandidate } from '@bombfarm/domain/import-save';
import { RARITIES } from '@bombfarm/domain/planner-constants';
import { rarityLabel } from '@bombfarm/domain/game-labels';
import { formatNumber } from '@/shared/lib/format-number';
import type { Lang, Strings } from '@/shared/i18n';
import { sub } from '@/shared/i18n';
import { cn, DataTable, Switch, Tooltip } from '@bombfarm/ui';
import { MAX_STARS } from '@bombfarm/domain/gear';
import {
  HeroAbilityIcons,
  HeroAvatar,
  HeroGearIcons,
  rarityDotClass,
  rarityTextClass,
  rosterInactiveChromeClass,
} from '@/shared/game-art';

export function ImportCandidateRow({
  candidate,
  t,
  lang,
}: {
  candidate: ImportCandidate;
  t: Strings;
  lang: Lang;
}) {
  const rarIdx = RARITIES.indexOf(candidate.rarity);
  const stars = Math.max(0, Math.min(MAX_STARS, Math.round(candidate.record.stars ?? 0)));
  const battleAllowed = candidate.record.battleAllowed ?? true;
  const statusLabel = battleAllowed ? t.heroBattleActive : t.heroBattleInactive;
  const statusTitle = battleAllowed ? t.heroBattleActiveTitle : t.heroBattleInactiveTitle;
  const statusLabelClass =
    'col-start-1 row-start-1 text-[11px] leading-none font-bold tracking-wider uppercase';
  const inactiveChrome = !battleAllowed ? rosterInactiveChromeClass : undefined;

  return (
    <DataTable.Row
      className={cn(
        candidate.blocked && 'opacity-60',
        !battleAllowed && 'bg-[color-mix(in_oklch,var(--bg)_45%,transparent)]',
      )}
    >
      <DataTable.Cell className="w-14 px-1" nowrap={false}>
        <span className={inactiveChrome}>
          <HeroAvatar
            skin={candidate.record.skin ?? 0}
            rarityIdx={rarIdx}
            size="lg"
            name={candidate.name}
          />
        </span>
      </DataTable.Cell>
      <DataTable.Cell
        className={cn(
          'max-[560px]:hidden text-xl leading-none font-black tracking-tight',
          candidate.rank?.trim() ? 'text-accent' : 'text-muted',
          inactiveChrome,
        )}
      >
        {candidate.rank?.trim() || '—'}
      </DataTable.Cell>
      <DataTable.Cell className={inactiveChrome}>
        <span className={cn('text-base leading-none font-bold', battleAllowed ? 'text-ink' : 'text-muted')}>
          {candidate.name}
          {stars > 0 ? (
            <span className="ml-1 text-[0.92em] tracking-tight text-rar-4" aria-hidden="true">
              {'★'.repeat(stars)}
            </span>
          ) : null}
        </span>
      </DataTable.Cell>
      <DataTable.Cell
        className={cn('max-[560px]:hidden', rarityTextClass(rarIdx) ?? 'text-muted', inactiveChrome)}
      >
        <span className="inline-flex items-center gap-1.5 text-sm leading-none font-bold">
          <span
            className={`inline-block size-1.5 shrink-0 rounded-full ${rarityDotClass(rarIdx) ?? 'bg-muted'}`}
            aria-hidden="true"
          />
          {rarityLabel(candidate.rarity, lang)}
        </span>
      </DataTable.Cell>
      <DataTable.Cell numeric className={inactiveChrome}>
        Lv{candidate.level}
      </DataTable.Cell>
      <DataTable.Cell align="right" numeric className={inactiveChrome}>
        {formatNumber(candidate.power, lang, 0)}
      </DataTable.Cell>
      <DataTable.Cell className={cn('max-[720px]:hidden py-2', inactiveChrome)} nowrap={false} data-roster-wrap>
        <HeroGearIcons
          loadout={candidate.record.loadout}
          lang={lang}
          emptySlotAriaLabel={(slotName) => sub(t.gearSlotEmptyAria, { slot: slotName })}
          emptySlotTip={t.gearSlotEmptyTip}
          lvLabel={t.rankLv}
        />
      </DataTable.Cell>
      <DataTable.Cell className={cn('max-[960px]:hidden py-2', inactiveChrome)} nowrap={false} data-roster-wrap>
        <HeroAbilityIcons abilities={candidate.record.abilities} lang={lang} />
      </DataTable.Cell>
      <DataTable.Cell className="max-[720px]:hidden">
        {candidate.blocked ? (
          // A blocked hero is not going to be imported, so showing it as ACTIVE/INACTIVE answers a
          // question nobody asked and hides the one that matters. The row-level reason lives here;
          // the two things the player can DO about it are in `ImportBlockedNotice`, stated once
          // rather than repeated on every row.
          <Tooltip.Root>
            <Tooltip.Trigger
              render={<span />}
              className="inline-flex items-center text-[11px] leading-none font-bold tracking-wider text-warn uppercase"
              data-testid="import-blocked-badge"
            >
              {t.importBlockedBadge}
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner sideOffset={6}>
                <Tooltip.Popup>
                  <p className="m-0 max-w-70 text-[12px]">{t.importBlockedTooltip}</p>
                  {candidate.issues.length > 0 ? (
                    <ul className="m-0 mt-1.5 list-disc pl-4 text-[11px] leading-1.45 text-muted">
                      {candidate.issues.map((issue, index) => (
                        <li key={index}>{issue}</li>
                      ))}
                    </ul>
                  ) : null}
                </Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        ) : (
        <Tooltip.Root>
          <Tooltip.Trigger render={<span />} className="inline-flex items-center gap-1.5">
            <Switch
              checked={battleAllowed}
              readOnly
              disabled
              aria-label={t.heroBattleToggleAria}
            />
            <span className="grid justify-items-start">
              <span className={cn(statusLabelClass, 'invisible')} aria-hidden>
                {t.heroBattleActive}
              </span>
              <span className={cn(statusLabelClass, 'invisible')} aria-hidden>
                {t.heroBattleInactive}
              </span>
              <span className={cn(statusLabelClass, battleAllowed ? 'text-accent' : 'text-warn')}>
                {statusLabel}
              </span>
            </span>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner sideOffset={6}>
              <Tooltip.Popup>
                <p className="m-0 text-[12px]">{statusTitle}</p>
              </Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
        )}
      </DataTable.Cell>
    </DataTable.Row>
  );
}
