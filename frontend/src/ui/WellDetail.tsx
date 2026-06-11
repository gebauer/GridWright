import { formatVolume } from './formatters'
import type { ScreenDocument, Warning, WellRecipe } from '../engine'

interface Props {
  well: WellRecipe
  doc: ScreenDocument
  onClose: () => void
}

export default function WellDetail({ well, doc, onClose }: Props) {
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
              ? `${doc.axes.x.name}: ${fmtN(well.axisValues.x)} ${doc.axes.x.unit}`
              : `pH ${fmtN(well.axisValues.x)}`}
          </span>
        )}
        {well.axisValues.y !== undefined && doc.axes.y && (
          <span className="axis-chip">
            {doc.axes.y.type === 'reagent'
              ? `${doc.axes.y.name}: ${fmtN(well.axisValues.y)} ${doc.axes.y.unit}`
              : `pH ${fmtN(well.axisValues.y)}`}
          </span>
        )}
      </div>

      <table className="recipe-table">
        <tbody>
          {well.components.map((c, i) => (
            <tr key={i}>
              <td>{c.name}</td>
              <td className="vol">{formatVolume(c.volumeUL)}</td>
            </tr>
          ))}
          <tr className="water-row">
            <td>Water</td>
            <td className="vol">{formatVolume(Math.max(0, well.waterUL))}</td>
          </tr>
          <tr className="total-row">
            <td><strong>Total</strong></td>
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
