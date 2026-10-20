import type { Meta, StoryObj } from '@storybook/react';
import { BrandLockup } from './brand-lockup';
import { siteHeaderBrandClass } from './site-header.recipe';

const meta = {
  title: 'UI/BrandLockup',
  component: BrandLockup,
  tags: ['autodocs'],
  args: { title: 'Acme', tag: 'Planner' },
  decorators: [
    (Story) => (
      <a href="#home" className={siteHeaderBrandClass}>
        <Story />
      </a>
    ),
  ],
} satisfies Meta<typeof BrandLockup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutTag: Story = { args: { tag: undefined } };
