import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { fingerprintPayload, sha256Json } from './wiki-drift/fingerprint.mjs';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const FIXTURES = join(root, 'wiki-drift/__fixtures__');

const apiData = JSON.parse(readFileSync(join(FIXTURES, 'api-data.captured.json'), 'utf8'));
const fasesNomes = JSON.parse(readFileSync(join(FIXTURES, 'fases-nomes.captured.json'), 'utf8'));

// Published by the maintainer's out-of-band wiki sync manifest — reproduced here as literals so a
// reviewer can compare by eye without running anything (MWD-04).
const API_DATA_PAYLOAD_SHA256 = 'a96761a2ac3da630ada92e69ec99f613bd9ee00416e01209791f0d3ac86769ac';
const API_DATA_SECTION_SHA256 = {
  bolsa: '32e0d7a1eeb1e027b19c8efe0c9731792167b68346fc626adf5e1cb4bda7c6fb',
  combate: 'ef1741392e2818b3ba0f8f1a33c5d71b82738af553f8286f6400e0ce650d992a',
  drops: 'b9c58b472b37326d38294b4dc6a90cb95ec0b3b7be705a7689ac9376e0406190',
  entidades: '0e2b05855ffd654a816f8924ca4ac48bf2a4c6e01ddca243e2639fe1a62a5404',
  fases: '5490ccd7957eb3f9befaea292bd6954deaadb3ea61dc2d172d3a152e63e1175e',
  gemas: '611140ce2878ce4290580a2efaea428a765313efcf58e08b5a1459985df0bc83',
  habilidades: 'e50fcbe9f6de147c7e5c90a1870acbb50cdde306716a708e7d119f68e6edf219',
  herois: 'f8eb8d5ddac0fa8ade944cc506521c5132f67ecb999e8955547e966bdc4e0ea8',
  item_stats: '94041e8cad48122447a273106df9ecccec1c44d569659737dfd73fa44bb7cd79',
  itens: 'a70a534300f7000dbcfd293d13bcb1bf1f2de53b4ce00c72718a097b303e5e5a',
  raridades: 'e014307c9fa181014e6669a97b435adf1813069b2cba314bb8623ee89b0bd070',
  ritual: 'a486a2038923a790260fed88a7da126d44a922f223f2bcb12f7052e275619234',
  rotacao: '07f7c614feb424c0c32b64c09e97f0f431f056d3df9e5b3cc858f7b9a283fa90',
  skill_tree: '67cb17f9ba7aa0b4f0988982ab8618b67e3e09197639c5f10865b2d4b9d8a79a',
  slots: 'a6337d8d90139df16155157e7880ac185bd2428460320714cdbac97fdcc7071a',
  stat_kinds: '8cd8ba2c0b3f951aae2d864a2113c9cd8d7a0c017653653adf47cb0bc6da94f6',
};
const API_DATA_SECTION_NAMES = [
  'bolsa', 'combate', 'drops', 'entidades', 'fases', 'gemas', 'habilidades', 'herois',
  'item_stats', 'itens', 'raridades', 'ritual', 'rotacao', 'skill_tree', 'slots', 'stat_kinds',
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

describe('fingerprintPayload — /wiki/api/data frozen capture (MWD-04)', () => {
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

  it('sectionNames is the sorted 16-name list', () => {
    expect(fp.sectionNames).toEqual(API_DATA_SECTION_NAMES);
  });

  it('all 16 section hashes match their published literals', () => {
    expect(fp.sectionSha256).toEqual(API_DATA_SECTION_SHA256);
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
