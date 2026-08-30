import { cn, Icon, Tooltip } from '@bombfarm/ui';

export type InventoryLayout = 'cards' | 'list';

export interface InventoryLayoutToggleLabels {
  /** Names the pair for assistive technology, e.g. "Layout". */
  group: string;
  cards: string;
  list: string;
}

const LAYOUTS = [
  { id: 'cards', icon: 'layout-grid' },
  { id: 'list', icon: 'layout-list' },
] as const;

/**
 * Cards or list, as two icons in the corner of the thing they switch.
 *
 * Icons rather than words because the control names a shape, which a glyph shows faster than a
 * label reads — and because it sits inside the toolbar rather than above the panel, where two
 * words would crowd the filters. Each still carries its word as its accessible name and its tip,
 * so nothing is lost to anyone who cannot use the picture.
 */
export function InventoryLayoutToggle({
  layout,
  onChange,
  labels,
  className,
}: {
  layout: InventoryLayout;
  onChange: (next: InventoryLayout) => void;
  labels: InventoryLayoutToggleLabels;
  className?: string;
}) {
  return (
    <span
      role="group"
      aria-label={labels.group}
      className={cn('flex items-center gap-0.5 rounded-sm border border-line p-0.5', className)}
    >
      {LAYOUTS.map(({ id, icon }) => {
        const label = id === 'cards' ? labels.cards : labels.list;
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
              <Icon name={icon} size="sm" />
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
