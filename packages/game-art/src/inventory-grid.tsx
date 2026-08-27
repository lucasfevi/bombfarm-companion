import type { InventoryGroup, InventoryView, InventoryViewItem, ItemKind } from '@bombfarm/domain/inventory-view';
import { cn } from '@bombfarm/ui';
import { ItemIcon } from './item-icon';
import { rarityTextClass } from './game-art.recipe';
import {
  inventoryBadgeRecipe,
  inventoryCardRecipe,
  inventoryGridClass,
  type InventoryBadgeTone,
} from './inventory-grid.recipe';

export interface InventoryBadge {
  key: string;
  label: string;
  tone?: InventoryBadgeTone;
}

export interface InventoryGridLabels {
  groupTitle: (kind: ItemKind) => string;
  /** Display name for one item — the caller owns it, since set and slot tokens are localized
   *  and this package carries no i18n. */
  itemName: (item: InventoryViewItem) => string;
  /** Secondary line under the name; return an empty string to omit it. */
  itemDetail: (item: InventoryViewItem) => string;
  badges: (item: InventoryViewItem) => InventoryBadge[];
  /** Rendered in the `other` group's header — the raw category codes it holds, so an
   *  unrecognized item type can be reported without re-reading a capture. */
  unknownCategoryNote?: (codes: readonly number[]) => string;
  skippedNote?: (count: number) => string;
  empty: { title: string; description?: string };
}

export interface InventoryGridProps {
  view: InventoryView;
  labels: InventoryGridLabels;
  onSelectItem?: (item: InventoryViewItem) => void;
  className?: string;
}

function unknownCategoryCodes(group: InventoryGroup): number[] {
  const codes = new Set<number>();
  for (const item of group.items) {
    if (item.categoryCode !== null) codes.add(item.categoryCode);
  }
  return [...codes].sort((a, b) => a - b);
}

function InventoryCard({
  item,
  labels,
  onSelect,
}: {
  item: InventoryViewItem;
  labels: InventoryGridLabels;
  onSelect?: (item: InventoryViewItem) => void;
}) {
  const detail = labels.itemDetail(item);
  const badges = labels.badges(item);
  const tone = item.equipped ? 'equipped' : item.defResolved ? 'default' : 'unresolved';
  const interactive = Boolean(onSelect);

  const body = (
    <>
      <ItemIcon
        equipped={{
          defId: item.defId,
          rarityIdx: item.rarityIdx,
          level: item.level,
          upgrade: item.upgrade,
        }}
        size="md"
      />
      <span className="flex min-w-0 flex-col gap-1">
        <span className={cn('truncate text-sm font-medium', rarityTextClass(item.rarityIdx) ?? 'text-ink')}>
          {labels.itemName(item)}
        </span>
        {detail ? <span className="truncate text-xs text-muted">{detail}</span> : null}
        {badges.length > 0 ? (
          <span className="flex flex-wrap gap-1 pt-0.5">
            {badges.map((badge) => (
              <span key={badge.key} className={inventoryBadgeRecipe({ tone: badge.tone })}>
                {badge.label}
              </span>
            ))}
          </span>
        ) : null}
      </span>
    </>
  );

  if (!interactive) {
    return <div className={inventoryCardRecipe({ tone, interactive: false })}>{body}</div>;
  }

  return (
    <button
      type="button"
      className={inventoryCardRecipe({ tone, interactive: true })}
      onClick={() => onSelect?.(item)}
    >
      {body}
    </button>
  );
}

/**
 * The inventory surface both shells render. Takes the domain's grouped view as-is and owns no
 * strings of its own — every label arrives through {@link InventoryGridLabels} so the web planner
 * and the desktop can each supply their own locale.
 */
export function InventoryGrid({ view, labels, onSelectItem, className }: InventoryGridProps) {
  if (view.items.length === 0) {
    return (
      <div className={cn('flex flex-col items-center gap-2 px-6 py-10 text-center', className)}>
        <h2 className="text-base font-semibold text-ink">{labels.empty.title}</h2>
        {labels.empty.description ? (
          <p className="max-w-prose text-sm text-muted">{labels.empty.description}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-5', className)}>
      {view.groups.map((group) => {
        const codes = group.kind === 'other' ? unknownCategoryCodes(group) : [];
        const note = codes.length > 0 ? labels.unknownCategoryNote?.(codes) : undefined;

        return (
          <section key={group.kind} className="flex flex-col gap-2">
            <header className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <h3 className="text-sm font-semibold text-ink">{labels.groupTitle(group.kind)}</h3>
              <span className="text-xs text-muted">{group.items.length}</span>
              {note ? <span className="text-xs text-muted">{note}</span> : null}
            </header>
            <div className={inventoryGridClass}>
              {group.items.map((item) => (
                <InventoryCard key={item.id} item={item} labels={labels} onSelect={onSelectItem} />
              ))}
            </div>
          </section>
        );
      })}
      {view.skipped > 0 && labels.skippedNote ? (
        <p className="text-xs text-muted">{labels.skippedNote(view.skipped)}</p>
      ) : null}
    </div>
  );
}
