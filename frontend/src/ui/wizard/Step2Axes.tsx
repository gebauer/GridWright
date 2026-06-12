import { useStore } from '../../state'
import type { ConcUnit, PhAxis, ReagentAxis, ValueSpec } from '../../engine'
import CompoundAutocomplete from '../CompoundAutocomplete'
import type { Compound } from '../../engine/compounds'
import { nearestPKa } from '../../engine/compounds'
import compoundsData from '../../../../compounds.json'

const ALL_COMPOUNDS: Compound[] = (compoundsData as { compounds: Compound[] }).compounds

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
  fieldWarnings,
  unit,
  unitOptions,
  onUnitChange,
}: {
  spec: ValueSpec
  n: number
  onChange: (s: ValueSpec) => void
  fieldWarnings?: { low?: boolean; high?: boolean }
  unit?: ConcUnit
  unitOptions?: { value: ConcUnit; label: string }[]
  onUnitChange?: (u: ConcUnit) => void
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
              className={fieldWarnings?.low ? 'input-ph-warn' : undefined}
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
              className={fieldWarnings?.high ? 'input-ph-warn' : undefined}
              onChange={e => {
                const v = parseFloat(e.target.value)
                if (!isNaN(v)) onChange({ ...spec, high: v })
              }}
            />
          </label>
          {unit && unitOptions && onUnitChange && (
            <label>
              Unit
              <UnitSelect value={unit} options={unitOptions} onChange={onUnitChange} />
            </label>
          )}
        </div>
      ) : (
        <div>
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
          {spec.values.length !== n && (
            <button
              className="btn-fix-list"
              onClick={() => {
                const low  = Math.min(...spec.values)
                const high = Math.max(...spec.values)
                const vals = Array.from({ length: n }, (_, i) => {
                  const t = n === 1 ? 0 : i / (n - 1)
                  return Math.round((low + (high - low) * t) * 1000) / 1000
                })
                onChange({ kind: 'list', values: vals })
              }}
            >
              Fix — expand to {n} values
            </button>
          )}
          {unit && unitOptions && onUnitChange && (
            <label className="field-inline-unit">
              Unit
              <UnitSelect value={unit} options={unitOptions} onChange={onUnitChange} />
            </label>
          )}
        </div>
      )}
    </div>
  )
}

function ReagentCard({ ax, def }: { ax: 'x' | 'y'; def: ReagentAxis }) {
  const { doc, updateAxis } = useStore()
  const n = ax === 'x' ? doc.plate.cols : doc.plate.rows
  const set = (patch: Partial<ReagentAxis>) => updateAxis(ax, { ...def, ...patch })

  const targetUnitOptions = unitsInFamily(def.unit)
  const targetUnit = def.targetUnit ?? def.unit

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
          targetUnit: c.stock.unit as ConcUnit,
          values: { kind: 'range', low: c.stock.value * 0.1, high: c.stock.value * 0.5 },
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
          <UnitSelect
            value={def.unit}
            onChange={u => {
              // Reset targetUnit when stock family changes
              const newFamily = unitsInFamily(u)
              const tUnit = newFamily.some(o => o.value === targetUnit) ? targetUnit : u
              set({ unit: u, targetUnit: tUnit })
            }}
          />
        </label>
      </div>

      <div className="field-group-label">
        Target concentrations ({n} {ax === 'x' ? 'column' : 'row'}{n !== 1 ? 's' : ''})
      </div>
      <ValueSpecInput
        spec={def.values}
        n={n}
        onChange={vs => set({ values: vs })}
        unit={targetUnit}
        unitOptions={targetUnitOptions}
        onUnitChange={u => set({ targetUnit: u })}
      />
    </div>
  )
}

const PH_EFFECTIVE_RANGE = 1.5

function phDistToNearestPKa(ph: number, pKas: number[]): number {
  return Math.min(...pKas.map(pka => Math.abs(pka - ph)))
}

function PhCard({ ax, def }: { ax: 'x' | 'y'; def: PhAxis }) {
  const { doc, updateAxis } = useStore()
  const n = ax === 'x' ? doc.plate.cols : doc.plate.rows
  const set = (patch: Partial<PhAxis>) => updateAxis(ax, { ...def, ...patch })

  // Use all pKas from the matched compound (if any), falling back to the single def.pKa
  const compound = ALL_COMPOUNDS.find(c => c.name === def.bufferName)
  const allPKas = (compound?.pKa && compound.pKa.length > 0) ? compound.pKa : [def.pKa]

  const phLow  = def.pH.kind === 'range' ? def.pH.low  : Math.min(...def.pH.values)
  const phHigh = def.pH.kind === 'range' ? def.pH.high : Math.max(...def.pH.values)
  const lowWarn  = phDistToNearestPKa(phLow,  allPKas) > PH_EFFECTIVE_RANGE
  const highWarn = phDistToNearestPKa(phHigh, allPKas) > PH_EFFECTIVE_RANGE

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
      <ValueSpecInput
        spec={def.pH}
        n={n}
        fieldWarnings={def.pH.kind === 'range' ? { low: lowWarn, high: highWarn } : undefined}
        onChange={vs => {
          const patch: Partial<PhAxis> = { pH: vs }
          const matched = ALL_COMPOUNDS.find(c => c.name === def.bufferName)
          if (matched?.pKa && matched.pKa.length > 1) {
            const pHmid = vs.kind === 'range'
              ? (vs.low + vs.high) / 2
              : vs.values.length > 0
                ? (Math.min(...vs.values) + Math.max(...vs.values)) / 2
                : 7.0
            patch.pKa = nearestPKa(matched.pKa, pHmid)
          }
          set(patch)
        }}
      />
      {(lowWarn || highWarn) && (
        <p className="ph-range-warn">
          {lowWarn && highWarn
            ? 'Both endpoints are'
            : lowWarn ? 'Low pH is' : 'High pH is'}{' '}
          more than {PH_EFFECTIVE_RANGE} units from the nearest pKa ({allPKas.map(p => p.toFixed(2)).join(' / ')}); the buffer may be ineffective here.
        </p>
      )}

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
