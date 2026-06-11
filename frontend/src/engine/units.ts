import type { ConcUnit } from './types'

type UnitFamily = 'molar' | 'percent-wv' | 'percent-vv' | 'mass-vol' | 'relative'

const FAMILY: Record<ConcUnit, UnitFamily> = {
  'M':     'molar',
  'mM':    'molar',
  'uM':    'molar',
  '%w/v':  'percent-wv',
  '%v/v':  'percent-vv',
  'mg/mL': 'mass-vol',
  'X':     'relative',
}

export function unitFamily(u: ConcUnit): UnitFamily {
  return FAMILY[u]
}

export function sameFamily(a: ConcUnit, b: ConcUnit): boolean {
  return FAMILY[a] === FAMILY[b]
}

const TO_BASE: Record<ConcUnit, number> = {
  'M':     1,
  'mM':    1e-3,
  'uM':    1e-6,
  '%w/v':  1,
  '%v/v':  1,
  'mg/mL': 1,
  'X':     1,
}

export function toBase(value: number, unit: ConcUnit): number {
  return value * TO_BASE[unit]
}

/** Dimensionless ratio C_target / C_stock — asserts same family */
export function concRatio(
  target: number, targetUnit: ConcUnit,
  stock: number,  stockUnit: ConcUnit,
): number {
  if (!sameFamily(targetUnit, stockUnit)) {
    throw new Error(
      `Unit family mismatch: ${targetUnit} vs ${stockUnit}`,
    )
  }
  return toBase(target, targetUnit) / toBase(stock, stockUnit)
}

/** Round to given resolution (e.g. 0.1) */
export function roundTo(value: number, resolution: number): number {
  return Math.round(value / resolution) * resolution
}
