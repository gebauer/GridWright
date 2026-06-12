import { create } from 'zustand'
import type { AxisDef, ConstantAdditive, PhAxis, PlateSpec, ReagentAxis, ScreenDocument, ScreenMeta } from './engine'

interface AppStore {
  doc: ScreenDocument
  step: 1 | 2 | 3
  setStep: (s: 1 | 2 | 3) => void
  reset: () => void
  loadDoc: (doc: ScreenDocument) => void
  updateMeta: (m: Partial<ScreenMeta>) => void
  updatePlate: (p: Partial<PlateSpec>) => void
  setAxisType: (ax: 'x' | 'y', t: 'none' | 'reagent' | 'ph') => void
  updateAxis: (ax: 'x' | 'y', def: AxisDef) => void
  addConstant: () => void
  removeConstant: (i: number) => void
  updateConstant: (i: number, c: Partial<ConstantAdditive>) => void
}

const DEFAULT_REAGENT: ReagentAxis = {
  type: 'reagent',
  name: '',
  stockConc: 100,
  unit: 'mM',
  values: { kind: 'range', low: 10, high: 50 }, // 10–50% of stock
}

const DEFAULT_PH: PhAxis = {
  type: 'ph',
  bufferName: '',
  concentration: 100,
  concUnit: 'mM',
  stockConc: 1,
  stockUnit: 'M',
  pKa: 7.0,
  pH: { kind: 'range', low: 6.5, high: 8.0 },
  prepMode: 'mixing',
}

const INIT: ScreenDocument = {
  version: 1,
  meta: {},
  plate: { rows: 4, cols: 6, wellVolume: 2000, volumeUnit: 'uL' },
  axes: { x: null, y: null },
  constants: [],
}

export const useStore = create<AppStore>(set => ({
  doc: INIT,
  step: 1,

  setStep: step => set({ step }),
  reset: () => set({ doc: { ...INIT }, step: 1 }),
  loadDoc: (doc) => set({ doc, step: 1 }),

  updateMeta: m => set(s => ({
    doc: { ...s.doc, meta: { ...s.doc.meta, ...m } },
  })),

  updatePlate: p => set(s => ({
    doc: { ...s.doc, plate: { ...s.doc.plate, ...p } },
  })),

  setAxisType: (ax, t) => set(s => ({
    doc: {
      ...s.doc,
      axes: {
        ...s.doc.axes,
        [ax]: t === 'none' ? null : t === 'reagent' ? { ...DEFAULT_REAGENT } : { ...DEFAULT_PH },
      },
    },
  })),

  updateAxis: (ax, def) => set(s => ({
    doc: { ...s.doc, axes: { ...s.doc.axes, [ax]: def } },
  })),

  addConstant: () => set(s => {
    // Default: 100 mM stock → 1 mM final (1/100, mM preselected for molar)
    const c: ConstantAdditive = { name: '', stockConc: 100, unit: 'mM', targetUnit: 'mM', targetConc: 1 }
    return { doc: { ...s.doc, constants: [...s.doc.constants, c] } }
  }),

  removeConstant: i => set(s => ({
    doc: { ...s.doc, constants: s.doc.constants.filter((_, j) => j !== i) },
  })),

  updateConstant: (i, c) => set(s => ({
    doc: {
      ...s.doc,
      constants: s.doc.constants.map((x, j) => j === i ? { ...x, ...c } : x),
    },
  })),
}))
