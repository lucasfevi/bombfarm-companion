import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './button';
import { EmptyState } from './empty-state';

const meta = {
  title: 'UI/EmptyState inline',
  component: EmptyState,
  args: {
    size: 'inline',
    title: 'Nothing here yet',
    description: 'Entries you add will be listed in this panel.',
  },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Inline: Story = {};

export const InlineWithAction: Story = {
  args: { action: <Button variant="primary">Add an entry</Button> },
};

export const InlineSubheading: Story = {
  args: { headingLevel: 3 },
};
