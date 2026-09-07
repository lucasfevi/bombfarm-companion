import { cn } from '@bombfarm/ui';
import { rarityTextClass } from './game-art.recipe';
import { ItemIcon, type ItemIconItem } from './item-icon';

/**
 * The four strings an item is identified by. Functions rather than values because every caller
 * already holds a label bag over its own locale, and this package carries no i18n — and named
 * the way those bags already name them, so a surface passes its own bag rather than adapting it
 * into a second object every render.
 *
 * `itemRarity` is empty for the kinds whose NAME is already their tier (a key, a house part, a
 * skill stone) — that absence is also what moves the tier colour up onto the name.
 */
export interface ItemIdentityLabels<TItem extends ItemIconItem> {
  itemName: (item: TItem) => string;
  itemRarity: (item: TItem) => string;
  /** Already localized and prefixed, e.g. "Lv 60". Empty for a kind that has no level. */
  itemLevel: (item: TItem) => string;
  /** The forge `+N`, or empty when the item is unforged. */
  itemForge: (item: TItem) => string;
}

/** The icon size, and with it the type scale the two lines are set in. */
export type ItemIdentitySize = 'sm' | 'xl';

const NAME_TEXT = { sm: 'text-xs', xl: 'text-sm' } as const;
const DETAIL_TEXT = { sm: 'text-[10px]', xl: 'text-xs' } as const;

/**
 * One item, said the same way everywhere the app names one: icon, name and forge level on the
 * first line, tier and level on the second. It exists because the inventory card, the inventory
 * row and the Forge screen each grew their own arrangement of those four fields, and a player
 * reading two of them side by side had to learn both.
 *
 * The tier colour rides on whichever element carries the tier: the rarity word when there is one,
 * and the name itself for the kinds whose name IS their tier.
 */
export function ItemIdentity<TItem extends ItemIconItem>({
  item,
  labels,
  size = 'sm',
  nameTestId,
  className,
}: {
  item: TItem;
  labels: ItemIdentityLabels<TItem>;
  size?: ItemIdentitySize;
  /** `data-testid` on the element carrying the item's own name, for a caller that needs one. */
  nameTestId?: string | undefined;
  className?: string | undefined;
}) {
  const name = labels.itemName(item);
  const rarity = labels.itemRarity(item);
  const level = labels.itemLevel(item);
  const forge = labels.itemForge(item);
  const tier = rarityTextClass(item.rarityIdx) ?? 'text-ink';

  return (
    <span className={cn('flex min-w-0 items-center gap-2', className)}>
      <ItemIcon item={item} size={size} showLevel={false} showUpgrade={false} className="shrink-0" />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex min-w-0 items-baseline gap-1">
          <span
            data-testid={nameTestId}
            className={cn('min-w-0 truncate font-semibold', NAME_TEXT[size], rarity ? 'text-ink' : tier)}
          >
            {name}
          </span>
          {forge ? <span className="shrink-0 font-semibold text-accent">{forge}</span> : null}
        </span>
        {rarity || level ? (
          <span className={cn('flex min-w-0 items-baseline gap-1 leading-none', DETAIL_TEXT[size])}>
            {rarity ? <span className={cn('shrink-0 font-medium', tier)}>{rarity}</span> : null}
            {rarity && level ? (
              <span className="shrink-0 text-muted" aria-hidden="true">
                &middot;
              </span>
            ) : null}
            {level ? <span className="truncate text-muted">{level}</span> : null}
          </span>
        ) : null}
      </span>
    </span>
  );
}
