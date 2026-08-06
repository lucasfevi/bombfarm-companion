import type { Meta, StoryObj } from '@storybook/react';
import { Button, Icon as UiIcon } from './index';

const meta = {
  title: 'UI/Button',
  component: Button,
  tags: ['autodocs'],
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: 'Default', variant: 'default' },
};

export const Primary: Story = {
  args: { children: 'Primary', variant: 'primary' },
};

export const Ghost: Story = {
  args: { children: 'Ghost', variant: 'ghost' },
};

export const Help: Story = {
  args: { children: '?', variant: 'help', 'aria-label': 'Help' },
};

export const HelpOn: Story = {
  args: { children: '?', variant: 'help-on', 'aria-label': 'Help active' },
};

export const Text: Story = {
  args: { children: 'Text action', variant: 'text' },
};

export const Icon: Story = {
  args: { children: '×', variant: 'icon', 'aria-label': 'Close' },
};

export const Coffee: Story = {
  args: {
    variant: 'coffee',
    children: <UiIcon name="coffee" />,
    'aria-label': 'Buy me a coffee',
  },
};

export const CoffeeFull: Story = {
  args: {
    variant: 'coffee-full',
    children: (
      <>
        <UiIcon name="coffee" />
        Buy me a coffee
      </>
    ),
  },
};

export const DisabledPrimary: Story = {
  args: { children: 'Disabled', variant: 'primary', disabled: true },
};
