import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { AppNav, type AppNavItem } from './app-nav';

const BASE_ITEMS: Array<{ id: string; label: string }> = [
  { id: 'planner', label: 'Planner' },
  { id: 'farm', label: 'Farm' },
  { id: 'team-plan', label: 'Team plan' },
  { id: 'account', label: 'Account' },
];

function AppNavDemo({ initialActiveId = 'planner' }: { initialActiveId?: string }) {
  const [activeId, setActiveId] = useState(initialActiveId);
  const items: AppNavItem[] = BASE_ITEMS.map((item) => ({ ...item, active: item.id === activeId }));
  return <AppNav items={items} ariaLabel="Main sections" onSelect={setActiveId} />;
}

const meta = {
  title: 'UI/AppNav',
  component: AppNavDemo,
  tags: ['autodocs'],
} satisfies Meta<typeof AppNavDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Click any pill — active state is controlled by this story, matching real call sites. */
export const Default: Story = {};

export const FarmActive: Story = {
  args: { initialActiveId: 'farm' },
};

/** `items={[]}` — the desktop's consent-gated state; no nav landmark renders. */
export const Empty: Story = {
  render: () => <AppNav items={[]} />,
};

/** The web supplies its own anchor via `renderItem`, so navigation is a real link, not a button. */
export const CustomRenderItem: Story = {
  render: () => {
    const items: AppNavItem[] = [
      { id: 'planner', label: 'Planner', active: true },
      { id: 'farm', label: 'Farm', active: false },
    ];
    return (
      <AppNav
        items={items}
        ariaLabel="Main sections"
        renderItem={(item, className) => (
          <a key={item.id} href={`#${item.id}`} aria-current={item.active ? 'page' : undefined} className={className}>
            {item.label}
          </a>
        )}
      />
    );
  },
};
