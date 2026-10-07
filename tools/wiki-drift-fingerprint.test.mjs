import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { fingerprintPayload, sha256Json } from './wiki-drift/fingerprint.mjs';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const FIXTURES = join(root, 'wiki-drift/__fixtures__');

const apiData = JSON.parse(readFileSync(join(FIXTURES, 'api-data.captured.json'), 'utf8'));
const fasesNomes = JSON.parse(readFileSync(join(FIXTURES, 'fases-nomes.captured.json'), 'utf8'));
const baseline = JSON.parse(readFileSync(join(root, 'wiki-drift/fingerprint.baseline.json'), 'utf8'));

// Recomputed from the frozen capture with the same function, and reproduced here as literals so
// a reviewer can compare by eye without running anything. The capture is the 2026-09-30 pull of
// the live endpoint, the same one the committed baseline was taken from — the test below that
// compares the two is what keeps this capture from going stale again (it sat at 2026-08-14 for a
// month while the catalog moved under it).
const API_DATA_PAYLOAD_SHA256 = 'ed1994cfe45d5e90f6ced8f72596bd27b1c4adfcaae10e4c90575fccc689a3df';
const API_DATA_SECTION_SHA256 = {
  bolsa: '32e0d7a1eeb1e027b19c8efe0c9731792167b68346fc626adf5e1cb4bda7c6fb',
  boost: '69a3669fbad66c90a7ea19a41b6e0d69605f66fcb4e1b7f2850435b2c1dd813b',
  combate: 'b97475c0fc8784cc0e748bef836373f504522845198212cfe48f462f7e4cf725',
  conquistas: '45307b99ead1f60b7b95e5a3d2e390a4ea795831f69b9473e4c0f00ca38074c5',
  convite: '734f099a3c27f91869764bd8b7446a05b0121632a3c5c14719138f7221b30015',
  diaria: '37139dc0f4c183ace7593b9a8161aae20d36807d94cf3e29308dfbe48152231e',
  drops: '126937a4c0e30373e8b6ffe9a46ad3e6dc3ed45eb5e27ca7dd1579c9a9cded47',
  entidades: '8abc9272d059d18c5a1af18f2542f98579f7d84130a87fc93ec41d46f9925c86',
  fases: '837853ea4e700d6973ca675a9efcea85036da849d7b6b564fe327193078d8c4a',
  gemas: '611140ce2878ce4290580a2efaea428a765313efcf58e08b5a1459985df0bc83',
  habilidades: '229ca91579752fc96e9c4bc68070f183cf748edf27875bdedfbb6b1a499be480',
  herois: '580aa49dbf4cf58cd4532ba36972525d13263d1fa39deb1e9d3b622c672215e1',
  inventario: 'f53ee894e7ca1e5b9bb78c589912f33fa099c175f66030b439fbb0ccc2edf74a',
  item_stats: '94041e8cad48122447a273106df9ecccec1c44d569659737dfd73fa44bb7cd79',
  itens: '3c62de2a14ac4dc705f23e3443986d3ffe9658fafd921c0f8998e760c75f11dc',
  mercado: 'a0f334373960949666fb787087fe2dde632de09c54cbca6080ada5e772f1aa25',
  pedra: 'baedadf2ed982b0c12570e2c82d6b4ce2f305d6c9ff401fc5b9f70f714196a43',
  premios: 'e5e42ac4bd041411e9ece92b3ee3f3e337bf3f7f0e6fb79575118ebaed81e4ef',
  pvp: '94da20fd028ee53086eeb4465738364af88d39fb07ac13a5d9ba478269233806',
  ranking_premio: '370ec771247cf90ab821e8ea75ae808802362cb38b9069c50f52813875d184a7',
  raridades: 'e014307c9fa181014e6669a97b435adf1813069b2cba314bb8623ee89b0bd070',
  ritual: '7651edd4871d5be5aeb13774ad41b2c05caee3a679d7fc8cf1928451fd01fd43',
  rotacao: '73e7c9aaa8005f213c3c956d180e13d028424e2b3cc5caf07fa01d886cf0dc5a',
  runas: '8fa20b25d9ca493cb44845d19621031f33bb8fc9a9a10cd932fa26e6129a4b78',
  skill_tree: 'eb974ad0de05cb0005f9652f651337795eb3d161a2abc0b1a91777ec7eec9e59',
  skins: '8b89b65eaed5a7b5af48f0fbdb3fdab02f69d3f467e67b25e268900389ff5da0',
  slots: 'a6337d8d90139df16155157e7880ac185bd2428460320714cdbac97fdcc7071a',
  stat_kinds: '8cd8ba2c0b3f951aae2d864a2113c9cd8d7a0c017653653adf47cb0bc6da94f6',
  vip: '4db9e88c30b3099154b0e3606ade1f2433cc34c2411b3ac9ea6888c74dc22cd4',
};
const API_DATA_SECTION_NAMES = [
  'bolsa', 'boost', 'combate', 'conquistas', 'convite', 'diaria', 'drops', 'entidades', 'fases',
  'gemas', 'habilidades', 'herois', 'inventario', 'item_stats', 'itens', 'mercado', 'pedra',
  'premios', 'pvp', 'ranking_premio', 'raridades', 'ritual', 'rotacao', 'runas', 'skill_tree',
  'skins', 'slots', 'stat_kinds', 'vip',
];

// /wiki/api/fases-nomes has no counterpart published anywhere in the sync manifest — this is a
// known asymmetry between the two endpoints. These values are recomputed from the same frozen
// capture with the same function, not copied from an external source.
const FASES_NOMES_PAYLOAD_SHA256 = 'bd18e2884696db862e5fdd402c838c5cdb4564645392f0f3a39b8b6d9b91a19a';
const FASES_NOMES_SECTION_SHA256 = {
  disponivel: 'b5bea41b6c623f7c09f1bf24dcae58ebab3c0cdd90ad966bc43a45b44867e12b',
  fases: 'c4071c42cc1125c4427abe56a1b2e9fbdc9031bab3f42b470eed7db1503fc684',
  mundos: '9b9020478fe5a38119b22ca9ff4b176d7833c0cfcb4bd6fc5911463d2cc2c568',
  zonas: 'f09ebb77590a1122a2658739cde5c0b65cb230f2a3348892e205015a5c9ceb14',
};
const FASES_NOMES_SECTION_NAMES = ['disponivel', 'fases', 'mundos', 'zonas'];

describe('sha256Json — the raw hash primitive', () => {
  it('is sha256(JSON.stringify(value)), utf8, no canonicalisation', () => {
    expect(sha256Json({ b: 1, a: 2 })).toBe(sha256Json(JSON.parse(JSON.stringify({ b: 1, a: 2 }))));
    expect(sha256Json({ a: 1, b: 2 })).not.toBe(sha256Json({ b: 2, a: 1 }));
  });
});

describe('fingerprintPayload — /wiki/api/data frozen capture', () => {
  const fp = fingerprintPayload('https://wiki.bombfarm.net/wiki/api/data', apiData);

  it('reproduces the published whole-payload sha256 exactly', () => {
    expect(fp.payloadSha256).toBe(API_DATA_PAYLOAD_SHA256);
  });

  it('reproduces the published fases section sha256 exactly', () => {
    expect(fp.sectionSha256.fases).toBe(API_DATA_SECTION_SHA256.fases);
  });

  it('versaoCatalogo is 4', () => {
    expect(fp.versaoCatalogo).toBe(4);
  });

  it('sectionNames is the sorted 29-name list', () => {
    expect(fp.sectionNames).toEqual(API_DATA_SECTION_NAMES);
  });

  it('all 29 section hashes match their literals', () => {
    expect(fp.sectionSha256).toEqual(API_DATA_SECTION_SHA256);
  });

  it('is the capture the committed baseline was taken from — a stale fixture would let the catalog drift past the tests that read it', () => {
    expect(fp.payloadSha256).toBe(baseline.endpoints.data.payloadSha256);
    expect(fp.sectionSha256).toEqual(baseline.endpoints.data.sectionSha256);
  });

  it('carries the ability rows the catalog is priced from, at their live values', () => {
    const byCode = Object.fromEntries(apiData.habilidades.map((row) => [row.code, row]));
    expect(byCode.misericordia.per_level).toBe(0.0075);
    expect(byCode.olho_clinico.per_level).toBe(0.02);
    expect(byCode.brecha).toMatchObject({ kind: 'team_pen', per_level: 1, max: 20 });
    expect(byCode.matilha).toMatchObject({ kind: 'pack_dmg', per_level: 0.005, max: 20 });
    expect(byCode.pavio_curto).toMatchObject({ kind: 'cdr_add', per_level: 0.005, max: 20 });
    expect(byCode.carnificina).toMatchObject({ kind: 'team_crit_dmg', per_level: 0.05, max: 20 });
    expect(byCode.matador_chefes).toMatchObject({ kind: 'boss_dmg', per_level: 0.05, max: 20 });
    expect(byCode.aprendiz).toMatchObject({ kind: 'team_xp', per_level: 0.0075, max: 20 });
    expect(apiData.combate.pack_dmg_cap).toBe(0.9);
    expect(apiData.combate.swap_dmg_secs).toBe(120);
    expect(apiData.combate.swap_dmg_cooldown_secs).toBe(600);
  });

  it('carries the url unchanged', () => {
    expect(fp.url).toBe('https://wiki.bombfarm.net/wiki/api/data');
  });
});

describe('fingerprintPayload — /wiki/api/fases-nomes frozen capture (no itens, no versao_catalogo)', () => {
  const fp = fingerprintPayload('https://wiki.bombfarm.net/wiki/api/fases-nomes', fasesNomes);

  it('reproduces the whole-payload sha256', () => {
    expect(fp.payloadSha256).toBe(FASES_NOMES_PAYLOAD_SHA256);
  });

  it('sectionNames is the sorted 4-name list', () => {
    expect(fp.sectionNames).toEqual(FASES_NOMES_SECTION_NAMES);
  });

  it('all 4 section hashes match', () => {
    expect(fp.sectionSha256).toEqual(FASES_NOMES_SECTION_SHA256);
  });

  it('versaoCatalogo is null — this endpoint has no itens at all', () => {
    expect(fp.versaoCatalogo).toBeNull();
  });

  it('the non-object section `disponivel` (a boolean) is hashed and appears in sectionNames', () => {
    expect(typeof fasesNomes.disponivel).toBe('boolean');
    expect(fp.sectionNames).toContain('disponivel');
    expect(fp.sectionSha256.disponivel).toBe(FASES_NOMES_SECTION_SHA256.disponivel);
  });
});
