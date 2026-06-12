import { Fragment } from 'react'
import type { GridResult, ScreenDocument } from '../engine'

interface Props {
  doc: ScreenDocument
  result: GridResult
}

export default function PrintWorksheet({ doc, result }: Props) {
  const { meta, plate } = doc
  const { wells, prep } = result

  // Stock conc string keyed by component name, for inline display in well cells
  const stockConc = new Map<string, string>()
  for (const p of prep) stockConc.set(p.name, p.conc)

  const rowLetters = Array.from({ length: plate.rows }, (_, r) =>
    String.fromCharCode(65 + r),
  )

  const today = new Date().toLocaleString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long',
    day: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  // Metadata fields shown in the header line — only include fields that were filled in
  const metaFields: string[] = []
  if (meta.sample)                      metaFields.push(`Sample: ${meta.sample}`)
  if (meta.name)                        metaFields.push(`Experiment: ${meta.name}`)
  if (meta.operator)                    metaFields.push(meta.operator)
  if (meta.temperatureC !== undefined)  metaFields.push(`${meta.temperatureC} °C`)
  metaFields.push(`Date: ${today}`)

  // Group wells by row index
  const rowWells = Array.from({ length: plate.rows }, (_, r) =>
    wells.filter(w => w.row === r),
  )

  return (
    <div className="pw">
      {/* ── Single-line meta header ─────────────────────────── */}
      <div className="pw-header-line">
        {metaFields.map((f, i) => (
          <Fragment key={i}>
            {i > 0 && <span className="pw-sep">·</span>}
            <span>{f}</span>
          </Fragment>
        ))}
      </div>

      {/* ── Plate grid ─────────────────────────────────────── */}
      <div
        className="pw-plate"
        style={{ gridTemplateColumns: `2em repeat(${plate.cols}, 1fr)` }}
      >
        {/* Column headers */}
        <div />
        {Array.from({ length: plate.cols }, (_, c) => (
          <div key={c} className="pw-col-hdr">{c + 1}</div>
        ))}

        {/* Rows: letter header + well cells */}
        {rowWells.map((rw, r) => (
          <Fragment key={r}>
            <div className="pw-row-hdr">{rowLetters[r]}</div>
            {rw.map(w => (
              <div key={w.label} className={`pw-well${w.warnings.length > 0 ? ' pw-warn' : ''}`}>
                {w.components.map((c, i) => (
                  <div key={i} className="pw-line">
                    {`${c.volumeUL.toFixed(2)} µL ${stockConc.get(c.name) ?? ''} ${c.name}`.trim()}
                  </div>
                ))}
                <div className="pw-water">
                  {`${Math.max(0, w.waterUL).toFixed(2)} µL H₂O`}
                </div>
              </div>
            ))}
          </Fragment>
        ))}
      </div>

      {/* ── Prep list ──────────────────────────────────────── */}
      {prep.length > 0 && (
        <div className="pw-prep">
          <h3>Total volumes of reagents used</h3>
          <table className="pw-prep-table">
            <thead>
              <tr>
                <th>Reagent</th>
                <th>Concentration</th>
                <th>Volume (µL)</th>
                <th>Volume (mL)</th>
              </tr>
            </thead>
            <tbody>
              {prep.map((p, i) => (
                <tr key={i}>
                  <td>{p.name}</td>
                  <td>{p.conc}</td>
                  <td>{Math.round(p.volumeUL * 10) / 10}</td>
                  <td>{(p.volumeUL / 1000).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
