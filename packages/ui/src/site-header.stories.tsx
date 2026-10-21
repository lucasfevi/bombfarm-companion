import type { Meta, StoryObj } from '@storybook/react';
import { AppNav, type AppNavItem } from './app-nav';
import { Button } from './button';
import { SiteHeader } from './site-header';
import { siteHeaderBrandClass } from './site-header.recipe';

const NAV_ITEMS: AppNavItem[] = [
  { id: 'reports', label: 'Reports', active: true },
  { id: 'billing', label: 'Billing', active: false },
  { id: 'settings', label: 'Settings', active: false },
];

const brand = (
  <a href="#home" className={siteHeaderBrandClass}>
    <span className="text-sm font-bold text-ink">Acme</span>
  </a>
);

const nav = <AppNav ariaLabel="Sections" items={NAV_ITEMS} className="whitespace-nowrap" />;

const actions = (
  <>
    <Button type="button">Invite</Button>
    <Button type="button">Sign out</Button>
  </>
);

const meta = {
  title: 'UI/SiteHeader',
  component: SiteHeader,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SiteHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { brand, nav, actions },
};

/** Below 640px the nav scrolls in its own strip and `compactActions` replaces `actions`, in CSS alone. */
export const CompactActions: Story = {
  args: {
    brand,
    nav,
    actions,
    compactActions: <Button type="button">Menu</Button>,
  },
};

export const BrandAndActionsOnly: Story = {
  args: { brand, actions },
};
