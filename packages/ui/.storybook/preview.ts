import type { Preview } from '@storybook/react';
import './preview.css';
import { withAppPreview } from './decorators';

const preview: Preview = {
  decorators: [withAppPreview],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      disable: true,
    },
    layout: 'fullscreen',
    viewport: {
      viewports: {
        desktop1280: {
          name: 'Desktop 1280',
          styles: {
            width: '1280px',
            height: '800px',
          },
          type: 'desktop',
        },
        desktop1024: {
          name: 'Desktop 1024',
          styles: {
            width: '1024px',
            height: '768px',
          },
          type: 'desktop',
        },
        tablet768: {
          name: 'Tablet 768',
          styles: {
            width: '768px',
            height: '1024px',
          },
          type: 'tablet',
        },
      },
      defaultViewport: 'desktop1280',
    },
  },
};

export default preview;
