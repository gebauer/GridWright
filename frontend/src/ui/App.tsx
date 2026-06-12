import { useEffect, useMemo, useState } from 'react'
import { computeGrid, isAxisReady } from '../engine'
import type { WellRecipe } from '../engine'
import { useStore } from '../state'
import { saveScreen, loadScreen } from '../api/client'
import PlatePreview from './PlatePreview'
import WellDetail from './WellDetail'
import PrepList from './PrepList'
import Step1Geometry from './wizard/Step1Geometry'
import Step2Axes from './wizard/Step2Axes'
import Step3Constants from './wizard/Step3Constants'
import PrintWorksheet from './PrintWorksheet'
import HelpModal from './HelpModal'
import { downloadRecipeCSV, downloadPrepCSV, saveLocalJSON, loadLocalJSON } from './exports'
import './App.css'

const STEPS = ['Geometry', 'Axes', 'Constants'] as const

const VERSION = 'v.2.2'
const VERSION_DATE = '2026-06-12'
const GITHUB_URL = 'https://github.com/jangebauer/GridWright'

const DRAFT_KEY = 'gridwright-draft'

export default function App() {
  const { doc, step, setStep, reset, loadDoc } = useStore()
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null)
  const [colourBy, setColourBy] = useState('x')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  async function handleImport() {
    try {
      const doc = await loadLocalJSON()
      loadDoc(doc)
      setSelectedLabel(null)
      setColourBy('x')
      history.pushState(null, '', '/')
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Could not read file')
      setTimeout(() => setImportError(null), 4000)
    }
  }
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const up   = () => setIsOnline(true)
    const down = () => setIsOnline(false)
    window.addEventListener('online',  up)
    window.addEventListener('offline', down)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [])
  // True while we're fetching a /s/{slug} URL on first load — prevents flash of empty INIT state
  const [loadingSlug, setLoadingSlug] = useState(() =>
    /^\/s\/[^/]+$/.test(window.location.pathname),
  )

  // Restore draft from localStorage on first load (only when not loading a slug)
  useEffect(() => {
    if (/^\/s\/[^/]+$/.test(window.location.pathname)) return
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (raw) loadDoc(JSON.parse(raw))
    } catch { /* ignore corrupt drafts */ }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Autosave draft to localStorage whenever doc changes
  useEffect(() => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(doc)) } catch { /* quota */ }
  }, [doc])

  // On mount: if URL is /s/{slug}, load that screen from the API
  useEffect(() => {
    const m = window.location.pathname.match(/^\/s\/([^/]+)$/)
    if (!m) return
    loadScreen(m[1])
      .then(loaded => {
        loadDoc(loaded)
        setSelectedLabel(null)
        setColourBy('x')
      })
      .catch(err => {
        const msg = err instanceof Error ? err.message : String(err)
        setLoadError(msg)
      })
      .finally(() => setLoadingSlug(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleReset() {
    reset()
    setSelectedLabel(null)
    setColourBy('x')
    setSaveStatus('idle')
    setCopyStatus('idle')
    setLoadError(null)
    localStorage.removeItem(DRAFT_KEY)
    history.pushState(null, '', '/')
  }

  async function handleCopyLink() {
    await navigator.clipboard.writeText(window.location.href)
    setCopyStatus('copied')
    setTimeout(() => setCopyStatus('idle'), 1800)
  }

  const hasSlug = /^\/s\/[^/]+$/.test(window.location.pathname)

  async function handleSave() {
    setSaveStatus('saving')
    try {
      const { slug } = await saveScreen(doc)
      history.pushState(null, '', `/s/${slug}`)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2500)
    } catch {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }

  const { result, gridError } = useMemo(() => {
    try {
      return { result: computeGrid(doc), gridError: null }
    } catch (e) {
      return { result: null, gridError: e instanceof Error ? e.message : 'Engine error' }
    }
  }, [doc])

  // Always derive selected well from live result so it reflects the latest recipe
  const liveWell: WellRecipe | null =
    result && selectedLabel
      ? (result.wells.find(w => w.label === selectedLabel) ?? null)
      : null

  const handleWellClick = (well: WellRecipe) =>
    setSelectedLabel(prev => prev === well.label ? null : well.label)

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-logo-block">
          <span className="app-logo">GridWright</span>
          <span className="app-tagline">From hit to optimized tray</span>
        </div>
        {doc.meta.name && (
          <span className="screen-meta">
            {doc.meta.name}
            {doc.meta.sample && <> · {doc.meta.sample}</>}
          </span>
        )}
        <div className="header-actions">
          <button className="btn-help" onClick={() => setShowHelp(true)} aria-label="Help">?</button>
          <button className="btn-local" onClick={() => saveLocalJSON(doc)} title="Download screen as JSON file">⬇ Download</button>
          <button className="btn-local" onClick={handleImport} title="Upload a saved .gridwright.json file">⬆ Upload</button>
          {hasSlug && (
            <button
              className={`btn-copy-link${copyStatus === 'copied' ? ' btn-copy-link--copied' : ''}`}
              onClick={handleCopyLink}
            >
              {copyStatus === 'copied' ? 'Copied ✓' : 'Copy link'}
            </button>
          )}
          <button
            className={`btn-save btn-save--${saveStatus}`}
            onClick={handleSave}
            disabled={!isOnline || saveStatus === 'saving' || (!isAxisReady(doc.axes.x) && !isAxisReady(doc.axes.y))}
            title={
              !isOnline ? 'Offline — save unavailable'
              : (!isAxisReady(doc.axes.x) && !isAxisReady(doc.axes.y)) ? 'Define at least one axis before saving'
              : undefined
            }
          >
            {!isOnline ? 'Offline'
              : saveStatus === 'saving' ? 'Saving…'
              : saveStatus === 'saved'  ? 'Saved ✓'
              : saveStatus === 'error'  ? 'Save failed'
              : '☁ Save & share'}
          </button>
          <button className="btn-new-screen" onClick={handleReset}>New screen</button>
        </div>
      </header>

      {importError && (
        <div className="load-error">
          Import failed: {importError}
        </div>
      )}

      {loadError && (
        <div className="load-error">
          Could not load screen: {loadError}
          <button onClick={() => { setLoadError(null); history.pushState(null, '', '/') }}>
            ✕
          </button>
        </div>
      )}

      {gridError && (
        <div className="load-error">
          Engine error: {gridError}
        </div>
      )}

      {loadingSlug ? (
        <div className="slug-loading">Loading screen…</div>
      ) : (
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
            {result && result.prep.length > 0 && (
              <div className="export-toolbar">
                <button className="btn-export" onClick={() => downloadRecipeCSV(doc, result)}>
                  Recipe CSV
                </button>
                <button className="btn-export" onClick={() => downloadPrepCSV(doc, result)}>
                  Prep list CSV
                </button>
                <button className="btn-export" onClick={() => window.print()}>
                  Print worksheet
                </button>
              </div>
            )}

            {result && (
              <PlatePreview
                doc={doc}
                result={result}
                colourBy={colourBy}
                selectedWell={liveWell}
                onWellClick={handleWellClick}
                onColourByChange={setColourBy}
              />
            )}

            {liveWell && result && (
              <WellDetail
                well={liveWell}
                doc={doc}
                onClose={() => setSelectedLabel(null)}
              />
            )}

            {result && <PrepList prep={result.prep} warnings={result.warnings} />}
          </main>

          {/* Print-only — hidden on screen, rendered in window.print() */}
          {result && <PrintWorksheet doc={doc} result={result} />}

          <footer className="preview-footer">
            <span>{VERSION} · {VERSION_DATE}</span>
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">GitHub</a>
          </footer>
        </div>
      )}

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  )
}
