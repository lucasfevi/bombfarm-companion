import { memo } from 'react';
import { HiMiniXMark } from 'react-icons/hi2';
import {
  Slot,
  ITEM_LEVELS,
  ITEM_RARITIES,
  FORJA_LEVELS,
  upgradeMult,
  defsForSlot,
  setsForLevel,
  EquippedItem,
} from '@bombfarm/domain/gear';
import { sub, type Lang, type Strings } from '@/shared/i18n';
import { itemRarityLabel, setName, slotLabel } from '@bombfarm/domain/game-labels';

import { Button, Select, cn } from '@bombfarm/ui';
import { artFrameRadiusClass, ItemIcon } from '@/shared/game-art';

export type SlotPatchHandler = (slot: Slot, patch: Partial<EquippedItem> | null) => void;

const slotBase = cn(
  'flex flex-col gap-1 border border-dashed border-line bg-bg p-1.5 [&_[data-select]]:w-full',
  artFrameRadiusClass,
);
const slotFilled = 'border-solid border-line';
const slotChanged = 'shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--accent)_40%,transparent)]';

/** Slot chrome — outer box stays neutral; equipped rarity reads from `ItemIcon` frame. */
export function slotChromeClassName(equipped: EquippedItem | null | undefined, changed = false): string {
  return cn(slotBase, equipped && slotFilled, changed && slotChanged);
}

const slotHeadLabelClass =
  'text-center text-[10px] leading-tight font-bold tracking-wider uppercase';

export const SlotEditor = memo(function SlotEditor({
  slot,
  equipped,
  changed,
  t,
  lang,
  onPatch,
}: {
  slot: Slot;
  equipped: EquippedItem | null | undefined;
  changed?: boolean;
  t: Strings;
  lang: Lang;
  onPatch: SlotPatchHandler;
}) {
  const level = equipped?.level ?? 10;
  const upgrade = equipped?.upgrade ?? 0;
  const sets = setsForLevel(level);
  const setId = equipped ? equipped.defId.replace(/_.*$/, '') : sets[0] ?? '';
  const defs = defsForSlot(slot, setId);

  return (
    <div className={cn(slotChromeClassName(equipped, changed), 'relative')}>
      {equipped ? (
        <Button
          type="button"
          variant="icon"
          className="absolute -top-1 -right-1 z-10"
          aria-label={t.clear}
          title={t.clear}
          onClick={() => onPatch(slot, null)}
        >
          <HiMiniXMark size={14} aria-hidden="true" />
        </Button>
      ) : null}
      <div className="flex justify-center">
        {equipped ? (
          <ItemIcon item={equipped} size="xl" className="shrink-0" />
        ) : (
          <span className="flex w-16 aspect-[18/19] max-[720px]:w-14 shrink-0 items-center justify-center rounded-sm border border-dashed border-line bg-[color-mix(in_oklch,var(--bg)_55%,var(--surface))] px-0.5">
            <b className={slotHeadLabelClass}>{slotLabel(slot, lang)}</b>
          </span>
        )}
      </div>
      {/* One level is one set (`setsByLevel` is a bijection — guarded in `@bombfarm/domain`),
          so the set name rides in the level option label instead of a second, single-option
          select. The user still picks a LEVEL here; the set follows from it. */}
      <Select
        size="compact"
        aria-label={t.itemLevel}
        title={t.itemLevel}
        value={level}
        onChange={(event) => {
          const next = Number(event.target.value);
          const definition = defsForSlot(slot, setsForLevel(next)[0])[0];
          onPatch(slot, { level: next, defId: definition?.id, rarityIdx: equipped?.rarityIdx ?? 0, upgrade });
        }}
      >
        {ITEM_LEVELS.map((levelOption) => (
          <option key={levelOption} value={levelOption}>
            {sub(t.itemLevelOpt, {
              n: levelOption,
              set: setName(setsForLevel(levelOption)[0] ?? '', lang),
            })}
          </option>
        ))}
      </Select>
      <Select
        size="compact"
        aria-label={t.itemRarity}
        title={t.itemRarity}
        value={equipped?.rarityIdx ?? 0}
        onChange={(event) =>
          onPatch(slot, {
            rarityIdx: Number(event.target.value),
            level: level,
            defId: equipped?.defId ?? defs[0]?.id,
            upgrade,
          })
        }
      >
        {ITEM_RARITIES.map((rarity) => (
          <option key={rarity.idx} value={rarity.idx}>
            {itemRarityLabel(rarity.idx, lang)}
          </option>
        ))}
      </Select>
      <Select
        size="compact"
        aria-label={t.forgeLevel}
        title={t.forgeLevel}
        value={upgrade}
        onChange={(event) =>
          onPatch(slot, {
            upgrade: Number(event.target.value),
            level: level,
            rarityIdx: equipped?.rarityIdx ?? 0,
            defId: equipped?.defId ?? defs[0]?.id,
          })
        }
      >
        {FORJA_LEVELS.map((forgeLevel) => (
          <option key={forgeLevel} value={forgeLevel}>
            +{forgeLevel} ×{upgradeMult(forgeLevel).toFixed(2)}
          </option>
        ))}
      </Select>
    </div>
  );
});
