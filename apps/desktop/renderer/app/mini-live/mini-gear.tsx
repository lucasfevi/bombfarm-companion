import { Popover } from '@base-ui/react/popover';
import type { MiniLiveLayoutPatch, MiniLiveLayoutView } from '@bombfarm/contracts';
import { Icon, SegmentedToggle, Switch, cn } from '@bombfarm/ui';
import { useCopy } from '../../lib/copy';

function enabledSectionCount(layout: MiniLiveLayoutView): number {
  return Number(layout.showEarnings) + Number(layout.showMap) + Number(layout.showHeroes);
}

export function isMiniSectionDisabled(
  layout: MiniLiveLayoutView,
  key: keyof Pick<MiniLiveLayoutView, 'showEarnings' | 'showMap' | 'showHeroes'>,
): boolean {
  return layout[key] && enabledSectionCount(layout) === 1;
}

function SectionSwitch({
  label,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-1">
      <span className="text-sm text-ink">{label}</span>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} aria-label={label} />
    </label>
  );
}

export function MiniGear({
  open,
  onOpenChange,
  layout,
  onLayoutChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layout: MiniLiveLayoutView;
  onLayoutChange: (patch: MiniLiveLayoutPatch) => void;
}) {
  const t = useCopy();

  const patchSection = (key: 'showEarnings' | 'showMap' | 'showHeroes', next: boolean) => {
    onLayoutChange({ ...layout, [key]: next });
  };

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger
        type="button"
        data-testid="mini-live-gear"
        title={t.miniLiveGearTitle}
        aria-label={t.miniLiveGearTitle}
        className="grid size-7 place-items-center rounded-sm border-0 bg-transparent text-muted transition-colors hover:text-ink focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <Icon name="layout-grid" size="sm" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} className="z-50">
          <Popover.Popup
            data-testid="mini-live-gear-popover"
            className="w-56 rounded-md border border-line bg-surface p-3 shadow-lg"
          >
            <div className="flex flex-col gap-2">
              <SectionSwitch
                label={t.liveEarningsTitle}
                checked={layout.showEarnings}
                disabled={isMiniSectionDisabled(layout, 'showEarnings')}
                onCheckedChange={(next) => {
                  patchSection('showEarnings', next);
                }}
              />
              <SectionSwitch
                label={t.liveMapTitle}
                checked={layout.showMap}
                disabled={isMiniSectionDisabled(layout, 'showMap')}
                onCheckedChange={(next) => {
                  patchSection('showMap', next);
                }}
              />
              <SectionSwitch
                label={t.liveHeroesTitle}
                checked={layout.showHeroes}
                disabled={isMiniSectionDisabled(layout, 'showHeroes')}
                onCheckedChange={(next) => {
                  patchSection('showHeroes', next);
                }}
              />
              <div className="border-t border-line/55 pt-2">
                <span className="mb-2 block text-[10px] uppercase tracking-[0.06em] text-muted">{t.miniLiveAxisLabel}</span>
                <div data-testid="mini-live-axis">
                  <SegmentedToggle
                    options={[
                      { id: 'vertical', label: t.miniLiveAxisVerticalLabel },
                      { id: 'horizontal', label: t.miniLiveAxisHorizontalLabel },
                    ]}
                    value={layout.axis}
                    onChange={(id) => {
                      if (id === 'vertical' || id === 'horizontal') {
                        onLayoutChange({ ...layout, axis: id });
                      }
                    }}
                    ariaLabel={t.miniLiveAxisLabel}
                  />
                </div>
              </div>
              <p
                data-testid="mini-live-last-section-note"
                className={cn(
                  'm-0 text-[10px] text-muted',
                  enabledSectionCount(layout) > 1 && 'sr-only',
                )}
                title={t.miniLiveLastSectionTitle}
              >
                {t.miniLiveLastSectionTitle}
              </p>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
