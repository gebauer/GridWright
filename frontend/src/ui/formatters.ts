/** Format a µL volume for display per user-specified rounding rules. */
export function formatVolume(uL: number): string {
  if (uL > 1000) return `${(uL / 1000).toFixed(2)} mL`
  if (uL > 10)   return `${Math.round(uL)} µL`
  return `${Math.round(uL * 10) / 10} µL`
}

/** Short label for an axis header cell. */
export function formatAxisHeader(value: number, kind: 'reagent' | 'ph', unit?: string): string {
  if (kind === 'ph') return `pH ${value.toFixed(1)}`
  const n = Math.round(value * 10) / 10
  return unit ? `${n} ${unit}` : String(n)
}
