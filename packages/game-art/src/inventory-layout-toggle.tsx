import { cn, Icon, Tooltip } from '@bombfarm/ui';

export type InventoryLayout = 'cards' | 'list';

/** Every shape the toggle can offer. The Inventory offers two; the Heroes roster adds a table. */
export type LayoutToggleOption = InventoryLayout | 'table';

export type InventoryLayoutToggleLabels<Layout extends LayoutToggleOption = InventoryLayout> = {
  /** Names the group for assistive technology, e.g. "Layout". */
  readonly group: string;
} & { readonly [L in Layout]: string };

const LAYOUT_ICON = {
  cards: 'layout-grid',
  list: 'layout-list',
  table: 'layout-table',
} as const satisfies Record<LayoutToggleOption, string>;

const INVENTORY_LAYOUTS: readonly InventoryLayout[] = ['cards', 'list'];

/**
 * Cards or list, as two icons in the corner of the thing they switch.
 *
 * Icons rather than words because the control names a shape, which a glyph shows faster than a
 * label reads — and because it sits inside the toolbar rather than above the panel, where two
 * words would crowd the filters. Each still carries its word as its accessible name and its tip,
 * so nothing is lost to anyone who cannot use the picture.
 */
export function InventoryLayoutToggle<Layout extends LayoutToggleOption = InventoryLayout>({
  layout,
  onChange,
  labels,
  layouts = INVENTORY_LAYOUTS as readonly Layout[],
  className,
}: {
  layout: Layout;
  onChange: (next: Layout) => void;
  labels: InventoryLayoutToggleLabels<Layout>;
  /** The shapes offered, in order. Defaults to the Inventory's cards and list. */
  layouts?: readonly Layout[];
  className?: string;
}) {
  return (
    <span
      role="group"
      aria-label={labels.group}
      className={cn('flex items-center gap-0.5 rounded-sm border border-line p-0.5', className)}
    >
      {layouts.map((id) => {
        const label = labels[id];
        const active = layout === id;
        return (
          <Tooltip.Root key={id}>
            <Tooltip.Trigger
              render={<button type="button" />}
              aria-pressed={active}
              aria-label={label}
              data-testid={`inventory-layout-${id}`}
              onClick={() => {
                onChange(id);
              }}
              className={cn(
                'inline-grid size-6 cursor-pointer place-items-center rounded-sm border-0 bg-transparent',
                active ? 'bg-accent text-accent-ink' : 'text-muted hover:text-accent',
              )}
            >
              <Icon name={LAYOUT_ICON[id]} size="sm" />
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner sideOffset={6}>
                <Tooltip.Popup>
                  <p className="m-0 text-xs text-ink">{label}</p>
                </Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        );
      })}
    </span>
  );
}
