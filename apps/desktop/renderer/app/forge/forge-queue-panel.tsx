'use client';

/**
 * The queued pieces on the Forge tab, in the order they will be forged, each with its target and
 * a way off the queue, with the queue's own Start and Cancel under them. The piece rolling stays
 * — Cancel is how it stops — and a piece the bag no longer holds is named by its id until the
 * next account read drops it.
 */
import type { AccountSource } from '@bombfarm/contracts';
import { ItemIcon, itemPeekFromInventory } from '@bombfarm/game-art';
import { Button, Icon, InfoTip, Panel, PanelHeader, Switch, Tooltip, cn, mutedClass } from '@bombfarm/ui';
import { sub, useCopy } from '../../lib/copy';
import type { ForgeQueueState } from '../../lib/forge/forge-queue-reducer';
import { queueStoneRanges, type ForgeQueueSettings } from '../../lib/forge/forge-queue-settings';
import { editForgeQueueStones, setForgeQueueScroll, setForgeQueueStop } from '../../lib/forge/forge-queue-settings-store';
import type { ForgeQueuePricing, ForgeQueueRow } from '../../lib/forge/forge-queue-view';
import { forgeLevel, type ForgeLabels } from './forge-labels';
import { ForgeQueueActions } from './forge-queue-actions';
import { ForgeQueueStonesUse } from './forge-queue-stones';
import { ForgeStonesControl } from './forge-stones-panel';

export function ForgeQueuePanel({
  queue,
  rows,
  pricing,
  settings,
  ownedStones,
  labels,
  onRemove,
  forgeWritesEnabled,
  accountSource,
}: {
  queue: ForgeQueueState;
  rows: readonly ForgeQueueRow[];
  pricing: ForgeQueuePricing;
  settings: ForgeQueueSettings;
  /** Chance Stones held per rarity, 0…5. */
  ownedStones: readonly number[];
  labels: ForgeLabels;
  onRemove: (itemId: string) => void;
  forgeWritesEnabled: boolean;
  accountSource: AccountSource | null;
}) {
  const t = useCopy();
  if (rows.length === 0) return null;
  const locked = queue.status === 'running' || queue.status === 'paused' || queue.active !== null;

  return (
    <Panel data-testid="forge-queue-panel" className="flex flex-col gap-2">
      <PanelHeader title={t.forgeQueueTitle} />
      <Tooltip.Provider delay={200} closeDelay={80}>
        <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
          {rows.map(({ piece, item }) => {
            const rolling = queue.active?.itemId === piece.itemId;
            const halted = queue.halt?.itemId === piece.itemId;
            const name = item === null ? piece.itemId : labels.itemName(item);
            return (
              <li
                key={piece.itemId}
                data-testid="forge-queue-row"
                data-item-id={piece.itemId}
                data-rolling={rolling ? 'true' : undefined}
                className={cn(
                  'flex',
                  'items-center',
                  'gap-2',
                  'rounded-sm',
                  'border',
                  'px-2',
                  'py-1.5',
                  rolling ? 'border-accent/60' : halted ? 'border-warn/60' : 'border-line',
                )}
              >
                {item === null ? (
                  <span aria-hidden className="size-8 shrink-0 rounded-sm border border-dashed border-line" />
                ) : (
                  <ItemIcon item={itemPeekFromInventory(item)} size="sm" peek={{ lang: labels.lang, name }} />
                )}
                <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-ink">{name}</span>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink">
                  {forgeLevel(item?.upgrade ?? 0)} → {forgeLevel(piece.target)}
                </span>
                {rolling ? (
                  <span className={cn('shrink-0', mutedClass)}>{t.forgeQueueRolling}</span>
                ) : (
                  <Tooltip.Root>
                    <Tooltip.Trigger
                      render={
                        <Button
                          type="button"
                          variant="icon"
                          aria-label={sub(t.forgeQueueRemove, { item: name })}
                          data-testid="forge-queue-remove"
                          onClick={() => {
                            onRemove(piece.itemId);
                          }}
                        >
                          <Icon name="x-mark" size="sm" />
                        </Button>
                      }
                    />
                    <Tooltip.Portal>
                      <Tooltip.Positioner sideOffset={6}>
                        <Tooltip.Popup>
                          <p className="m-0">{sub(t.forgeQueueRemove, { item: name })}</p>
                        </Tooltip.Popup>
                      </Tooltip.Positioner>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                )}
              </li>
            );
          })}
        </ol>
      </Tooltip.Provider>
      <p className={cn('m-0', mutedClass)}>{t.forgeQueuePanelCaption}</p>
      <fieldset
        disabled={locked}
        data-testid="forge-queue-settings"
        className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0"
      >
        <span className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-ink">{t.forgeQueueSettingsTitle}</span>
          <InfoTip label={t.forgeQueueSettingsTitle} tip={t.forgeQueueSettingsTip} />
        </span>
        <ForgeStonesControl ranges={queueStoneRanges(settings)} owned={ownedStones} labels={labels} onEdit={editForgeQueueStones} />
        <div data-testid="forge-queue-stop" className="flex items-center gap-2">
          <Switch id="forge-queue-stop-switch" checked={settings.stopWhenOutOfStones} onCheckedChange={setForgeQueueStop} />
          <label htmlFor="forge-queue-stop-switch" className="text-xs text-ink">
            {t.forgeQueueStopLabel}
          </label>
          <InfoTip label={t.forgeQueueStopLabel} tip={t.forgeQueueStopTip} />
        </div>
        <div data-testid="forge-queue-scroll" className="flex items-center gap-2">
          <Switch id="forge-queue-scroll-switch" checked={settings.scroll} onCheckedChange={setForgeQueueScroll} />
          <label htmlFor="forge-queue-scroll-switch" className="text-xs text-ink">
            {t.forgeQueueScrollLabel}
          </label>
          <InfoTip label={t.forgeScrollTitle} tip={t.forgeQueueScrollTip} />
        </div>
      </fieldset>
      <ForgeQueueStonesUse rows={rows} pricing={pricing} settings={settings} labels={labels} />
      <ForgeQueueActions
        queue={queue}
        rows={rows}
        pricing={pricing}
        settings={settings}
        labels={labels}
        forgeWritesEnabled={forgeWritesEnabled}
        accountSource={accountSource}
        layout="stacked"
      />
    </Panel>
  );
}
