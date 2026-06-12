import type { ScreenDocument } from '../engine'

export async function saveScreen(doc: ScreenDocument): Promise<{ slug: string; url: string }> {
  const res = await fetch('/api/screens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(doc),
  })
  if (!res.ok) throw new Error(`Save failed (${res.status})`)
  return res.json() as Promise<{ slug: string; url: string }>
}

export async function loadScreen(slug: string): Promise<ScreenDocument> {
  const res = await fetch(`/api/screens/${encodeURIComponent(slug)}`)
  if (res.status === 404) throw new Error('Screen not found')
  if (res.status === 410) throw new Error('Screen has expired')
  if (!res.ok) throw new Error(`Load failed (${res.status})`)
  return res.json() as Promise<ScreenDocument>
}
