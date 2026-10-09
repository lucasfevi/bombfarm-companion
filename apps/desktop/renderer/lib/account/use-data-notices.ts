import { useMemo } from 'react';
import { dataNoticesOf, type DataNotice } from './data-notices';
import { useAccountView } from './use-account-view';

export function useDataNotices(): readonly DataNotice[] {
  const account = useAccountView();
  const payload = account.status === 'loaded' ? account.view.payload : null;
  return useMemo(() => (payload === null ? [] : dataNoticesOf(payload)), [payload]);
}
