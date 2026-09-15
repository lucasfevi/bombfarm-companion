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
// a reviewer can compare by eye without running anything. The capture is the 2026-09-13 pull of
// the live endpoint, the same one the committed baseline was taken from — the test below that
// compares the two is what keeps this capture from going stale again (it sat at 2026-08-14 for a
// month while the catalog moved under it).
const API_DATA_PAYLOAD_SHA256 = '978af31b5fcc4e7bc565149a55c9b2a43d0149691bbab2e574d47864dd5d59ec';
const API_DATA_SECTION_SHA256 = {
  bolsa: '32e0d7a1eeb1e027b19c8efe0c9731792167b68346fc626adf5e1cb4bda7c6fb',
  boost: '69a3669fbad66c90a7ea19a41b6e0d69605f66fcb4e1b7f2850435b2c1dd813b',
  combate: 'e091381182a42419c768c72b49eeb0c95b608ffc8e7de3eb08a6c3645b4ffae7',
  conquistas: '45307b99ead1f60b7b95e5a3d2e390a4ea795831f69b9473e4c0f00ca38074c5',
  convite: '734f099a3c27f91869764bd8b7446a05b0121632a3c5c14719138f7221b30015',
  diaria: 'c9a95b57f74a143144085b0cfa949d2ae107bb8f263aaa834c6fcb94b8b1eb58',
  drops: '126937a4c0e30373e8b6ffe9a46ad3e6dc3ed45eb5e27ca7dd1579c9a9cded47',
  entidades: '8abc9272d059d18c5a1af18f2542f98579f7d84130a87fc93ec41d46f9925c86',
  fases: '837853ea4e700d6973ca675a9efcea85036da849d7b6b564fe327193078d8c4a',
  gemas: '611140ce2878ce4290580a2efaea428a765313efcf58e08b5a1459985df0bc83',
  habilidades: 'cc75be52e2f58496e4611a71e46271507c41d7d2e624c2e5c9a806a2b4da9759',
  herois: 'fa204d3a4fac674a7f993bdd0519a2a45cc48121a2087f678bffd00cf36ee31e',
  inventario: '9865c0b84a2f0bbaed1504d96a69d3724292b7f58eb7b64565efe7d0cc4c8524',
  item_stats: '94041e8cad48122447a273106df9ecccec1c44d569659737dfd73fa44bb7cd79',
  itens: '3c62de2a14ac4dc705f23e3443986d3ffe9658fafd921c0f8998e760c75f11dc',
  mercado: 'a0f334373960949666fb787087fe2dde632de09c54cbca6080ada5e772f1aa25',
  pedra: 'baedadf2ed982b0c12570e2c82d6b4ce2f305d6c9ff401fc5b9f70f714196a43',
  premios: '8f56c679d3d9d8503c9e75d346303130f9b540b6d0c3533ea60d1143f7ab9f1a',
  pvp: 'd17015302379dc558d2c1c8559f576f308fc563bafa52d7ac709b9fc6d4474a6',
  ranking_premio: '370ec771247cf90ab821e8ea75ae808802362cb38b9069c50f52813875d184a7',
  raridades: 'e014307c9fa181014e6669a97b435adf1813069b2cba314bb8623ee89b0bd070',
  ritual: 'a486a2038923a790260fed88a7da126d44a922f223f2bcb12f7052e275619234',
  rotacao: '73e7c9aaa8005f213c3c956d180e13d028424e2b3cc5caf07fa01d886cf0dc5a',
  runas: '8fa20b25d9ca493cb44845d19621031f33bb8fc9a9a10cd932fa26e6129a4b78',
  skill_tree: 'eb974ad0de05cb0005f9652f651337795eb3d161a2abc0b1a91777ec7eec9e59',
  skins: '48734c667e8f2399a71c40c80f7979789b5890b265b5734f40eeba4790431e2f',
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
const FASES_NOMES_PAYLOAD_SHA256 = '1e86671a6c65ab2fd58ff17a1d301eabac7683a275c179d3572588c9d844b116';
const FASES_NOMES_SECTION_SHA256 = {
  atos: '327db39dbafc7d09004aa9473b9b224951ca7876dbda804e68ccc0adbff9731c',
  disponivel: 'b5bea41b6c623f7c09f1bf24dcae58ebab3c0cdd90ad966bc43a45b44867e12b',
  fases: 'c4071c42cc1125c4427abe56a1b2e9fbdc9031bab3f42b470eed7db1503fc684',
  mundos: '9b9020478fe5a38119b22ca9ff4b176d7833c0cfcb4bd6fc5911463d2cc2c568',
  sufixos: '542027bfad2da67c4431695ac445bc1b369b8e247299ba149772769cd92aeb0f',
  zonas: 'f09ebb77590a1122a2658739cde5c0b65cb230f2a3348892e205015a5c9ceb14',
};
const FASES_NOMES_SECTION_NAMES = ['atos', 'disponivel', 'fases', 'mundos', 'sufixos', 'zonas'];

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

  it('sectionNames is the sorted 6-name list', () => {
    expect(fp.sectionNames).toEqual(FASES_NOMES_SECTION_NAMES);
  });

  it('all 6 section hashes match', () => {
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
