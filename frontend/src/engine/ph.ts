/** Fraction of buffer in base (deprotonated) form at a given pH */
export function baseFraction(pH: number, pKa: number): number {
  return 1 / (1 + Math.pow(10, pKa - pH))
}

/**
 * Volume split for mixing mode.
 * Returns { vHigh, vLow } where vHigh + vLow = vBuf.
 * `pHLow` and `pHHigh` are the two prepared stock pH values.
 */
export function mixingVolumes(
  targetPH: number,
  pHLow: number,
  pHHigh: number,
  pKa: number,
  vBuf: number,
): { vHigh: number; vLow: number; outOfRange: boolean } {
  const phiTarget = baseFraction(targetPH, pKa)
  const phiLow    = baseFraction(pHLow,    pKa)
  const phiHigh   = baseFraction(pHHigh,   pKa)

  const fHighRaw = (phiTarget - phiLow) / (phiHigh - phiLow)
  const outOfRange = fHighRaw < 0 || fHighRaw > 1
  const fHigh = Math.max(0, Math.min(1, fHighRaw))

  return {
    vHigh: fHigh * vBuf,
    vLow:  (1 - fHigh) * vBuf,
    outOfRange,
  }
}
