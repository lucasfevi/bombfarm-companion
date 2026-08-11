import type { Meta, StoryObj } from '@storybook/react';
import { useState, type ComponentProps } from 'react';
import { AppShell, type AppShellNavItem } from './AppShell';
import { StatusChip } from './status-chip';
import { EmptyState } from './empty-state';

const NAV_ITEMS: AppShellNavItem[] = [
  { id: 'inventory', label: 'Inventory', icon: 'chevron-down', badge: 4 },
  { id: 'stats', label: 'Stats', icon: 'chevron-up' },
  { id: 'settings', label: 'Settings', icon: 'x-mark' },
];

function DemoContent() {
  return (
    <EmptyState
      title="No game running"
      description="Launch Bomb Farm to see your live gold, gems, and inventory here."
    />
  );
}

function AppShellDemo(props: Partial<ComponentProps<typeof AppShell>>) {
  const [activeId, setActiveId] = useState(props.activeId ?? 'inventory');
  return (
    <AppShell
      title="Bomb Farm Companion"
      items={NAV_ITEMS}
      activeId={activeId}
      onNavigate={setActiveId}
      status={<StatusChip status="connected" label="Connected" />}
      version={<span className="font-mono text-xs text-muted">v0.1.0</span>}
      {...props}
    >
      <DemoContent />
    </AppShell>
  );
}

const meta = {
  title: 'UI/AppShell',
  component: AppShellDemo,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AppShellDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Regular width (>=1180px) — full sidebar with icon + label. */
export const Regular: Story = {
  parameters: { viewport: { defaultViewport: 'desktop1280' } },
};

/** Compact width (<1180px) — sidebar collapses to icons only; labels stay in the a11y tree. */
export const Compact: Story = {
  parameters: { viewport: { defaultViewport: 'desktop1024' } },
};

/** `items={[]}` — the desktop's current single-page state; no nav landmark renders. */
export const NoNav: Story = {
  render: () => (
    <AppShell
      title="Bomb Farm Companion"
      items={[]}
      status={<StatusChip status="not_running" label="Game not running" />}
      version={<span className="font-mono text-xs text-muted">v0.1.0</span>}
    >
      <DemoContent />
    </AppShell>
  ),
};

/** Flavor badge — the desktop Playwright smoke test asserts `data-testid="flavor-badge"`. */
export const WithFlavorBadge: Story = {
  args: { badge: 'DEV' },
};
