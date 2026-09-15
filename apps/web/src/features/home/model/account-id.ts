export function shortAccountId(accountId: string): string {
  return accountId.length <= 10 ? accountId : `${accountId.slice(0, 4)}…${accountId.slice(-4)}`;
}
