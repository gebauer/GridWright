import { concRatio, roundTo } from './units'
import { mixingVolumes } from './ph'
import type {
  AxisDef,
  ConstantAdditive,
  PhAxis,
  Warning,
  WellRecipe,
} from './types'

export interface EngineConfig {
  minPipetteVolumeUL: number
  pipetteResolutionUL: number
}

interface AxisInput {
  def: AxisDef
  value: number | null
}

export function computeWell(
  row: number,
  col: number,
  xInput: AxisInput,
  yInput: AxisInput,
  constants: ConstantAdditive[],
  wellVolumeUL: number,
  cfg: EngineConfig,
): WellRecipe {
  const label = String.fromCharCode(65 + row) + String(col + 1)
  const warnings: Warning[] = []
  const components: { name: string; volumeUL: number }[] = []
  const axisValues: { x?: number; y?: number } = {}

  for (const [axisName, input] of [['x', xInput], ['y', yInput]] as const) {
    const { def, value } = input
    if (def === null || value === null) continue

    if (def.type === 'reagent') {
      axisValues[axisName] = value
      let vStock: number
      try {
        const tUnit = def.targetUnit ?? def.unit
        const r = concRatio(value, tUnit, def.stockConc, def.unit)
        if (r >= 1) {
          warnings.push({ kind: 'cannot-concentrate', well: label, reagent: def.name, minStockConc: value, unit: tUnit })
        }
        vStock = r * wellVolumeUL
      } catch {
        warnings.push({ kind: 'unit-mismatch', reagent: def.name, message: `Unit mismatch on axis ${axisName}` })
        vStock = 0
      }
      components.push({ name: def.name, volumeUL: vStock })

    } else {
      axisValues[axisName] = value
      let vBuf: number
      try {
        vBuf = concRatio(def.concentration, def.concUnit, def.stockConc, def.stockUnit) * wellVolumeUL
      } catch {
        warnings.push({ kind: 'unit-mismatch', reagent: def.bufferName, message: `Buffer unit mismatch on axis ${axisName}` })
        continue
      }

      if (def.prepMode === 'individual') {
        components.push({ name: `${def.bufferName} pH ${fmtPH(value)}`, volumeUL: vBuf })
      } else {
        const { pHLow, pHHigh } = phStockRange(def)
        const { vHigh, vLow, outOfRange } = mixingVolumes(value, pHLow, pHHigh, def.pKa, vBuf)
        if (outOfRange) {
          warnings.push({ kind: 'ph-out-of-range', well: label, targetPH: value, rangeLow: pHLow, rangeHigh: pHHigh })
        }
        components.push({ name: `${def.bufferName} pH ${fmtPH(pHHigh)}`, volumeUL: vHigh })
        components.push({ name: `${def.bufferName} pH ${fmtPH(pHLow)}`,  volumeUL: vLow })
      }
    }
  }

  for (const c of constants) {
    let vStock: number
    try {
      const tUnit = c.targetUnit ?? c.unit
      const r = concRatio(c.targetConc, tUnit, c.stockConc, c.unit)
      if (r >= 1) {
        warnings.push({ kind: 'cannot-concentrate', well: label, reagent: c.name, minStockConc: c.targetConc, unit: tUnit })
      }
      vStock = r * wellVolumeUL
    } catch {
      warnings.push({ kind: 'unit-mismatch', reagent: c.name, message: 'Constant unit mismatch' })
      vStock = 0
    }
    components.push({ name: c.name, volumeUL: vStock })
  }

  const rounded = components.map(c => ({
    name: c.name,
    volumeUL: roundTo(c.volumeUL, cfg.pipetteResolutionUL),
  }))

  const totalStock = rounded.reduce((s, c) => s + c.volumeUL, 0)
  const waterUL = wellVolumeUL - totalStock

  if (waterUL < 0) {
    const culprit = rounded.reduce((a, b) => (b.volumeUL > a.volumeUL ? b : a)).name
    warnings.push({ kind: 'over-volume', well: label, overflowUL: -waterUL, culprit })
  }

  for (const c of rounded) {
    if (c.volumeUL > 0 && c.volumeUL < cfg.minPipetteVolumeUL) {
      warnings.push({ kind: 'sub-pipettable', well: label, reagent: c.name, volumeUL: c.volumeUL })
    }
  }

  return { row, col, label, axisValues, components: rounded, waterUL, totalUL: wellVolumeUL, warnings }
}

/**
 * Derive the two stock pH endpoints for mixing mode.
 * For a range spec, stocks are at [low, high]; for a list, stocks are at [min, max].
 * The actual per-well target comes from the expanded axis value, not from here.
 */
function phStockRange(def: PhAxis): { pHLow: number; pHHigh: number } {
  const spec = def.pH
  if (spec.kind === 'list') {
    return { pHLow: Math.min(...spec.values), pHHigh: Math.max(...spec.values) }
  }
  return { pHLow: spec.low, pHHigh: spec.high }
}

function fmtPH(n: number): string {
  return n.toFixed(1)
}
