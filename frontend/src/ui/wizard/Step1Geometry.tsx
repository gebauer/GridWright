import { useStore } from '../../state'

const PLATE_PRESETS = [
  { label: '24-well',  rows: 4, cols: 6  },
  { label: '48-well',  rows: 6, cols: 8  },
  { label: '96-well',  rows: 8, cols: 12 },
]

export default function Step1Geometry() {
  const { doc, updatePlate, updateMeta, setAxisType } = useStore()
  const { plate, meta, axes } = doc

  const axisType = (def: typeof axes.x) =>
    def === null ? 'none' : def.type

  return (
    <div className="wizard-step">
      <section className="ws">
        <h3>Plate</h3>
        <div className="preset-row">
          {PLATE_PRESETS.map(p => {
            const active = plate.rows === p.rows && plate.cols === p.cols
            return (
              <button
                key={p.label}
                className={`btn-preset${active ? ' active' : ''}`}
                onClick={() => updatePlate({ rows: p.rows, cols: p.cols })}
              >
                {p.label}
              </button>
            )
          })}
        </div>
        <div className="field-row">
          <label>
            Rows
            <input
              type="number" min={1} max={32}
              value={plate.rows}
              onChange={e => { const n = parseInt(e.target.value); if (n >= 1) updatePlate({ rows: n }) }}
            />
          </label>
          <label>
            Columns
            <input
              type="number" min={1} max={24}
              value={plate.cols}
              onChange={e => { const n = parseInt(e.target.value); if (n >= 1) updatePlate({ cols: n }) }}
            />
          </label>
        </div>
        <div className="field-row">
          <label>
            Well volume
            <input
              type="number" min={0.1}
              value={plate.wellVolume}
              onChange={e => { const n = parseFloat(e.target.value); if (n > 0) updatePlate({ wellVolume: n }) }}
            />
          </label>
          <label>
            Unit
            <select
              value={plate.volumeUnit}
              onChange={e => updatePlate({ volumeUnit: e.target.value as 'uL' | 'mL' })}
            >
              <option value="uL">µL</option>
              <option value="mL">mL</option>
            </select>
          </label>
        </div>
      </section>

      <section className="ws">
        <h3>Axes</h3>
        <label>
          X axis — varies across columns
          <select
            value={axisType(axes.x)}
            onChange={e => setAxisType('x', e.target.value as 'none' | 'reagent' | 'ph')}
          >
            <option value="none">— none —</option>
            <option value="reagent">Reagent</option>
            <option value="ph">pH buffer</option>
          </select>
        </label>
        <label>
          Y axis — varies across rows
          <select
            value={axisType(axes.y)}
            onChange={e => setAxisType('y', e.target.value as 'none' | 'reagent' | 'ph')}
          >
            <option value="none">— none —</option>
            <option value="reagent">Reagent</option>
            <option value="ph">pH buffer</option>
          </select>
        </label>
      </section>

      <section className="ws">
        <h3>Screen info</h3>
        <label>
          Name
          <input
            type="text"
            value={meta.name ?? ''}
            onChange={e => updateMeta({ name: e.target.value })}
          />
        </label>
        <label>
          Sample / protein
          <input
            type="text"
            value={meta.sample ?? ''}
            onChange={e => updateMeta({ sample: e.target.value })}
          />
        </label>
        <div className="field-row">
          <label>
            Operator
            <input
              type="text"
              value={meta.operator ?? ''}
              onChange={e => updateMeta({ operator: e.target.value })}
            />
          </label>
          <label>
            Temp (°C)
            <input
              type="number"
              value={meta.temperatureC ?? ''}
              onChange={e => {
                const n = parseFloat(e.target.value)
                updateMeta({ temperatureC: isNaN(n) ? undefined : n })
              }}
            />
          </label>
        </div>
        <label>
          Notes
          <textarea
            rows={3}
            value={meta.notes ?? ''}
            onChange={e => updateMeta({ notes: e.target.value })}
          />
        </label>
      </section>
    </div>
  )
}
