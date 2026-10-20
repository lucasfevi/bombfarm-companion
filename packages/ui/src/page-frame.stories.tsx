import type { Meta, StoryObj } from '@storybook/react';
import { Banner } from './banner';
import { PageFrame, PageSection } from './page-frame';
import { Panel } from './panel';
import { SiteFooter } from './site-footer';
import { SiteHeader } from './site-header';

const meta = {
  title: 'UI/PageFrame',
  component: PageFrame,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof PageFrame>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    header: <SiteHeader brand={<span className="text-sm font-bold text-ink">Acme</span>} />,
    notices: <Banner title="Scheduled maintenance">Reports are read-only tonight.</Banner>,
    children: (
      <>
        <PageSection>
          <Panel>Reports overview</Panel>
        </PageSection>
        <PageSection measure="settings">
          <Panel>Settings form</Panel>
        </PageSection>
      </>
    ),
    footer: <SiteFooter legal={<span>© 2026 Acme. All rights reserved.</span>} />,
  },
};
