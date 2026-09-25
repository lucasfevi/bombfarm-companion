import { net } from 'electron';
import type { UsagePingBody } from './usage-ping.js';

const USAGE_PING_URL = 'https://api.bombfarm-companion.app/v1/ping';
const SEND_TIMEOUT_MS = 10_000;

export async function sendUsagePing(body: UsagePingBody): Promise<void> {
  const response = await net.fetch(USAGE_PING_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`status ${String(response.status)}`);
}
