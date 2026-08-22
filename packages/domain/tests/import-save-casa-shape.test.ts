/**
 * `casa` on an `AccountPayload` now has two legitimate producers: the API path, whose `/rotation`
 * route yields its whole body (a nested `casa` house object alongside `field_size`/`heroes`/
 * `rescues_left`/`rescues_max`), and the save-file export path, whose `casa` key is the house
 * object directly (`save-schema.ts`'s `CASA_LEVEL`, unchanged). `mapAccountData`'s single read
 * site resolves either shape to the same house fields.
 */
import { describe, expect, it } from 'vitest';
import type { AccountPayload } from '@bombfarm/contracts';
import { parseAccountPayload } from '@bombfarm/domain/import-save';

function payloadWithCasa(casa: unknown): AccountPayload {
  return { heroes: [], casa } as unknown as AccountPayload;
}

describe('import-save — casa resolves either the whole /rotation body or a bare house object', () => {
  it('a nested casa object (the /rotation route body) resolves the house fields from the nested object', () => {
    const result = parseAccountPayload(
      payloadWithCasa({
        field_size: 5,
        heroes: [],
        rescues_left: 1,
        rescues_max: 3,
        casa: { active_casa: 2, levels: [3, 5, 1], cycle_secs: 100 },
      }),
      [],
    );

    expect(result.account.houseIdx).toBe(1);
    expect(result.account.houseLevel).toBe(5);
    expect(result.account.houseCycleSecs).toBe(100);
  });

  it('a bare house object (the save-export shape) resolves the same house fields directly', () => {
    const result = parseAccountPayload(payloadWithCasa({ active_casa: 2, levels: [3, 5, 1], cycle_secs: 100 }), []);

    expect(result.account.houseIdx).toBe(1);
    expect(result.account.houseLevel).toBe(5);
    expect(result.account.houseCycleSecs).toBe(100);
  });

  it('a non-object casa resolves as absent — houseIdx/houseLevel/houseCycleSecs all null', () => {
    const result = parseAccountPayload(payloadWithCasa('not-an-object'), []);

    expect(result.account.houseIdx).toBeNull();
    expect(result.account.houseLevel).toBeNull();
    expect(result.account.houseCycleSecs).toBeNull();
  });

  it('an absent casa key resolves the same as a non-object casa', () => {
    const result = parseAccountPayload({ heroes: [] } as unknown as AccountPayload, []);

    expect(result.account.houseIdx).toBeNull();
    expect(result.account.houseLevel).toBeNull();
    expect(result.account.houseCycleSecs).toBeNull();
  });

  it('a drifted /rotation body with no nested house resolves slots and house cycle seconds as absent, not a default', () => {
    const result = parseAccountPayload(
      payloadWithCasa({ field_size: 5, heroes: [], rescues_left: 1, rescues_max: 3 }),
      [],
    );

    expect(result.account.houseIdx).toBeNull();
    expect(result.account.houseLevel).toBeNull();
    expect(result.account.slots).toBeUndefined();
    expect(result.account.houseCycleSecs).toBeNull();
  });

  it('a nested casa that is itself not an object falls back to treating the outer value as the house', () => {
    // `casa.casa` present but non-object (e.g. a stray scalar) is not the nested-house shape —
    // the resolver's fallback treats the whole `casa` value as the house object instead, so
    // `active_casa` (a real house field sitting alongside the stray `casa` key) still resolves.
    const result = parseAccountPayload(payloadWithCasa({ active_casa: 1, levels: [1], casa: 'not-an-object' }), []);

    expect(result.account.houseIdx).toBe(0);
    expect(result.account.houseLevel).toBe(1);
  });
});
