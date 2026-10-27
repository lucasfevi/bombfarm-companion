'use client';

import { DetailsMenu } from '@bombfarm/ui';

export function ClientMenu() {
  return (
    <DetailsMenu.Root label="Only menu">
      <DetailsMenu.Item render={<a href="/reports" />}>Only reports link</DetailsMenu.Item>
    </DetailsMenu.Root>
  );
}
