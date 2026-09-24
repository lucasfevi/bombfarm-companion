import type { AppFlavor } from './flavors.js';

export type UsagePingKind = 'startup' | 'hourly';

export interface UsagePingAccount {
  readonly id: string;
  readonly name: string | null;
}

/** Everything the desktop app's hourly usage ping sends. The published privacy policy renders a
 *  sentence for every key below, typed against these lists, so a field cannot be added here
 *  without the policy describing it. */
export interface UsagePingBody {
  readonly v: 1;
  readonly kind: UsagePingKind;
  readonly flavor: AppFlavor;
  readonly version: string;
  readonly install: string | null;
  readonly account: UsagePingAccount | null;
}

export const USAGE_PING_FIELDS = ['v', 'kind', 'flavor', 'version', 'install', 'account'] as const;
export type UsagePingField = (typeof USAGE_PING_FIELDS)[number];

export const USAGE_PING_ACCOUNT_FIELDS = ['id', 'name'] as const;
export type UsagePingAccountField = (typeof USAGE_PING_ACCOUNT_FIELDS)[number];

type Exhaustive<Listed, Declared> = [Exclude<Declared, Listed>, Exclude<Listed, Declared>] extends [never, never]
  ? true
  : never;

export const USAGE_PING_FIELDS_ARE_EXHAUSTIVE: Exhaustive<UsagePingField, keyof UsagePingBody> = true;
export const USAGE_PING_ACCOUNT_FIELDS_ARE_EXHAUSTIVE: Exhaustive<UsagePingAccountField, keyof UsagePingAccount> =
  true;
