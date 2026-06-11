import type { ValueSpec } from './types'

export function expandValues(spec: ValueSpec, n: number): number[] {
  if (spec.kind === 'list') {
    if (spec.values.length === n) return spec.values.slice()
    // Mismatch: truncate if too long, repeat last value if too short.
    // The caller (computeGrid) emits a list-length-mismatch warning.
    const last = spec.values[spec.values.length - 1] ?? 0
    return Array.from({ length: n }, (_, i) =>
      i < spec.values.length ? spec.values[i] : last,
    )
  }
  if (n === 1) return [spec.low]
  return Array.from({ length: n }, (_, i) =>
    spec.low + (spec.high - spec.low) * (i / (n - 1)),
  )
}
