'use client';

import { AccountScreenLayout } from '@bombfarm/account/layout';
import { workspaceClass } from '@bombfarm/ui/panel-field.recipe';
import { AccountHoldingsSection } from './account-holdings-section';
import { AccountIdentityHeader } from './account-identity-header';
import { AccountHousePanel } from './account-house-panel';
import { AccountTreePanel } from './account-tree-panel';

export function AccountPage() {
  return (
    <div className={workspaceClass}>
      <AccountScreenLayout
        holdings={<AccountHoldingsSection />}
        identity={<AccountIdentityHeader />}
        house={<AccountHousePanel />}
        tree={<AccountTreePanel />}
      />
    </div>
  );
}
