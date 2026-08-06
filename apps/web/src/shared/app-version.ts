export interface ResolveVersionLabelInput {
  version: string;
  isProduction: boolean;
  commitSha?: string;
  override?: string;
}

/** Build the user-facing version label (REL-23 / REL-24). */
export function resolveVersionLabel({
  version,
  isProduction,
  commitSha,
  override,
}: ResolveVersionLabelInput): string {
  if (override) return override;

  if (isProduction) return `v${version}`;

  const sha7 = commitSha ? commitSha.slice(0, 7) : 'local';
  return `v${version}-dev.${sha7}`;
}

/** Read the label inlined at build time via `next.config.ts`. */
export function getAppVersionLabel(): string {
  return resolveVersionLabel({
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0',
    isProduction: process.env.NEXT_PUBLIC_APP_IS_PRODUCTION === 'true',
    commitSha: process.env.NEXT_PUBLIC_APP_COMMIT_SHA || undefined,
    override: process.env.NEXT_PUBLIC_APP_VERSION_LABEL_OVERRIDE || undefined,
  });
}
