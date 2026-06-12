import type { GridResult, ScreenDocument } from '../engine'

function esc(s: string): string {
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s
}

function csvRow(...cells: (string | number)[]): string {
  return cells.map(c => esc(String(c))).join(',')
}

function triggerDownload(filename: string, content: string, mime = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mime })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function saveLocalJSON(doc: ScreenDocument) {
  const name = doc.meta.name?.trim().replace(/\s+/g, '_') || 'screen'
  triggerDownload(`${name}.gridwright.json`, JSON.stringify(doc, null, 2), 'application/json')
}

export function loadLocalJSON(): Promise<ScreenDocument> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,.gridwright.json'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return reject(new Error('No file selected'))
      const reader = new FileReader()
      reader.onload = e => {
        try {
          const doc = JSON.parse(e.target?.result as string) as ScreenDocument
          if (doc.version !== 1) throw new Error('Unrecognised file format')
          resolve(doc)
        } catch (err) {
          reject(err)
        }
      }
      reader.readAsText(file)
    }
    input.click()
  })
}

function roundVol(uL: number): number {
  // Same rounding rule as formatVolume but as a number
  if (uL > 10) return Math.round(uL)
  return Math.round(uL * 10) / 10
}

export function downloadRecipeCSV(doc: ScreenDocument, result: GridResult) {
  const { wells } = result
  if (wells.length === 0) return

  const hasX  = wells.some(w => w.axisValues.x !== undefined)
  const hasY  = wells.some(w => w.axisValues.y !== undefined)

  const xLabel = hasX && doc.axes.x
    ? (doc.axes.x.type === 'reagent' ? `${doc.axes.x.name} (${doc.axes.x.unit})` : 'pH')
    : null
  const yLabel = hasY && doc.axes.y
    ? (doc.axes.y.type === 'reagent' ? `${doc.axes.y.name} (${doc.axes.y.unit})` : 'pH')
    : null

  // Collect component names in the order they first appear
  const seen = new Set<string>()
  const compNames: string[] = []
  for (const w of wells) {
    for (const c of w.components) {
      if (!seen.has(c.name)) { seen.add(c.name); compNames.push(c.name) }
    }
  }

  const header = ['Well']
  if (xLabel) header.push(xLabel)
  if (yLabel) header.push(yLabel)
  for (const n of compNames) header.push(`${n} (µL)`)
  header.push('Water (µL)', 'Total (µL)', 'Warnings')

  const rows = [csvRow(...header)]
  for (const w of wells) {
    const cells: (string | number)[] = [w.label]
    if (xLabel) cells.push(Math.round((w.axisValues.x ?? 0) * 1000) / 1000)
    if (yLabel) cells.push(Math.round((w.axisValues.y ?? 0) * 1000) / 1000)
    for (const n of compNames) {
      const c = w.components.find(c => c.name === n)
      cells.push(c ? roundVol(c.volumeUL) : 0)
    }
    cells.push(roundVol(Math.max(0, w.waterUL)))
    cells.push(w.totalUL)
    cells.push(w.warnings.map(w => w.kind).join('; '))
    rows.push(csvRow(...cells))
  }

  const base = (doc.meta.name ?? 'screen').replace(/[^a-z0-9]/gi, '-')
  triggerDownload(`${base}-recipe.csv`, rows.join('\r\n'))
}

export function downloadPrepCSV(doc: ScreenDocument, result: GridResult) {
  const { prep } = result
  if (prep.length === 0) return

  const rows = [csvRow('Stock', 'Concentration', 'Volume (µL)', 'Volume (mL)')]
  for (const p of prep) {
    rows.push(csvRow(
      p.name,
      p.conc,
      roundVol(p.volumeUL),
      Math.round(p.volumeUL / 1000 * 100) / 100,
    ))
  }

  const base = (doc.meta.name ?? 'screen').replace(/[^a-z0-9]/gi, '-')
  triggerDownload(`${base}-prep.csv`, rows.join('\r\n'))
}
