import type { ReactNode } from 'react'
import { formatVolume } from './formatters'
import type { ScreenDocument, Warning, WellRecipe } from '../engine'

interface Props {
  well: WellRecipe
  doc: ScreenDocument
  onClose: () => void
}

export default function WellDetail({ well, doc, onClose }: Props) {
  // Classify each component row so we can style it appropriately
  function categorize(name: string): 'axis-reagent' | 'axis-ph' | 'constant' {
    if (doc.axes.x?.type === 'reagent' && doc.axes.x.name === name) return 'axis-reagent'
    if (doc.axes.y?.type === 'reagent' && doc.axes.y.name === name) return 'axis-reagent'
    if (doc.axes.x?.type === 'ph' && name.startsWith(doc.axes.x.bufferName + ' ')) return 'axis-ph'
    if (doc.axes.y?.type === 'ph' && name.startsWith(doc.axes.y.bufferName + ' ')) return 'axis-ph'
    return 'constant'
  }

  // Concentration label for each component (by name)
  const concMap = new Map<string, string>()

  if (doc.axes.x?.type === 'reagent' && well.axisValues.x !== undefined) {
    const ax = doc.axes.x
    concMap.set(ax.name, `${fmtN(well.axisValues.x)} ${ax.targetUnit ?? ax.unit}`)
  }
  if (doc.axes.y?.type === 'reagent' && well.axisValues.y !== undefined) {
    const ax = doc.axes.y
    concMap.set(ax.name, `${fmtN(well.axisValues.y)} ${ax.targetUnit ?? ax.unit}`)
  }
  // Buffer axes: label all matching components with the final buffer concentration
  for (const ax of [doc.axes.x, doc.axes.y]) {
    if (ax?.type !== 'ph') continue
    const bufConc = `${ax.concentration} ${ax.concUnit}`
    for (const comp of well.components) {
      if (comp.name.startsWith(ax.bufferName + ' ')) {
        concMap.set(comp.name, bufConc)
      }
    }
  }
  for (const c of doc.constants) {
    if (c.name.trim()) {
      concMap.set(c.name, `${fmtN(c.targetConc)} ${c.targetUnit ?? c.unit}`)
    }
  }

  // For pH components, render "Buffer name pH X.X" with the pH part bold-indigo
  function renderName(name: string, category: string): ReactNode {
    if (category === 'axis-ph') {
      const m = name.match(/^(.+?)\s+(pH\s+[\d.]+)$/)
      if (m) return <>{m[1]} <span className="axis-value">{m[2]}</span></>
    }
    return name
  }

  return (
    <div className="well-detail">
      <div className="well-detail-header">
        <h3>Well {well.label}</h3>
        <button className="close-btn" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <div className="axis-chips">
        {well.axisValues.x !== undefined && doc.axes.x && (
          <span className="axis-chip">
            {doc.axes.x.type === 'reagent'
              ? <>{doc.axes.x.name}: <strong className="axis-value">{fmtN(well.axisValues.x)} {doc.axes.x.targetUnit ?? doc.axes.x.unit}</strong></>
              : <><span className="axis-chip-label">{doc.axes.x.bufferName}</span> <strong className="axis-value">pH {well.axisValues.x.toFixed(1)}</strong></>}
          </span>
        )}
        {well.axisValues.y !== undefined && doc.axes.y && (
          <span className="axis-chip">
            {doc.axes.y.type === 'reagent'
              ? <>{doc.axes.y.name}: <strong className="axis-value">{fmtN(well.axisValues.y)} {doc.axes.y.targetUnit ?? doc.axes.y.unit}</strong></>
              : <><span className="axis-chip-label">{doc.axes.y.bufferName}</span> <strong className="axis-value">pH {well.axisValues.y.toFixed(1)}</strong></>}
          </span>
        )}
      </div>

      <table className="recipe-table">
        <tbody>
          {well.components.map((c, i) => {
            const cat = categorize(c.name)
            return (
              <tr key={i} className={cat === 'constant' ? 'row-constant' : ''}>
                <td>{renderName(c.name, cat)}</td>
                <td className={`conc${cat === 'axis-reagent' ? ' conc-axis' : ''}`}>
                  {concMap.get(c.name) ?? ''}
                </td>
                <td className="vol">{formatVolume(c.volumeUL)}</td>
              </tr>
            )
          })}
          <tr className="water-row">
            <td>Water</td>
            <td className="conc"></td>
            <td className="vol">{formatVolume(Math.max(0, well.waterUL))}</td>
          </tr>
          <tr className="total-row">
            <td><strong>Total</strong></td>
            <td className="conc"></td>
            <td className="vol"><strong>{formatVolume(well.totalUL)}</strong></td>
          </tr>
        </tbody>
      </table>

      {well.warnings.length > 0 && (
        <ul className="well-warnings">
          {well.warnings.map((w, i) => (
            <li key={i} className="warning-item">{warnText(w)}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function fmtN(n: number): string {
  return Number.isInteger(n) ? String(n) : (Math.round(n * 10) / 10).toFixed(1)
}

function warnText(w: Warning): string {
  switch (w.kind) {
    case 'over-volume':
      return `Over volume: ${formatVolume(w.overflowUL)} excess (largest: ${w.culprit})`
    case 'cannot-concentrate':
      return `Cannot concentrate: ${w.reagent} — stock must be > ${fmtN(w.minStockConc)} ${w.unit}`
    case 'sub-pipettable':
      return `Sub-pipettable: ${w.reagent} needs only ${formatVolume(w.volumeUL)}`
    case 'ph-out-of-range':
      return `pH out of range: target ${w.targetPH} outside [${w.rangeLow}–${w.rangeHigh}]`
    case 'unit-mismatch':
      return `Unit mismatch: ${w.message}`
    case 'list-length-mismatch':
      return `${w.axis.toUpperCase()} axis list has ${w.got} values but plate expects ${w.expected}`
  }
}
