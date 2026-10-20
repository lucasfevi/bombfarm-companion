import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './index';

const meta = {
  title: 'UI/Button tones and sizes',
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DangerSolid: Story = {
  args: { children: 'Delete account', variant: 'primary', tone: 'danger' },
};

export const DangerOutline: Story = {
  args: { children: 'Remove access', variant: 'default', tone: 'danger' },
};

export const DangerGhost: Story = {
  args: { children: 'Discard changes', variant: 'ghost', tone: 'danger' },
};

export const Medium: Story = {
  args: { children: 'Save settings', variant: 'primary', size: 'md' },
};

export const MediumDanger: Story = {
  args: { children: 'Delete account', variant: 'primary', tone: 'danger', size: 'md' },
};
