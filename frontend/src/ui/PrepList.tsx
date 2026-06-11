import { formatVolume } from './formatters'
import type { PrepEntry, Warning } from '../engine'

interface Props {
  prep: PrepEntry[]
  warnings: Warning[]
}

export default function PrepList({ prep, warnings }: Props) {
  if (prep.length === 0 && warnings.length === 0) return null

  return (
    <div className="prep-list">
      {prep.length > 0 && (
        <>
          <h3>Stocks to prepare</h3>
          <table className="prep-table">
            <thead>
              <tr>
                <th>Stock</th>
                <th>Conc.</th>
                <th>Volume needed</th>
              </tr>
            </thead>
            <tbody>
              {prep.map((p, i) => (
                <tr key={i}>
                  <td>{p.name}</td>
                  <td className="mono">{p.conc}</td>
                  <td className="vol mono">{formatVolume(p.volumeUL)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {warnings.length > 0 && (
        <div className="global-warnings">
          <h4>Screen warnings</h4>
          {warnings.map((w, i) => (
            <div key={i} className="warning-item warning-global">{globalText(w)}</div>
          ))}
        </div>
      )}
    </div>
  )
}

function globalText(w: Warning): string {
  switch (w.kind) {
    case 'cannot-concentrate':
      return `${w.reagent}: target concentration ≥ stock — increase stock concentration`
    case 'unit-mismatch':
      return w.message
    case 'over-volume':
      return `Well ${w.well}: over-volume by ${formatVolume(w.overflowUL)}`
    case 'sub-pipettable':
      return `Well ${w.well}: ${w.reagent} volume ${formatVolume(w.volumeUL)} is sub-pipettable`
    case 'ph-out-of-range':
      return `Well ${w.well}: pH ${w.targetPH} outside stock range [${w.rangeLow}–${w.rangeHigh}]`
    case 'list-length-mismatch':
      return `${w.axis.toUpperCase()} axis: list has ${w.got} value${w.got !== 1 ? 's' : ''} but plate has ${w.expected} step${w.expected !== 1 ? 's' : ''} — edit the list or adjust plate size`
  }
}
