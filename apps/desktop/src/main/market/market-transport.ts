/**
 * The market path's only socket, and the only file allowed to name the host it reads — the same
 * shape `https-transport.ts` holds for the account path. Both are asserted by the guards in
 * `game-api/boundaries.test.ts`.
 *
 * Reads only. There is no method field here at all, so the request can never be anything but a
 * GET, and the guard forbids one from appearing.
 */

export const MARKET_SNAPSHOT_URL =
  'https://raw.githubusercontent.com/lucasfevi/bombfarm-companion/market-data/market-prices.json';

export interface MarketHttpRequest {
  readonly url: string;
  /** Sent as a conditional validator, so an unchanged snapshot costs a 304 and no body. */
  readonly etag: string | null;
}

export interface MarketHttpResponse {
  readonly status: number;
  readonly etag: string | null;
  readonly body: string;
}

export type MarketHttpGet = (request: MarketHttpRequest) => Promise<MarketHttpResponse>;

export const marketHttpGet: MarketHttpGet = async ({ url, etag }) => {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (etag !== null) headers['if-none-match'] = etag;

  const response = await fetch(url, { headers, redirect: 'follow' });
  return {
    status: response.status,
    etag: response.headers.get('etag'),
    body: response.status === 304 ? '' : await response.text(),
  };
};
