import { useStore } from '../../state'
import type { ConcUnit, PhAxis, ReagentAxis, ValueSpec } from '../../engine'
import CompoundAutocomplete from '../CompoundAutocomplete'
import type { Compound } from '../../engine/compounds'
import { nearestPKa } from '../../engine/compounds'

const ALL_UNITS: { value: ConcUnit; label: string }[] = [
  { value: 'M',     label: 'M'     },
  { value: 'mM',    label: 'mM'    },
  { value: 'uM',    label: 'µM'    },
  { value: '%w/v',  label: '%w/v'  },
  { value: '%v/v',  label: '%v/v'  },
  { value: 'mg/mL', label: 'mg/mL' },
  { value: 'X',     label: 'X'     },
]

const MOLAR_UNITS: { value: ConcUnit; label: string }[] = [
  { value: 'M',  label: 'M'  },
  { value: 'mM', label: 'mM' },
  { value: 'uM', label: 'µM' },
]

function UnitSelect({
  value,
  options = ALL_UNITS,
  onChange,
}: {
  value: ConcUnit
  options?: { value: ConcUnit; label: string }[]
  onChange: (u: ConcUnit) => void
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value as ConcUnit)}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

function ValueSpecInput({
  spec,
  n,
  onChange,
}: {
  spec: ValueSpec
  n: number
  onChange: (s: ValueSpec) => void
}) {
  const isRange = spec.kind === 'range'

  function switchToList() {
    if (spec.kind !== 'range') return
    const { low, high } = spec
    const vals = Array.from({ length: n }, (_, i) => {
      const t = n === 1 ? 0 : i / (n - 1)
      return Math.round((low + (high - low) * t) * 1000) / 1000
    })
    onChange({ kind: 'list', values: vals })
  }

  function switchToRange() {
    if (spec.kind !== 'list') return
    const low  = Math.min(...spec.values)
    const high = Math.max(...spec.values)
    onChange({ kind: 'range', low, high })
  }

  return (
    <div className="value-spec">
      <div className="toggle-row">
        <button
          className={`tgl${isRange ? ' active' : ''}`}
          onClick={() => { if (!isRange) switchToRange() }}
        >
          Range
        </button>
        <button
          className={`tgl${!isRange ? ' active' : ''}`}
          onClick={() => { if (isRange) switchToList() }}
        >
          List
        </button>
      </div>

      {isRange ? (
        <div className="field-row">
          <label>
            Low
            <input
              type="number"
              value={spec.low}
              onChange={e => {
                const v = parseFloat(e.target.value)
                if (!isNaN(v)) onChange({ ...spec, low: v })
              }}
            />
          </label>
          <label>
            High
            <input
              type="number"
              value={spec.high}
              onChange={e => {
                const v = parseFloat(e.target.value)
                if (!isNaN(v)) onChange({ ...spec, high: v })
              }}
            />
          </label>
        </div>
      ) : (
        <label>
          {`Values — comma-separated (${n} for ${n} step${n !== 1 ? 's' : ''})`}
          <input
            type="text"
            key={spec.values.join(',')}
            defaultValue={spec.values.join(', ')}
            onBlur={e => {
              const vals = e.target.value
                .split(',')
                .map(v => parseFloat(v.trim()))
                .filter(v => !isNaN(v))
              if (vals.length > 0) onChange({ kind: 'list', values: vals })
            }}
          />
        </label>
      )}
    </div>
  )
}

function ReagentCard({ ax, def }: { ax: 'x' | 'y'; def: ReagentAxis }) {
  const { doc, updateAxis } = useStore()
  const n = ax === 'x' ? doc.plate.cols : doc.plate.rows
  const set = (patch: Partial<ReagentAxis>) => updateAxis(ax, { ...def, ...patch })

  return (
    <div className="axis-card">
      <div className="axis-card-title">{ax.toUpperCase()} — Reagent</div>

      <label>Name</label>
      <CompoundAutocomplete
        value={def.name}
        onChange={name => set({ name })}
        onSelect={(c: Compound) => set({
          name: c.name,
          stockConc: c.stock.value,
          unit: c.stock.unit as ConcUnit,
        })}
      />

      <div className="field-row">
        <label>
          Stock conc
          <input
            type="number" min={0}
            value={def.stockConc}
            onChange={e => { const v = parseFloat(e.target.value); if (v > 0) set({ stockConc: v }) }}
          />
        </label>
        <label>
          Unit
          <UnitSelect value={def.unit} onChange={u => set({ unit: u })} />
        </label>
      </div>

      <div className="field-group-label">
        Target concentrations ({n} {ax === 'x' ? 'column' : 'row'}{n !== 1 ? 's' : ''})
      </div>
      <ValueSpecInput spec={def.values} n={n} onChange={vs => set({ values: vs })} />
    </div>
  )
}

function PhCard({ ax, def }: { ax: 'x' | 'y'; def: PhAxis }) {
  const { doc, updateAxis } = useStore()
  const n = ax === 'x' ? doc.plate.cols : doc.plate.rows
  const set = (patch: Partial<PhAxis>) => updateAxis(ax, { ...def, ...patch })

  return (
    <div className="axis-card">
      <div className="axis-card-title">{ax.toUpperCase()} — pH buffer</div>

      <label>Buffer name</label>
      <CompoundAutocomplete
        value={def.bufferName}
        onChange={bufferName => set({ bufferName })}
        onSelect={(c: Compound) => {
          const patch: Partial<PhAxis> = { bufferName: c.name }
          if (c.stock.unit === 'M' || c.stock.unit === 'mM' || c.stock.unit === 'uM') {
            patch.stockConc = c.stock.value
            patch.stockUnit = c.stock.unit as ConcUnit
          }
          if (c.pKa && c.pKa.length > 0) {
            const phSpec = def.pH
            const pHmid = phSpec.kind === 'range'
              ? (phSpec.low + phSpec.high) / 2
              : phSpec.values.length > 0
                ? (Math.min(...phSpec.values) + Math.max(...phSpec.values)) / 2
                : 7.0
            patch.pKa = nearestPKa(c.pKa, pHmid)
          }
          set(patch)
        }}
      />

      <div className="field-row">
        <label>
          Final conc
          <input
            type="number" min={0}
            value={def.concentration}
            onChange={e => { const v = parseFloat(e.target.value); if (v > 0) set({ concentration: v }) }}
          />
        </label>
        <label>
          Unit
          <UnitSelect value={def.concUnit} options={MOLAR_UNITS} onChange={u => set({ concUnit: u })} />
        </label>
      </div>

      <div className="field-row">
        <label>
          Stock conc
          <input
            type="number" min={0}
            value={def.stockConc}
            onChange={e => { const v = parseFloat(e.target.value); if (v > 0) set({ stockConc: v }) }}
          />
        </label>
        <label>
          Unit
          <UnitSelect value={def.stockUnit} options={MOLAR_UNITS} onChange={u => set({ stockUnit: u })} />
        </label>
      </div>

      <label>
        pKa
        <input
          type="number" step={0.01}
          value={def.pKa}
          onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) set({ pKa: v }) }}
        />
      </label>

      <div className="field-group-label">
        pH values ({n} {ax === 'x' ? 'column' : 'row'}{n !== 1 ? 's' : ''})
      </div>
      <ValueSpecInput spec={def.pH} n={n} onChange={vs => set({ pH: vs })} />

      <label>
        Preparation mode
        <select
          value={def.prepMode}
          onChange={e => set({ prepMode: e.target.value as 'mixing' | 'individual' })}
        >
          <option value="mixing">Mixing — 2 stocks blended per well</option>
          <option value="individual">Individual — one pre-adjusted stock per pH</option>
        </select>
      </label>
    </div>
  )
}

export default function Step2Axes() {
  const { doc } = useStore()
  const { axes } = doc
  const noneSelected = axes.x === null && axes.y === null

  if (noneSelected) {
    return (
      <div className="wizard-step">
        <p className="ws-empty">
          No axes selected. Go back to Step 1 and choose at least one axis.
        </p>
      </div>
    )
  }

  return (
    <div className="wizard-step">
      {axes.x !== null && axes.x.type === 'reagent' && <ReagentCard ax="x" def={axes.x} />}
      {axes.x !== null && axes.x.type === 'ph'      && <PhCard      ax="x" def={axes.x} />}
      {axes.y !== null && axes.y.type === 'reagent' && <ReagentCard ax="y" def={axes.y} />}
      {axes.y !== null && axes.y.type === 'ph'      && <PhCard      ax="y" def={axes.y} />}
    </div>
  )
}
