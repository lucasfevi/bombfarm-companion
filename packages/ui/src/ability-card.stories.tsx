import type { Meta, StoryObj } from '@storybook/react';
import { AbilityCard } from './index';

const meta = {
  title: 'UI/AbilityCard',
  component: AbilityCard,
  tags: ['autodocs'],
  args: {
    children: 'Fireball',
  },
} satisfies Meta<typeof AbilityCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OffSheetUnselected: Story = {
  args: { onSheet: false, selected: false, lockedOut: false },
};

export const OffSheetSelected: Story = {
  args: { onSheet: false, selected: true, lockedOut: false },
};

export const OnSheetUnselected: Story = {
  args: { onSheet: true, selected: false, lockedOut: false },
};

export const OnSheetSelected: Story = {
  args: { onSheet: true, selected: true, lockedOut: false },
};

export const LockedOut: Story = {
  args: { onSheet: false, selected: false, lockedOut: true },
};
