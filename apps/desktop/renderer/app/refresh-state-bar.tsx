'use client';

/**
 * The band under the top bar that says how fresh the tab on screen is and refreshes it. One
 * shape on every tab: the tab's name at the left, the age line and the one refresh button at the
 * right — so the control is in the same place whichever screen is showing, instead of over one
 * screen's heading, over another's bag and inside a third's panel.
 *
 * A screen that computes from a copy of its own registers its refresh (`useScreenRefreshRegistration`)
 * and the bar draws that. Every other screen follows the live account, so the bar's default is
 * the live account read's age and a press that asks main to read again.
 */
import { useAccountView } from '../lib/account/use-account-view';
import { oldestCaptureOf } from '../lib/account/account-facts';
import { useAccountReadRequest } from '../lib/account/use-account-read-request';
import { useScreenRefresh } from '../lib/refresh/screen-refresh-store';
import { AccountRefreshControl } from './account-refresh-control';

function followsLiveAccount(): void {}

export function RefreshStateBar({ tabId, label }: { tabId: string; label: string }) {
  const registered = useScreenRefresh(tabId);
  const account = useAccountView();
  const live = account.status === 'loaded' ? account.view : null;
  const liveRead = useAccountReadRequest(followsLiveAccount);

  const state = registered ?? {
    capturedAt: live === null ? null : oldestCaptureOf(live.payload),
    stale: false,
    busy: false,
    readState: liveRead.state,
    onRefresh: liveRead.request,
  };

  return (
    <div
      data-testid="refresh-state-bar"
      data-tab={tabId}
      data-source={registered === null ? 'live-account' : 'screen'}
      className="flex w-full min-w-0 items-center gap-3"
    >
      <span data-testid="refresh-state-subject" className="truncate font-semibold text-ink">
        {label}
      </span>
      <span className="ml-auto shrink-0">
        <AccountRefreshControl
          capturedAt={state.capturedAt}
          stale={state.stale}
          busy={state.busy}
          readState={state.readState}
          onRefresh={state.onRefresh}
          {...(state.ageLine === undefined ? {} : { ageLine: state.ageLine })}
        />
      </span>
    </div>
  );
}
