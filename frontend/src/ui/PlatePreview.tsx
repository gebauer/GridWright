import { useMemo } from 'react'
import { expandValues } from '../engine/expand'
import { formatAxisHeader } from './formatters'
import type { AxisDef, GridResult, ScreenDocument, WellRecipe } from '../engine'
import { isAxisReady } from '../engine'

interface Props {
  doc: ScreenDocument
  result: GridResult
  colourBy: string
  selectedWell: WellRecipe | null
  onWellClick: (well: WellRecipe) => void
  onColourByChange: (key: string) => void
}

// Slate-50 → Indigo-600
function heatColor(t: number): string {
  const r = Math.round(248 - (248 - 79) * t)
  const g = Math.round(250 - (250 - 70) * t)
  const b = Math.round(252 - (252 - 229) * t)
  return `rgb(${r},${g},${b})`
}

function colourOptions(doc: ScreenDocument): { key: string; label: string }[] {
  const opts: { key: string; label: string }[] = []
  const axLabel = (ax: NonNullable<AxisDef>) =>
    ax.type === 'reagent' ? ax.name : `pH (${ax.bufferName})`
  if (isAxisReady(doc.axes.x)) opts.push({ key: 'x', label: axLabel(doc.axes.x) })
  if (isAxisReady(doc.axes.y)) opts.push({ key: 'y', label: axLabel(doc.axes.y) })
  for (const c of doc.constants) if (c.name.trim()) opts.push({ key: `c:${c.name}`, label: c.name })
  return opts
}

function axisHeaders(ax: AxisDef, n: number): string[] {
  if (!isAxisReady(ax)) return Array.from({ length: n }, (_, i) => String(i + 1))
  const spec = ax.type === 'reagent' ? ax.values : ax.pH
  const unit = ax.type === 'reagent' ? ax.unit : undefined
  return expandValues(spec, n).map(v => formatAxisHeader(v, ax.type, unit))
}

export default function PlatePreview({ doc, result, colourBy, selectedWell, onWellClick, onColourByChange }: Props) {
  const { plate, axes } = doc
  const { wells } = result

  const opts = useMemo(() => colourOptions(doc), [doc])
  const activeKey = opts.some(o => o.key === colourBy) ? colourBy : (opts[0]?.key ?? 'x')

  const colHeaders = useMemo(() => axisHeaders(axes.x, plate.cols), [axes.x, plate.cols])
  const rowHeaders = useMemo(() => axisHeaders(axes.y, plate.rows), [axes.y, plate.rows])

  const normColors = useMemo(() => {
    const vals = wells.map(w =>
      activeKey === 'x' ? w.axisValues.x :
      activeKey === 'y' ? w.axisValues.y :
      undefined
    )
    const nums = vals.filter((v): v is number => v !== undefined)
    if (nums.length === 0) return wells.map(() => 0)
    const min = Math.min(...nums)
    const max = Math.max(...nums)
    const range = max - min
    return vals.map(v => (v !== undefined && range > 0) ? (v - min) / range : 0)
  }, [wells, activeKey])

  const gridCells = useMemo(() => {
    const cells: JSX.Element[] = [
      <div key="corner" className="plate-corner" />,
      ...colHeaders.map((h, c) => (
        <div key={`ch-${c}`} className="plate-col-header" title={h}>{h}</div>
      )),
    ]
    for (let r = 0; r < plate.rows; r++) {
      cells.push(<div key={`rh-${r}`} className="plate-row-header">{rowHeaders[r]}</div>)
      for (let c = 0; c < plate.cols; c++) {
        const idx = r * plate.cols + c
        const well = wells[idx]
        const t = normColors[idx]
        const isSelected = selectedWell?.row === r && selectedWell?.col === c
        const hasWarning = well.warnings.length > 0
        const cls = ['plate-well', isSelected && 'selected', hasWarning && 'has-warning']
          .filter(Boolean).join(' ')
        cells.push(
          <button
            key={`w-${r}-${c}`}
            className={cls}
            style={{ backgroundColor: heatColor(t) }}
            onClick={() => onWellClick(well)}
            title={well.label}
          >
            <span className="well-label">{well.label}</span>
            {hasWarning && <span className="well-warning-dot" aria-hidden />}
          </button>
        )
      }
    }
    return cells
  }, [colHeaders, rowHeaders, plate, wells, normColors, selectedWell, onWellClick])

  return (
    <div className="plate-preview">
      {opts.length > 0 && (
        <div className="plate-controls">
          <label className="colour-by-label">
            Colour by
            <select value={activeKey} onChange={e => onColourByChange(e.target.value)}>
              {opts.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </label>
        </div>
      )}
      <div
        className="plate-grid"
        style={{ gridTemplateColumns: `80px repeat(${plate.cols}, 44px)` }}
      >
        {gridCells}
      </div>
    </div>
  )
}
