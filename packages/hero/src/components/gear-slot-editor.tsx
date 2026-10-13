'use client';

import { memo, useMemo } from 'react';
import { rarityTextClass } from '@bombfarm/game-art';
import {
  ITEM_LEVELS,
  ITEM_RARITIES,
  FORJA_LEVELS,
  upgradeMult,
  itemStatUpgradeMult,
  defsForSlot,
  setsForLevel,
  type EquippedItem,
  type Slot,
} from '@bombfarm/domain/gear';
import { itemRarityLabel, itemStatLabel, setName } from '@bombfarm/domain/game-labels';
import { Button, Icon, SearchSelect, Select, cn, numberFormatterFor, type SearchSelectOption } from '@bombfarm/ui';
import { sub, type GearPanelCopy, type Lang } from '../copy';
import { GearSlotCard, type GearSlotCardCopy } from './gear-slot-card';
import type { SlotPatchHandler } from './gear-slots-grid';

export type GearSlotEditorCopy = GearSlotCardCopy &
  Pick<GearPanelCopy, 'clear' | 'itemLevel' | 'itemLevelOpt' | 'itemLevelSearch' | 'itemLevelEmpty' | 'itemRarity' | 'forgeLevel'>;

function defIdPatch(defId: string | undefined): { defId?: string } {
  return defId ? { defId } : {};
}

/** The shared slot card with the controls under it: level, rarity, forge and clear. */
export const GearSlotEditor = memo(function GearSlotEditor({
  slot,
  equipped,
  changed,
  t,
  lang,
  onPatch,
}: {
  slot: Slot;
  equipped: EquippedItem | null | undefined;
  changed?: boolean | undefined;
  t: GearSlotEditorCopy;
  lang: Lang;
  onPatch: SlotPatchHandler;
}) {
  const formatNumber = useMemo(() => numberFormatterFor(lang), [lang]);
  const levelOptions = useMemo<SearchSelectOption[]>(
    () =>
      ITEM_LEVELS.map((levelOption) => {
        const set = setName(setsForLevel(levelOption)[0] ?? '', lang);
        return { value: String(levelOption), label: sub(t.itemLevelOpt, { n: levelOption, set }), triggerLabel: set };
      }),
    [lang, t.itemLevelOpt],
  );
  const rarityLabels = useMemo(
    () =>
      ITEM_RARITIES.map((rarity) => (
        <span key={rarity.idx} className={cn(rarityTextClass(rarity.idx))} data-rarity={rarity.idx}>
          {itemRarityLabel(rarity.idx, lang)}
        </span>
      )),
    [lang],
  );
  const level = equipped?.level ?? 10;
  const upgrade = equipped?.upgrade ?? 0;
  const sets = setsForLevel(level);
  const setId = equipped ? equipped.defId.replace(/_.*$/, '') : sets[0] ?? '';
  const defs = defsForSlot(slot, setId);
  const keptDefId = defIdPatch(equipped?.defId ?? defs[0]?.id);

  return (
    <GearSlotCard slot={slot} equipped={equipped} changed={changed} lang={lang} t={t} formatNumber={formatNumber}>
      {equipped ? (
        <Button
          type="button"
          variant="icon"
          className="absolute -top-1 -right-1 z-10 hover:bg-transparent"
          aria-label={t.clear}
          onClick={() => onPatch(slot, null)}
        >
          <Icon name="x-mark" size="sm" />
        </Button>
      ) : null}
      {/* One level is one set (`setsByLevel` is a bijection — guarded in `@bombfarm/domain`),
          so the set name rides in the level option label instead of a second, single-option
          select. The user still picks a LEVEL here; the set follows from it. */}
      <SearchSelect
        size="compact"
        aria-label={`${t.itemLevel}: ${levelOptions.find((option) => option.value === String(level))?.label ?? level}`}
        options={levelOptions}
        value={String(level)}
        searchPlaceholder={t.itemLevelSearch}
        emptyLabel={t.itemLevelEmpty}
        onValueChange={(picked) => {
          const next = Number(picked);
          if (!ITEM_LEVELS.includes(next)) return;
          const definition = defsForSlot(slot, setsForLevel(next)[0])[0];
          onPatch(slot, {
            level: next,
            ...(definition ? { defId: definition.id } : {}),
            rarityIdx: equipped?.rarityIdx ?? 0,
            upgrade,
          });
        }}
      />
      <Select
        size="compact"
        aria-label={t.itemRarity}
        value={equipped?.rarityIdx ?? 0}
        onChange={(event) =>
          onPatch(slot, {
            rarityIdx: Number(event.target.value),
            level: level,
            ...keptDefId,
            upgrade,
          })
        }
      >
        {ITEM_RARITIES.map((rarity) => (
          <option key={rarity.idx} value={rarity.idx}>
            {rarityLabels[rarity.idx]}
          </option>
        ))}
      </Select>
      <Select
        size="compact"
        aria-label={t.forgeLevel}
        value={upgrade}
        onChange={(event) =>
          onPatch(slot, {
            upgrade: Number(event.target.value),
            level: level,
            rarityIdx: equipped?.rarityIdx ?? 0,
            ...keptDefId,
          })
        }
      >
        {FORJA_LEVELS.map((forgeLevel) => {
          const cappedMult = itemStatUpgradeMult('crit', forgeLevel);
          const cappedNote =
            cappedMult === upgradeMult(forgeLevel)
              ? ''
              : ` (${itemStatLabel('crit', lang)}, ${itemStatLabel('cooldown', lang)} ×${cappedMult.toFixed(2)})`;
          return (
            <option key={forgeLevel} value={forgeLevel}>
              +{forgeLevel} ×{upgradeMult(forgeLevel).toFixed(2)}
              {cappedNote}
            </option>
          );
        })}
      </Select>
    </GearSlotCard>
  );
});
