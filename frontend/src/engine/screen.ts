import { expandValues } from './expand'
import { concRatio } from './units'
import { computeWell } from './well'
import type { GridResult, PhAxis, PrepEntry, ScreenDocument, Warning } from './types'

const DEFAULTS = {
  minPipetteVolumeUL:   0.5,
  pipetteResolutionUL:  0.1,
  deadVolumeMultiplier: 1.2,
}

export function computeGrid(doc: ScreenDocument): GridResult {
  const { plate, axes, constants, config = {} } = doc
  const cfg = {
    minPipetteVolumeUL:   config.minPipetteVolumeUL   ?? DEFAULTS.minPipetteVolumeUL,
    pipetteResolutionUL:  config.pipetteResolutionUL  ?? DEFAULTS.pipetteResolutionUL,
    deadVolumeMultiplier: config.deadVolumeMultiplier ?? DEFAULTS.deadVolumeMultiplier,
  }

  const wellVolumeUL = plate.volumeUnit === 'mL'
    ? plate.wellVolume * 1000
    : plate.wellVolume

  // Expand axis values
  const xValues = axes.x ? expandValues(
    axes.x.type === 'reagent' ? axes.x.values : axes.x.pH,
    plate.cols,
  ) : null

  const yValues = axes.y ? expandValues(
    axes.y.type === 'reagent' ? axes.y.values : axes.y.pH,
    plate.rows,
  ) : null

  const wells = []
  for (let r = 0; r < plate.rows; r++) {
    for (let c = 0; c < plate.cols; c++) {
      const well = computeWell(
        r, c,
        { def: axes.x, value: xValues ? xValues[c] : null },
        { def: axes.y, value: yValues ? yValues[r] : null },
        constants,
        wellVolumeUL,
        cfg,
      )
      wells.push(well)
    }
  }

  // Aggregate global warnings (unique kinds)
  const globalWarnings: Warning[] = []
  for (const w of wells.flatMap(w => w.warnings)) {
    if (w.kind === 'unit-mismatch' || w.kind === 'cannot-concentrate') {
      if (!globalWarnings.some(g => g.kind === w.kind && 'reagent' in g && g.reagent === (w as { reagent: string }).reagent)) {
        globalWarnings.push(w)
      }
    }
  }

  // Build prep list
  const prep = buildPrepList(doc, wells, xValues, yValues, wellVolumeUL, cfg.deadVolumeMultiplier)

  return { wells, prep, warnings: globalWarnings }
}

function buildPrepList(
  doc: ScreenDocument,
  wells: ReturnType<typeof computeWell>[],
  xValues: number[] | null,
  yValues: number[] | null,
  wellVolumeUL: number,
  deadVolMultiplier: number,
): PrepEntry[] {
  // Accumulate total volume per stock name
  const totals = new Map<string, number>()
  const meta   = new Map<string, { conc: string }>()

  for (const well of wells) {
    for (const c of well.components) {
      totals.set(c.name, (totals.get(c.name) ?? 0) + c.volumeUL)
    }
  }

  // Register metadata for each stock name
  if (doc.axes.x) {
    const ax = doc.axes.x
    if (ax.type === 'reagent') {
      meta.set(ax.name, { conc: `${ax.stockConc} ${ax.unit}` })
    } else {
      registerPhStockMeta(ax, meta, xValues ?? [], doc.plate.cols, wellVolumeUL)
    }
  }
  if (doc.axes.y) {
    const ax = doc.axes.y
    if (ax.type === 'reagent') {
      meta.set(ax.name, { conc: `${ax.stockConc} ${ax.unit}` })
    } else {
      registerPhStockMeta(ax, meta, yValues ?? [], doc.plate.rows, wellVolumeUL)
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
  _expanded: number[],
  _count: number,
  _wellVolumeUL: number,
): void {
  const concStr = `${ax.stockConc} ${ax.stockUnit}`
  if (ax.prepMode === 'individual') {
    const vals = ax.pH.kind === 'list' ? ax.pH.values : [ax.pH.low, ax.pH.high]
    for (const p of vals) {
      meta.set(`${ax.bufferName} pH ${p}`, { conc: concStr })
    }
  } else {
    const vals = ax.pH.kind === 'list' ? ax.pH.values : [ax.pH.low, ax.pH.high]
    const pHLow  = Math.min(...vals)
    const pHHigh = Math.max(...vals)
    meta.set(`${ax.bufferName} pH ${pHHigh}`, { conc: concStr })
    meta.set(`${ax.bufferName} pH ${pHLow}`,  { conc: concStr })
  }
}
