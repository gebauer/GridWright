import { expandValues } from './expand'
import { computeWell } from './well'
import type { GridResult, PhAxis, PrepEntry, ScreenDocument, Warning } from './types'

const DEFAULTS = {
  minPipetteVolumeUL:   0.5,
  pipetteResolutionUL:  0.1,
  deadVolumeMultiplier: 1.2,
}

/** An axis is "ready" only once the user has given it a name. */
export function isAxisReady(ax: ScreenDocument['axes']['x']): ax is NonNullable<typeof ax> {
  if (!ax) return false
  return ax.type === 'reagent' ? ax.name.trim() !== '' : ax.bufferName.trim() !== ''
}

export function computeGrid(doc: ScreenDocument): GridResult {
  const { plate, constants } = doc
  const config = doc.config ?? {}
  // Treat unnamed axes as absent so the preview stays neutral until the user configures them.
  const axes = {
    x: isAxisReady(doc.axes.x) ? doc.axes.x : null,
    y: isAxisReady(doc.axes.y) ? doc.axes.y : null,
  }
  const cfg = {
    minPipetteVolumeUL:   config.minPipetteVolumeUL   ?? DEFAULTS.minPipetteVolumeUL,
    pipetteResolutionUL:  config.pipetteResolutionUL  ?? DEFAULTS.pipetteResolutionUL,
    deadVolumeMultiplier: config.deadVolumeMultiplier ?? DEFAULTS.deadVolumeMultiplier,
  }

  const wellVolumeUL = plate.volumeUnit === 'mL'
    ? plate.wellVolume * 1000
    : plate.wellVolume

  // Detect list-length mismatches upfront so they appear as global warnings.
  const structureWarnings: Warning[] = []
  if (axes.x) {
    const spec = axes.x.type === 'reagent' ? axes.x.values : axes.x.pH
    if (spec.kind === 'list' && spec.values.length !== plate.cols)
      structureWarnings.push({ kind: 'list-length-mismatch', axis: 'x', expected: plate.cols, got: spec.values.length })
  }
  if (axes.y) {
    const spec = axes.y.type === 'reagent' ? axes.y.values : axes.y.pH
    if (spec.kind === 'list' && spec.values.length !== plate.rows)
      structureWarnings.push({ kind: 'list-length-mismatch', axis: 'y', expected: plate.rows, got: spec.values.length })
  }

  const xValues = axes.x
    ? expandValues(axes.x.type === 'reagent' ? axes.x.values : axes.x.pH, plate.cols)
    : null
  const yValues = axes.y
    ? expandValues(axes.y.type === 'reagent' ? axes.y.values : axes.y.pH, plate.rows)
    : null

  const rowOffset = plate.rowOffset ?? 0
  const colOffset = plate.colOffset ?? 0

  const wells = []
  for (let r = 0; r < plate.rows; r++) {
    for (let c = 0; c < plate.cols; c++) {
      wells.push(computeWell(
        r, c,
        { def: axes.x, value: xValues ? xValues[c] : null },
        { def: axes.y, value: yValues ? yValues[r] : null },
        constants,
        wellVolumeUL,
        cfg,
        rowOffset,
        colOffset,
      ))
    }
  }

  // Deduplicated global warnings (unit-mismatch and cannot-concentrate are per-reagent, not per-well)
  const seen = new Set<string>()
  const globalWarnings: Warning[] = [...structureWarnings]
  for (const w of wells.flatMap(w => w.warnings)) {
    if (w.kind !== 'unit-mismatch' && w.kind !== 'cannot-concentrate') continue
    const key = `${w.kind}:${w.reagent}`
    if (!seen.has(key)) { seen.add(key); globalWarnings.push(w) }
  }

  const prep = buildPrepList(doc, wells, xValues, yValues, cfg.deadVolumeMultiplier)
  return { wells, prep, warnings: globalWarnings }
}

function buildPrepList(
  doc: ScreenDocument,
  wells: ReturnType<typeof computeWell>[],
  xValues: number[] | null,
  yValues: number[] | null,
  deadVolMultiplier: number,
): PrepEntry[] {
  const totals = new Map<string, number>()
  const meta   = new Map<string, { conc: string }>()

  for (const well of wells) {
    for (const c of well.components) {
      totals.set(c.name, (totals.get(c.name) ?? 0) + c.volumeUL)
    }
  }

  if (doc.axes.x) {
    const ax = doc.axes.x
    if (ax.type === 'reagent') {
      meta.set(ax.name, { conc: `${ax.stockConc} ${ax.unit}` })
    } else {
      registerPhStockMeta(ax, meta, xValues ?? [])
    }
  }
  if (doc.axes.y) {
    const ax = doc.axes.y
    if (ax.type === 'reagent') {
      meta.set(ax.name, { conc: `${ax.stockConc} ${ax.unit}` })
    } else {
      registerPhStockMeta(ax, meta, yValues ?? [])
    }
  }
  for (const c of doc.constants) {
    meta.set(c.name, { conc: `${c.stockConc} ${c.unit}` })
  }

  return Array.from(totals.entries()).map(([name, sumUL]) => ({
    name,
    conc: meta.get(name)?.conc ?? '',
    volumeUL: sumUL * deadVolMultiplier,
  }))
}

function registerPhStockMeta(
  ax: PhAxis,
  meta: Map<string, { conc: string }>,
  expanded: number[],
): void {
  const concStr = `${ax.stockConc} ${ax.stockUnit}`
  if (ax.prepMode === 'individual') {
    // One stock per distinct target pH
    for (const p of expanded) {
      meta.set(`${ax.bufferName} pH ${p.toFixed(1)}`, { conc: concStr })
    }
  } else {
    // Two stocks: one at pHLow, one at pHHigh
    const pHLow  = Math.min(...expanded)
    const pHHigh = Math.max(...expanded)
    meta.set(`${ax.bufferName} pH ${pHHigh.toFixed(1)}`, { conc: concStr })
    meta.set(`${ax.bufferName} pH ${pHLow.toFixed(1)}`,  { conc: concStr })
  }
}
