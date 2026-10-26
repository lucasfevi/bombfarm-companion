/** What a renderer window reports when a screen crashes. Every field is a string and the key set is
 *  closed: main reads exactly these five, caps each, and drops anything else the page sent. */
export interface RendererErrorRecord {
  event: string;
  screen: string;
  message: string;
  stack: string;
  componentStack: string;
}

export const RENDERER_ERROR_KEYS = [
  'event',
  'screen',
  'message',
  'stack',
  'componentStack',
] as const satisfies readonly (keyof RendererErrorRecord)[];
