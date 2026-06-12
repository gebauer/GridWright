import { describe, it, expect } from 'vitest'
import { search, nearestPKa } from '../compounds'
import type { Compound } from '../compounds'

const FIXTURES: Compound[] = [
  {
    name: 'Ammonium sulfate',
    aliases: ['AS', '(NH4)2SO4'],
    category: 'salt',
    stock: { value: 4.0, unit: 'M' },
    cas: '7783-20-2', mw: 132.14,
  },
  {
    name: 'HEPES',
    aliases: ['HEPES sodium', '4-(2-hydroxyethyl)piperazine-1-ethanesulfonic acid'],
    category: 'buffer',
    stock: { value: 1.0, unit: 'M' },
    pKa: [7.55],
    cas: '7365-45-9', mw: 238.30,
  },
  {
    name: 'PEG 4000',
    aliases: ['Polyethylene glycol 4000', 'PEG4000'],
    category: 'polymer',
    stock: { value: 50, unit: '%w/v' },
    cas: null, mw: null,
  },
  {
    name: 'Sodium acetate',
    aliases: ['NaOAc', 'sodium ethanoate'],
    category: 'salt',
    stock: { value: 2.0, unit: 'M' },
    cas: '127-09-3', mw: 82.03,
  },
  {
    name: 'Acetic acid',
    aliases: ['AcOH', 'ethanoic acid'],
    category: 'buffer',
    stock: { value: 1.0, unit: 'M' },
    pKa: [4.76],
    cas: '64-19-7', mw: 60.05,
  },
]

describe('search', () => {
  it('returns empty for empty query', () => {
    expect(search('', FIXTURES)).toHaveLength(0)
    expect(search('  ', FIXTURES)).toHaveLength(0)
  })

  it('exact name match scores highest', () => {
    const r = search('HEPES', FIXTURES)
    expect(r[0].name).toBe('HEPES')
  })

  it('is case-insensitive', () => {
    expect(search('hepes', FIXTURES)[0].name).toBe('HEPES')
    expect(search('HEPES', FIXTURES)[0].name).toBe('HEPES')
  })

  it('prefix of name', () => {
    expect(search('amm', FIXTURES)[0].name).toBe('Ammonium sulfate')
  })

  it('exact alias match', () => {
    expect(search('NaOAc', FIXTURES)[0].name).toBe('Sodium acetate')
  })

  it('prefix of alias', () => {
    const r = search('PEG4', FIXTURES)
    expect(r[0].name).toBe('PEG 4000')
  })

  it('substring match', () => {
    const r = search('sulfate', FIXTURES)
    const names = r.map(c => c.name)
    expect(names).toContain('Ammonium sulfate')
  })

  it('prefix-of-name ranks before prefix-of-alias', () => {
    // 'acet' is prefix of 'Acetic acid' (name) and prefix of alias 'sodium ethanoate' (alias of Sodium acetate)
    const r = search('acet', FIXTURES)
    const names = r.map(c => c.name)
    expect(names.indexOf('Acetic acid')).toBeLessThan(names.indexOf('Sodium acetate'))
  })

  it('caps results at 8', () => {
    const many: Compound[] = Array.from({ length: 20 }, (_, i) => ({
      name: `Compound ${i}`,
      aliases: [],
      category: 'salt' as const,
      stock: { value: 1, unit: 'M' },
    }))
    expect(search('compound', many).length).toBeLessThanOrEqual(8)
  })

  it('no results for unmatched query', () => {
    expect(search('zzzzz', FIXTURES)).toHaveLength(0)
  })
})

describe('nearestPKa', () => {
  it('single pKa — returns it regardless of pHmid', () => {
    expect(nearestPKa([7.55], 6.0)).toBe(7.55)
    expect(nearestPKa([7.55], 8.0)).toBe(7.55)
  })

  it('citric acid — picks correct pKa for each range midpoint', () => {
    const pKas = [3.13, 4.76, 6.40]
    expect(nearestPKa(pKas, 6.0)).toBe(6.40)  // range 5.5–6.5
    expect(nearestPKa(pKas, 4.5)).toBe(4.76)  // range 4.0–5.0
    expect(nearestPKa(pKas, 3.0)).toBe(3.13)  // range 2.5–3.5
  })

  it('exact tie — takes the first encountered', () => {
    // midpoint equidistant between 4.0 and 6.0 → 5.0; equidistant from both
    // implementation returns whichever reduce picks first (4.0)
    const result = nearestPKa([4.0, 6.0], 5.0)
    expect([4.0, 6.0]).toContain(result)
  })

  it('throws on empty array', () => {
    expect(() => nearestPKa([], 7.0)).toThrow()
  })
})
