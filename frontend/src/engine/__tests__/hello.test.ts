import { describe, it, expect } from 'vitest'
import { computeGrid } from '../index'
import type { ScreenDocument } from '../types'

describe('engine — M1 hello', () => {
  it('returns a 2×2 all-water grid for a minimal screen', () => {
    const doc: ScreenDocument = {
      version: 1,
      meta: {},
      plate: { rows: 2, cols: 2, wellVolume: 1000, volumeUnit: 'uL' },
      axes: { x: null, y: null },
      constants: [],
    }
    const result = computeGrid(doc)
    expect(result.wells).toHaveLength(4)
    expect(result.prep).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)

    for (const well of result.wells) {
      expect(well.totalUL).toBe(1000)
      expect(well.waterUL).toBe(1000)
      expect(well.components).toHaveLength(0)
    }

    expect(result.wells[0].label).toBe('A1')
    expect(result.wells[1].label).toBe('A2')
    expect(result.wells[2].label).toBe('B1')
    expect(result.wells[3].label).toBe('B2')
  })

  it('converts mL well volume to µL internally', () => {
    const doc: ScreenDocument = {
      version: 1,
      meta: {},
      plate: { rows: 1, cols: 1, wellVolume: 2, volumeUnit: 'mL' },
      axes: { x: null, y: null },
      constants: [],
    }
    const result = computeGrid(doc)
    expect(result.wells[0].totalUL).toBe(2000)
    expect(result.wells[0].waterUL).toBe(2000)
  })
})
