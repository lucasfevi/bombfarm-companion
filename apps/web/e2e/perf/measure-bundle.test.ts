/**
 * Unit tests for tools/measure-bundle-lib.mjs helpers - MOD-37 / W1G-06.
 */
// @ts-nocheck — imports a dependency-free .mjs helper without a declaration file.
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const lib = await import('../../tools/measure-bundle-lib.mjs')
const { parseNextRouteTable, stripContentHash, walkStaticAssets } = lib

const CIRCLE = '\u25CB'
const TEE = '\u251C'
const CORNER = '\u2514'

describe('stripContentHash', () => {
  it('strips a single hash segment before the extension', () => {
    expect(stripContentHash('chunks/733-bdb40231988cf5c3.js')).toBe('chunks/733-<hash>.js')
  })

  it('strips the content-hash segment before the extension', () => {
    expect(stripContentHash('chunks/f396f26c-67590ce2b6d34b3f.js')).toBe(
      'chunks/f396f26c-<hash>.js',
    )
  })

  it('leaves a filename with no hash unchanged', () => {
    expect(stripContentHash('chunks/webpack.js')).toBe('chunks/webpack.js')
  })
})

describe('parseNextRouteTable', () => {
  const sample = [
    'Route (app)                                 Size  First Load JS',
    `${CIRCLE} /                                      124 B         102 kB`,
    `${TEE} ${CIRCLE} /_not-found                            999 B         103 kB`,
    `${CORNER} ${CIRCLE} /phases                              9.18 kB         317 kB`,
    '+ First Load JS shared by all             102 kB',
    `  ${TEE} chunks/733-bdb40231988cf5c3.js       46.2 kB`,
    `  ${TEE} chunks/f396f26c-67590ce2b6d34b3f.js  54.2 kB`,
    `  ${CORNER} other shared chunks (total)          1.95 kB`,
    '',
  ].join('\n')

  it('parses routes including a zero Size row and First Load JS', () => {
    const withZero = [
      'Route (app)                                 Size  First Load JS',
      `${CIRCLE} /                                        0 B         102 kB`,
      `${CORNER} ${CIRCLE} /phases                              9.18 kB         317 kB`,
      '+ First Load JS shared by all             102 kB',
      `  ${TEE} chunks/733-abcd.js                   46.2 kB`,
      '',
    ].join('\n')
    const { routes, sharedChunks, sharedTotalGzipBytes } = parseNextRouteTable(withZero)
    expect(routes.some((r) => r.route === '/' && r.sizeGzipBytes === 0)).toBe(true)
    expect(routes.some((r) => r.route === '/phases')).toBe(true)
    expect(sharedTotalGzipBytes).toBe(Math.round(102 * 1024))
    expect(sharedChunks.length).toBeGreaterThan(0)
  })

  it('captures the First Load JS shared by all row', () => {
    const { sharedTotalGzipBytes } = parseNextRouteTable(sample)
    expect(sharedTotalGzipBytes).toBe(Math.round(102 * 1024))
  })
})

describe('walkStaticAssets', () => {
  it('totals raw and gzip bytes at the stated level over a fixture directory', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfhp-bundle-'))
    try {
      fs.mkdirSync(path.join(dir, 'chunks'), { recursive: true })
      fs.writeFileSync(path.join(dir, 'chunks', 'abc1234567890def.js'), 'console.log(1)')
      fs.writeFileSync(path.join(dir, 'chunks', 'plain.js'), 'x'.repeat(1000))
      const { assets, totals } = walkStaticAssets(dir, 9)
      expect(totals.gzipLevel).toBe(9)
      expect(totals.rawBytes).toBeGreaterThan(0)
      expect(totals.gzipBytes).toBeGreaterThan(0)
      expect(totals.gzipBytes).toBeLessThanOrEqual(totals.rawBytes)
      expect(Object.keys(assets).some((k) => k.includes('<hash>'))).toBe(true)
      expect(assets['chunks/plain.js']).toBeDefined()
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})
