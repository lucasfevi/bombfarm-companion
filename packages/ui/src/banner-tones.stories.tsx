import type { Meta, StoryObj } from '@storybook/react';
import { Banner } from './banner';

const meta = {
  title: 'UI/Banner info and flush',
  component: Banner,
  args: {
    tone: 'info',
    title: 'About this page',
    children: 'Figures refresh when your account settings change.',
  },
} satisfies Meta<typeof Banner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Info: Story = {};

export const InfoFlush: Story = {
  args: { layout: 'flush' },
};

export const WarnFlush: Story = {
  args: { tone: 'warn', layout: 'flush', title: 'Check your settings' },
};
