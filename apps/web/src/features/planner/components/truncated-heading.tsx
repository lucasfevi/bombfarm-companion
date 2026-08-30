'use client';

import { memo } from 'react';
import { Tooltip } from '@bombfarm/ui';

/**
 * A column heading allowed to truncate, with the full text on hover and on focus.
 *
 * Replaces a native `title` on the header cell. `DataTable.Header` spreads unknown props onto its
 * own `<th>`, so that `title` reached the DOM while reading as a component prop — invisible to the
 * lint rule that forbids native tooltips.
 *
 * `Tooltip.Trigger` renders a button by default, which would put a control inside a heading that
 * is not one; `render={<span />}` keeps it inert, and `tabIndex={0}` is what makes the tip
 * reachable without a pointer.
 *
 * Memoised because the Sheet table re-renders on every planner edit while these headings never
 * change: seven of them, each a tooltip subtree rather than the bare `<span>` they replaced, cost
 * ~8% more component renders across four measured planner scenarios before this.
 */
export const TruncatedHeading = memo(function TruncatedHeading({ text }: { text: string }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={<span />} tabIndex={0} className="block min-w-0 truncate">
        {text}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={6}>
          <Tooltip.Popup>
            <p className="m-0 text-xs text-ink">{text}</p>
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
});
