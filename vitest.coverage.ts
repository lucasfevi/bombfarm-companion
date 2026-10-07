export const DOMAIN_COVERAGE = {
  provider: 'v8',
  experimentalAstAwareRemapping: true,
  include: ['packages/domain/src/**/*.ts'],
  exclude: ['**/*.d.ts'],
  reporter: ['text-summary', 'json-summary', 'json'],
} as const;
