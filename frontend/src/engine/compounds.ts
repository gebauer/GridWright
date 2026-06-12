export interface Compound {
  name: string
  aliases: string[]
  category: 'buffer' | 'salt' | 'polymer' | 'organic'
  stock: { value: number; unit: string }
  pKa?: number[]
  cas?: string | null
  mw?: number | null
  hint?: string
}

/**
 * Case-insensitive search ranked: exact > prefix-of-name > prefix-of-alias > substring.
 * Ties broken alphabetically. Capped at 8 results.
 */
export function search(query: string, compounds: Compound[]): Compound[] {
  const q = query.trim().toLowerCase()
  if (q.length === 0) return []

  const scored: { c: Compound; score: number }[] = []

  for (const c of compounds) {
    const nameLow = c.name.toLowerCase()
    const aliasesLow = (c.aliases ?? []).map(a => a.toLowerCase())

    let score = 0

    if (nameLow === q) {
      score = 4
    } else if (nameLow.startsWith(q)) {
      score = 3
    }

    for (const a of aliasesLow) {
      if (a === q)          score = Math.max(score, 4)
      else if (a.startsWith(q)) score = Math.max(score, 2)
    }

    // substring fallback — only if no prefix or exact match already scored
    if (score === 0 && (nameLow.includes(q) || aliasesLow.some(a => a.includes(q)))) {
      score = 1
    }

    if (score > 0) scored.push({ c, score })
  }

  scored.sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name))
  return scored.slice(0, 8).map(s => s.c)
}

/**
 * Pick the pKa value closest to pHmid. For polyprotic buffers, this selects
 * the relevant dissociation step for the user's pH range.
 */
export function nearestPKa(pKas: number[], pHmid: number): number {
  if (pKas.length === 0) throw new Error('nearestPKa: empty array')
  return pKas.reduce((best, pKa) =>
    Math.abs(pKa - pHmid) < Math.abs(best - pHmid) ? pKa : best,
  )
}
