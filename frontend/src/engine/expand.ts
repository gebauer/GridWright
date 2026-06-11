import type { ValueSpec } from './types'

export function expandValues(spec: ValueSpec, n: number): number[] {
  if (spec.kind === 'list') {
    if (spec.values.length !== n) {
      throw new Error(`List has ${spec.values.length} entries but axis has ${n} steps`)
    }
    return spec.values.slice()
  }
  if (n === 1) return [spec.low]
  return Array.from({ length: n }, (_, i) =>
    spec.low + (spec.high - spec.low) * (i / (n - 1)),
  )
}
