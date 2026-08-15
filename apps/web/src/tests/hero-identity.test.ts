import { describe, expect, it } from 'vitest';
import { shortHeroRecordId } from '@/shared/lib/hero-identity';

/**
 * Regression net for the `hero-identity-chip.tsx` promotion (`@/shared/team-plan` ->
 * `@/shared/game-art`): `shortHeroRecordId` moved from `build-team-plan-input.ts` to
 * `@/shared/lib/hero-identity.ts` unchanged. This pins its behaviour so the move cannot
 * silently change what any of its three call sites render.
 */
describe('shortHeroRecordId', () => {
  it('prefers sourceId over id when both are present', () => {
    expect(shortHeroRecordId({ id: 'local-id-abc', sourceId: 'save-99999' })).toBe('99999');
  });

  it('falls back to id when sourceId is absent', () => {
    expect(shortHeroRecordId({ id: 'local-id-abc' })).toBe('d-abc');
  });

  it('returns the last 5 characters when the id is longer than 5 characters', () => {
    expect(shortHeroRecordId({ id: 'abcdefgh' })).toBe('defgh');
  });

  it('returns the id unchanged when it is 5 characters or fewer', () => {
    expect(shortHeroRecordId({ id: 'ab' })).toBe('ab');
    expect(shortHeroRecordId({ id: 'abcde' })).toBe('abcde');
  });
});
