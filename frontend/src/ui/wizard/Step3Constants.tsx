import { useStore } from '../../state'
import type { ConcUnit } from '../../engine'
import CompoundAutocomplete from '../CompoundAutocomplete'
import type { Compound } from '../../engine/compounds'

const ALL_UNITS: { value: ConcUnit; label: string }[] = [
  { value: 'M',     label: 'M'     },
  { value: 'mM',    label: 'mM'    },
  { value: 'uM',    label: 'µM'    },
  { value: '%w/v',  label: '%w/v'  },
  { value: '%v/v',  label: '%v/v'  },
  { value: 'mg/mL', label: 'mg/mL' },
  { value: 'X',     label: 'X'     },
]

const UNIT_FAMILIES: { value: ConcUnit; label: string }[][] = [
  [{ value: 'M', label: 'M' }, { value: 'mM', label: 'mM' }, { value: 'uM', label: 'µM' }],
  [{ value: '%w/v', label: '%w/v' }],
  [{ value: '%v/v', label: '%v/v' }],
  [{ value: 'mg/mL', label: 'mg/mL' }],
  [{ value: 'X', label: 'X' }],
]

function unitsInFamily(u: ConcUnit): { value: ConcUnit; label: string }[] {
  return UNIT_FAMILIES.find(f => f.some(o => o.value === u)) ?? [{ value: u, label: u }]
}

const MOLAR_UNITS: ConcUnit[] = ['M', 'mM', 'uM']
const TO_M: Partial<Record<ConcUnit, number>> = { 'M': 1, 'mM': 1e-3, 'uM': 1e-6 }

function defaultTargetUnit(stockUnit: ConcUnit): ConcUnit {
  return MOLAR_UNITS.includes(stockUnit) ? 'mM' : stockUnit
}

function defaultTargetConc(stockConc: number, stockUnit: ConcUnit, targetUnit: ConcUnit): number {
  const fromFactor = TO_M[stockUnit]
  const toFactor = TO_M[targetUnit]
  if (fromFactor !== undefined && toFactor !== undefined) {
    return (stockConc * fromFactor) / 100 / toFactor
  }
  return stockConc / 100
}

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
          {constants.map((c, i) => {
            const targetUnitOptions = unitsInFamily(c.unit)
            const targetUnit = c.targetUnit ?? c.unit
            return (
              <div key={i} className="constant-row">
                <div className="field-row" style={{ alignItems: 'flex-end' }}>
                  <div style={{ flex: 2 }}>
                    <label>Name</label>
                    <CompoundAutocomplete
                      value={c.name}
                      onChange={name => updateConstant(i, { name })}
                      onSelect={(compound: Compound) => {
                        const sUnit = compound.stock.unit as ConcUnit
                        const tUnit = defaultTargetUnit(sUnit)
                        updateConstant(i, {
                          name: compound.name,
                          stockConc: compound.stock.value,
                          unit: sUnit,
                          targetUnit: tUnit,
                          targetConc: defaultTargetConc(compound.stock.value, sUnit, tUnit),
                        })
                      }}
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
                      onChange={e => {
                        const u = e.target.value as ConcUnit
                        const newFamily = unitsInFamily(u)
                        const tUnit = newFamily.some(o => o.value === targetUnit) ? targetUnit : u
                        updateConstant(i, { unit: u, targetUnit: tUnit })
                      }}
                    >
                      {ALL_UNITS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="field-row">
                  <label>
                    Final conc
                    <input
                      type="number" min={0}
                      value={c.targetConc}
                      onChange={e => { const v = parseFloat(e.target.value); if (v >= 0) updateConstant(i, { targetConc: v }) }}
                    />
                  </label>
                  <label>
                    Unit
                    <select
                      value={targetUnit}
                      onChange={e => updateConstant(i, { targetUnit: e.target.value as ConcUnit })}
                    >
                      {targetUnitOptions.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
