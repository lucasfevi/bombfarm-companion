import type { Meta, StoryObj } from '@storybook/react';
import { useState, type ComponentProps } from 'react';
import { AppShell, type AppShellNavItem } from './AppShell';
import { SegmentedToggle } from './segmented-toggle';
import { StatusChip } from './status-chip';
import { EmptyState } from './empty-state';

const NAV_ITEMS: AppShellNavItem[] = [
  { id: 'live', label: 'Live' },
  { id: 'planning', label: 'Planning' },
  { id: 'settings', label: 'Settings' },
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
  const [activeId, setActiveId] = useState(props.activeId ?? 'live');
  const [locale, setLocale] = useState('en');
  return (
    <AppShell
      title="Bomb Farm Companion"
      items={NAV_ITEMS}
      activeId={activeId}
      onNavigate={setActiveId}
      actions={
        <SegmentedToggle
          options={[
            { id: 'pt-BR', label: 'PT' },
            { id: 'en', label: 'EN' },
          ]}
          value={locale}
          onChange={setLocale}
          ariaLabel="Language"
        />
      }
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

/** Top bar — brand lockup, nav pill, and the language actions slot. */
export const Regular: Story = {
  parameters: { viewport: { defaultViewport: 'desktop1280' } },
};

export const PlanningActive: Story = {
  args: { activeId: 'planning' },
};

/** `items={[]}` — the consent-gated state; no nav landmark renders. */
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

/** No right-hand actions — the actions slot renders nothing rather than an empty box. */
export const NoActions: Story = {
  args: { actions: undefined },
};
