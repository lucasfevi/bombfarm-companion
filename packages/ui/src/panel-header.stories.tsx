import type { Meta, StoryObj } from '@storybook/react';
import { Panel } from './panel';
import { PanelHeader } from './panel-header';

const meta = {
  title: 'UI/PanelHeader',
  component: PanelHeader,
  tags: ['autodocs'],
  args: {
    title: 'Points',
  },
  decorators: [
    (Story) => (
      <Panel>
        <Story />
      </Panel>
    ),
  ],
} satisfies Meta<typeof PanelHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TitleOnly: Story = {};

export const WithTrailingContent: Story = {
  args: {
    children: <span className="text-xs text-muted">Spent 3 / 10</span>,
  },
};
