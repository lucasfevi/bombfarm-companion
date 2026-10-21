import type { Meta, StoryObj } from '@storybook/react';
import { SiteFooter } from './site-footer';

const linkClass = 'text-xs text-accent underline-offset-2 hover:underline';

const meta = {
  title: 'UI/SiteFooter',
  component: SiteFooter,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SiteFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    legal: <span>© 2026 Acme. All rights reserved.</span>,
    trailing: (
      <>
        <a className={linkClass} href="#terms">
          Terms
        </a>
        <a className={linkClass} href="#privacy">
          Privacy
        </a>
      </>
    ),
  },
};

export const LegalOnly: Story = {
  args: { legal: <span>© 2026 Acme. All rights reserved.</span> },
};
