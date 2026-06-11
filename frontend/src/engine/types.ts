export type ConcUnit =
  | 'M' | 'mM' | 'uM'
  | '%w/v'
  | '%v/v'
  | 'mg/mL'
  | 'X'

export type AxisName = 'x' | 'y'

export interface RangeSpec { kind: 'range'; low: number; high: number }
export interface ListSpec  { kind: 'list';  values: number[] }
export type ValueSpec = RangeSpec | ListSpec

export interface ReagentAxis {
  type: 'reagent'
  name: string
  stockConc: number
  unit: ConcUnit
  values: ValueSpec
}

export interface PhAxis {
  type: 'ph'
  bufferName: string
  concentration: number
  concUnit: ConcUnit
  stockConc: number
  stockUnit: ConcUnit
  pKa: number
  pH: ValueSpec
  prepMode: 'individual' | 'mixing'
}

export type AxisDef = ReagentAxis | PhAxis | null

export interface ConstantAdditive {
  name: string
  stockConc: number
  unit: ConcUnit
  targetConc: number
}

export interface PlateSpec {
  rows: number
  cols: number
  wellVolume: number
  volumeUnit: 'uL' | 'mL'
}

export interface ScreenMeta {
  name?: string
  sample?: string
  operator?: string
  temperatureC?: number
  notes?: string
}

export interface ScreenDocument {
  version: 1
  meta: ScreenMeta
  plate: PlateSpec
  axes: { x: AxisDef; y: AxisDef }
  constants: ConstantAdditive[]
  config?: {
    minPipetteVolumeUL?: number
    pipetteResolutionUL?: number
    deadVolumeMultiplier?: number
  }
}

// --- Engine output types ---

export type Warning =
  | { kind: 'over-volume';        well: string; overflowUL: number; culprit: string }
  | { kind: 'cannot-concentrate'; well: string; reagent: string; minStockConc: number; unit: ConcUnit }
  | { kind: 'sub-pipettable';     well: string; reagent: string; volumeUL: number }
  | { kind: 'ph-out-of-range';    well: string; targetPH: number; rangeLow: number; rangeHigh: number }
  | { kind: 'unit-mismatch';      reagent: string; message: string }

export interface WellRecipe {
  row: number
  col: number
  label: string
  axisValues: { x?: number; y?: number }
  components: { name: string; volumeUL: number }[]
  waterUL: number
  totalUL: number
  warnings: Warning[]
}

export interface PrepEntry {
  name: string
  conc: string
  volumeUL: number
}

export interface GridResult {
  wells: WellRecipe[]
  prep: PrepEntry[]
  warnings: Warning[]
}
