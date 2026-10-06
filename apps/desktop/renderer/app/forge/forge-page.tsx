'use client';

/**
 * The Forge tab's two pages behind one switch: the forge itself, and the Deconstruct page that
 * burns items for the Essence the forge spends. A switch of tabs rather than of buttons because it
 * changes what the whole screen is, not a setting on it — `role="tab"` also keeps it apart from
 * the nav button of the same name. The bar is the same height on both pages, so swapping moves
 * nothing under it, and the page chosen is remembered for the window.
 */
import type { AccountSource } from '@bombfarm/contracts';
import { Tabs } from '@bombfarm/ui';
import { useCopy } from '../../lib/copy';
import { isForgePageId, setForgePage, useForgePage } from '../../lib/forge/forge-page-store';
import { DeconstructView } from '../deconstruct/deconstruct-view';
import { ForgeView } from './forge-view';

export function ForgePage({
  forgeWritesEnabled,
  accountSource,
}: {
  forgeWritesEnabled: boolean;
  accountSource: AccountSource | null;
}) {
  const t = useCopy();
  const page = useForgePage();

  return (
    <div data-testid="forge-page" data-page={page} className="flex flex-1 flex-col gap-3">
      <div className="shrink-0" aria-label={t.deconstructSwitchLabel} role="group">
        <Tabs.Root
          value={page}
          onValueChange={(next) => {
            if (isForgePageId(next)) setForgePage(next);
          }}
        >
          <Tabs.List>
            <Tabs.Tab value="forge">{t.forgeNavLabel}</Tabs.Tab>
            <Tabs.Tab value="deconstruct">{t.deconstructNavLabel}</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      </div>
      {page === 'forge' ? (
        <ForgeView forgeWritesEnabled={forgeWritesEnabled} accountSource={accountSource} />
      ) : (
        <DeconstructView forgeWritesEnabled={forgeWritesEnabled} accountSource={accountSource} />
      )}
    </div>
  );
}
