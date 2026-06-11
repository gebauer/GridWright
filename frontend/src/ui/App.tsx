import { useMemo, useState } from 'react'
import { computeGrid } from '../engine'
import type { WellRecipe } from '../engine'
import { useStore } from '../state'
import PlatePreview from './PlatePreview'
import WellDetail from './WellDetail'
import PrepList from './PrepList'
import Step1Geometry from './wizard/Step1Geometry'
import Step2Axes from './wizard/Step2Axes'
import Step3Constants from './wizard/Step3Constants'
import './App.css'

const STEPS = ['Geometry', 'Axes', 'Constants'] as const

export default function App() {
  const { doc, step, setStep } = useStore()
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null)
  const [colourBy, setColourBy] = useState('x')

  const result = useMemo(() => computeGrid(doc), [doc])

  // Always derive selected well from live result so it reflects the latest recipe
  const liveWell: WellRecipe | null =
    selectedLabel ? (result.wells.find(w => w.label === selectedLabel) ?? null) : null

  const handleWellClick = (well: WellRecipe) =>
    setSelectedLabel(prev => prev === well.label ? null : well.label)

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-logo">GridWright</span>
        {doc.meta.name && (
          <span className="screen-meta">
            {doc.meta.name}
            {doc.meta.sample && <> · {doc.meta.sample}</>}
          </span>
        )}
      </header>

      <div className="app-body">
        <aside className="panel-wizard">
          <nav className="wizard-nav">
            {STEPS.map((label, i) => (
              <button
                key={label}
                className={`wizard-nav-step${step === i + 1 ? ' active' : ''}`}
                onClick={() => setStep((i + 1) as 1 | 2 | 3)}
              >
                <span className="step-num">{i + 1}</span>
                {label}
              </button>
            ))}
          </nav>

          <div className="wizard-body">
            {step === 1 && <Step1Geometry />}
            {step === 2 && <Step2Axes />}
            {step === 3 && <Step3Constants />}
          </div>

          <footer className="wizard-footer">
            {step > 1 && (
              <button
                className="btn-secondary"
                onClick={() => setStep((step - 1) as 1 | 2 | 3)}
              >
                Back
              </button>
            )}
            {step < 3 && (
              <button
                className="btn-primary"
                onClick={() => setStep((step + 1) as 1 | 2 | 3)}
              >
                Next
              </button>
            )}
          </footer>
        </aside>

        <main className="panel-preview">
          <PlatePreview
            doc={doc}
            result={result}
            colourBy={colourBy}
            selectedWell={liveWell}
            onWellClick={handleWellClick}
            onColourByChange={setColourBy}
          />

          {liveWell && (
            <WellDetail
              well={liveWell}
              doc={doc}
              onClose={() => setSelectedLabel(null)}
            />
          )}

          <PrepList prep={result.prep} warnings={result.warnings} />
        </main>
      </div>
    </div>
  )
}
