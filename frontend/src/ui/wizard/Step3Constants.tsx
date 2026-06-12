import { useStore } from '../../state'
import type { ConcUnit } from '../../engine'
import CompoundAutocomplete from '../CompoundAutocomplete'
import type { Compound } from '../../engine/compounds'

const CONC_UNITS: { value: ConcUnit; label: string }[] = [
  { value: 'M',     label: 'M'     },
  { value: 'mM',    label: 'mM'    },
  { value: 'uM',    label: 'µM'    },
  { value: '%w/v',  label: '%w/v'  },
  { value: '%v/v',  label: '%v/v'  },
  { value: 'mg/mL', label: 'mg/mL' },
  { value: 'X',     label: 'X'     },
]

export default function Step3Constants() {
  const { doc, addConstant, removeConstant, updateConstant } = useStore()
  const { constants } = doc

  return (
    <div className="wizard-step">
      <div className="ws-header">
        <span className="ws-title">Constant additives</span>
        <button className="btn-add" onClick={addConstant}>+ Add</button>
      </div>

      {constants.length === 0 ? (
        <p className="ws-empty">
          No constants. Click "Add" to include a reagent present at the same
          concentration in every well.
        </p>
      ) : (
        <div className="constant-list">
          {constants.map((c, i) => (
            <div key={i} className="constant-row">
              <div className="field-row" style={{ alignItems: 'flex-end' }}>
                <div style={{ flex: 2 }}>
                  <label>Name</label>
                  <CompoundAutocomplete
                    value={c.name}
                    onChange={name => updateConstant(i, { name })}
                    onSelect={(compound: Compound) => updateConstant(i, {
                      name: compound.name,
                      stockConc: compound.stock.value,
                      unit: compound.stock.unit as ConcUnit,
                    })}
                  />
                </div>
                <button className="btn-remove" onClick={() => removeConstant(i)} title="Remove">✕</button>
              </div>
              <div className="field-row">
                <label>
                  Stock conc
                  <input
                    type="number" min={0}
                    value={c.stockConc}
                    onChange={e => { const v = parseFloat(e.target.value); if (v > 0) updateConstant(i, { stockConc: v }) }}
                  />
                </label>
                <label>
                  Unit
                  <select
                    value={c.unit}
                    onChange={e => updateConstant(i, { unit: e.target.value as ConcUnit })}
                  >
                    {CONC_UNITS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Target conc
                  <input
                    type="number" min={0}
                    value={c.targetConc}
                    onChange={e => { const v = parseFloat(e.target.value); if (v >= 0) updateConstant(i, { targetConc: v }) }}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
