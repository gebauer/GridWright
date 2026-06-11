# GridWright — Build Specification

A build brief for Claude Code. GridWright is a fast, live, single-page web app for designing
**per-well crystallization optimization trays** — a modern replacement for the old-fashioned,
form-heavy HTML formulation tools crystallographers use to optimize a hit by varying components
across a microplate.

> Read this whole file before writing code. Build in the milestone order at the bottom.
> The calculation engine (TypeScript, milestone M2) must be built and tested **first**,
> before any UI.

---

## 1. What this tool does

A crystallographer found a crystal "hit" and wants to optimize it by setting up a tray
(a microplate) where reagent concentrations and/or pH vary systematically across the wells.

GridWright uses the **individual-pipetting** model (NOT four-corner interpolation — that exists
elsewhere). Every well's reservoir recipe is computed **independently**:

```
For each reagent in a well:   V_stock = (C_target / C_stock) * V_well
Water is always the top-up:   V_water = V_well - sum(all V_stock)
```

The user defines how each reagent varies across the grid; the tool produces an explicit
pipetting volume for every stock in every well, a per-stock "make this much" prep list,
and live feasibility warnings.

### The model (deliberately small)
- **X-axis reagent** — one reagent (or pH) that varies across **columns**.
- **Y-axis reagent** — one reagent (or pH) that varies across **rows**. May be absent (1-D screen).
- **Constant additives** — reagents at a fixed concentration in every well (e.g. 10 mM CaCl₂).
- **Water** — always fills each well to the target volume.

pH is treated as **one reagent** even though it may require multiple physical stocks
(see §4.3). The user never hand-enters multiple buffers.

---

## 2. Architecture & stack

- **Frontend**: Vite + React + TypeScript. The calc engine is a pure TS module with **no React
  imports**, unit-tested with Vitest. All math runs client-side so the preview is instant.
- **Backend**: Python 3.12 + FastAPI + SQLite. Its ONLY job is persistence: save a screen JSON
  and return a random slug; fetch a screen JSON by slug. **No calculation happens in Python.**
- **Packaging**: one Docker image. FastAPI serves the built Vite `dist/` as static files and the
  `/api/*` routes. Deployed via Coolify with a persistent volume for the SQLite file.

### Repo layout
```
gridwright/
  frontend/
    src/
      engine/            # pure TS, framework-free, the heart of the app
        types.ts
        units.ts
        expand.ts
        ph.ts
        well.ts
        screen.ts        # orchestrates a full screen -> grid + prep list + warnings
        index.ts
      engine/__tests__/   # Vitest specs (write these alongside the engine)
      ui/
        App.tsx
        wizard/
          Step1Geometry.tsx
          Step2Axes.tsx
          Step3Constants.tsx
        PlatePreview.tsx
        WellDetail.tsx
        PrepList.tsx
        exports.ts        # CSV + printable worksheet
      api/client.ts       # save/load to backend
      state.ts            # screen document state (Zustand or React context)
    package.json
    vite.config.ts
    tsconfig.json
  backend/
    app/
      main.py
      db.py
      models.py           # Pydantic mirror of the screen doc (light validation)
      slugs.py
      wordlists.py
    requirements.txt
  Dockerfile
  docker-compose.yml       # local dev convenience
  README.md
  CLAUDE.md                # conventions (can lift §9 of this doc into it)
```

---

## 3. Data model

The entire screen is one JSON document. This is what gets saved under a slug and what the
engine consumes. Define it as TypeScript types in `engine/types.ts`.

```ts
export type ConcUnit =
  | "M" | "mM" | "uM"        // molar family
  | "%w/v"                    // mass/volume percent family
  | "%v/v"                    // volume/volume percent family
  | "mg/mL"                   // mass/volume family
  | "X";                      // relative/dilution family

export type AxisName = "x" | "y";

export interface RangeSpec { kind: "range"; low: number; high: number; }
export interface ListSpec  { kind: "list";  values: number[]; }   // length must equal axis size
export type ValueSpec = RangeSpec | ListSpec;

// A reagent whose concentration varies along an axis
export interface ReagentAxis {
  type: "reagent";
  name: string;
  stockConc: number;
  unit: ConcUnit;
  values: ValueSpec;          // target concentrations along the axis
}

// pH that varies along an axis. Buffer concentration is held constant; pH varies.
export interface PhAxis {
  type: "ph";
  bufferName: string;
  concentration: number;      // final buffer conc, held constant (molar family)
  concUnit: ConcUnit;         // expect mM / M
  stockConc: number;          // buffer stock concentration (molar family)
  stockUnit: ConcUnit;
  pKa: number;                // required for "mixing" mode; ignored for "individual"
  pH: ValueSpec;              // target pH values along the axis
  prepMode: "individual" | "mixing";
}

export type AxisDef = ReagentAxis | PhAxis | null;

export interface ConstantAdditive {
  name: string;
  stockConc: number;
  unit: ConcUnit;
  targetConc: number;
}

export interface PlateSpec {
  rows: number;               // e.g. 4
  cols: number;               // e.g. 6
  wellVolume: number;         // reservoir volume to make, e.g. 2000
  volumeUnit: "uL" | "mL";    // store volumes in uL internally
}

export interface ScreenMeta {
  name?: string;              // free text; the slug is separate
  sample?: string;
  operator?: string;
  temperatureC?: number;
  notes?: string;
}

export interface ScreenDocument {
  version: 1;
  meta: ScreenMeta;
  plate: PlateSpec;
  axes: { x: AxisDef; y: AxisDef };
  constants: ConstantAdditive[];
  // engine config (all optional, with defaults in §4.5)
  config?: {
    minPipetteVolumeUL?: number;     // default 0.5
    pipetteResolutionUL?: number;    // default 0.1
    deadVolumeMultiplier?: number;   // default 1.2 (for prep-list totals)
  };
}
```

The X-axis varies across **columns** (column index → value, constant down rows). The Y-axis
varies across **rows** (row index → value, constant across columns). Well `(r, c)` takes the
X value from column `c` and the Y value from row `r`, plus all constants.

---

## 4. Calculation engine — exact specification

This is the most important section. Implement it precisely; the worked example in §5 is the
ground truth your tests must reproduce.

All volumes are computed and stored internally in **µL**. Convert mL→µL on input.

### 4.1 Units
Group units into families and convert to a base unit. Within a family, `C_target / C_stock`
is a pure dimensionless ratio.

| Family       | Units            | Base   | Conversions to base                |
|--------------|------------------|--------|------------------------------------|
| molar        | M, mM, uM        | M      | mM = 1e-3 M, uM = 1e-6 M           |
| mass/vol %   | %w/v             | %w/v   | (single unit)                      |
| vol/vol %    | %v/v             | %v/v   | (single unit)                      |
| mass/vol     | mg/mL            | mg/mL  | (single unit)                      |
| relative     | X                | X      | (single unit)                      |

**Rule**: for any reagent, `stock.unit` and the axis/target values' unit must be in the **same
family**, otherwise raise a validation error. Buffer `concUnit` and `stockUnit` likewise.

```
ratio(target, targetUnit, stock, stockUnit):
  assertSameFamily(targetUnit, stockUnit)
  return toBase(target, targetUnit) / toBase(stock, stockUnit)
```

### 4.2 Per-well volume for a plain concentration component (reagent axis or constant additive)
```
r       = ratio(C_target, unit, C_stock, unit)
V_stock = r * V_well
```

### 4.3 pH axis
Buffer is delivered at a fixed final concentration from buffer stock(s). The buffer's total
per-well volume:
```
V_buf = ratio(concentration, concUnit, stockConc, stockUnit) * V_well
```

**Mode `individual`**: the user prepares one stock at each target pH value (all at `stockConc`).
Each well in that column/row receives `V_buf` of the stock matching its pH. One pipetting line.

**Mode `mixing`**: the user prepares exactly **two** stocks at the same buffer species and
concentration, pH set by titration (HCl/NaOH, per lab convention — do NOT mix in acid/base
forms):
- `low` stock at `pH_low = min(pH values)`
- `high` stock at `pH_high = max(pH values)`

For a target pH `p_t`, compute the volume fraction of the high stock using Henderson–Hasselbalch
on the base-form fraction (monoprotic buffer):

```
phi(p) = 1 / (1 + 10^(pKa - p))           # fraction in base form at pH p

f_high = (phi(p_t) - phi(pH_low)) / (phi(pH_high) - phi(pH_low))
f_high = clamp(f_high, 0, 1)              # if p_t outside [pH_low, pH_high], warn "pH out of range"

V_high = f_high * V_buf
V_low  = (1 - f_high) * V_buf
```

This is linear in the blended **base-form amount**, NOT linear in pH — that is the whole point
of using `pKa`. Two pipetting lines (high stock, low stock) for that buffer.

> Note for prep list: in mixing mode there are 2 buffer stocks regardless of how many pH steps;
> in individual mode there are N buffer stocks (one per distinct pH value).

### 4.4 Value expansion
```
expandRange(low, high, n):
  if n == 1: return [low]
  return [ low + (high - low) * i / (n - 1)  for i in 0..n-1 ]

expandList(values, n):
  if values.length != n: validation error "list must have n entries"
  return values
```
`n` = `cols` for the X-axis, `rows` for the Y-axis.

### 4.5 Assembling a well and the whole grid (`screen.ts`)
For each well `(r, c)`:
1. Collect components:
   - X axis (if present): target = expandedX[c]  → reagent volume, or pH handling
   - Y axis (if present): target = expandedY[r]  → reagent volume, or pH handling
   - each constant additive: fixed target  → reagent volume
2. `totalStock = sum of all component stock volumes`
3. `V_water = V_well - totalStock`
4. Round each displayed volume to `pipetteResolutionUL` (default 0.1). Recompute `V_water`
   as the exact balance after rounding so the total always equals `V_well`.

Defaults: `minPipetteVolumeUL = 0.5`, `pipetteResolutionUL = 0.1`, `deadVolumeMultiplier = 1.2`.

### 4.6 Feasibility & warnings (per well + global)
Produce structured warnings (don't throw — the UI shows them live):
- **Over volume**: `V_water < 0` → infeasible. Report the well and the overflow amount, and
  name the largest-contributing component(s).
- **Cannot concentrate**: any component with `r >= 1` (target ≥ stock) is impossible by itself;
  report the minimum stock concentration it would need (`> C_target`).
- **Sub-pipettable**: any nonzero `V_stock < minPipetteVolumeUL` → warn (precision risk).
- **pH out of range** (mixing mode): a target pH outside `[pH_low, pH_high]`.
- **Unit family mismatch**: validation error surfaced before computing.

### 4.7 Prep list
Collect the set of unique stocks across the whole tray:
- each reagent axis → 1 stock (its `stockConc`/`unit`)
- each constant → 1 stock
- pH individual → N stocks (one per distinct pH)
- pH mixing → 2 stocks (`pH_low`, `pH_high`)

For each stock, `requiredVolume = (sum of its per-well volumes over all wells that use it)
* deadVolumeMultiplier`, rounded up sensibly. Output name, concentration, and required volume.

### 4.8 Engine output shape
```ts
interface WellRecipe {
  row: number; col: number;          // 0-based
  label: string;                     // e.g. "B3" (row letter + 1-based col)
  axisValues: { x?: number; y?: number };  // the resolved target values, for display
  components: { name: string; volumeUL: number }[]; // includes split buffer lines
  waterUL: number;
  totalUL: number;
  warnings: Warning[];
}
interface GridResult {
  wells: WellRecipe[];               // rows*cols entries
  prep: { name: string; conc: string; volumeUL: number }[];
  warnings: Warning[];               // global/aggregated
}
export function computeGrid(doc: ScreenDocument): GridResult { ... }
```

---

## 5. Canonical test fixture (Vitest) — implement engine to pass this

Screen: 6 cols × 4 rows, well volume 2000 µL.
- X-axis reagent: PEG 3350, stock 50 %w/v, range 18 → 30 %w/v (6 steps → 18, 20.4, 22.8, 25.2, 27.6, 30).
- Y-axis pH: acetate, final 100 mM, stock 1 M, pKa 4.76, pH list [4.6, 5.0, 5.4, 5.8], mode `mixing`.
- No constants.

Assert well **B3** (row index 1 → pH 5.0; col index 2 → PEG 22.8 %):
- PEG: `r = 22.8/50 = 0.456` → `912 µL` of PEG stock.
- Buffer total: `V_buf = (100mM / 1M) * 2000 = 0.1 * 2000 = 200 µL`.
- `phi(4.6) ≈ 0.40893`, `phi(5.8) ≈ 0.91642`, `phi(5.0) ≈ 0.63474`.
- `f_high = (0.63474 - 0.40893)/(0.91642 - 0.40893) ≈ 0.44495`.
- `V_high (pH 5.8) = 0.44495 * 200 ≈ 89.0 µL`; `V_low (pH 4.6) ≈ 111.0 µL`.
- `water = 2000 - 912 - 89 - 111 = 888 µL`; total = 2000 µL.

Use a tolerance of ±1 µL (the engine rounds to 0.1 µL). Also assert:
- a well at PEG 30 % needs 1200 µL stock and is still feasible;
- if PEG stock were 25 % instead of 50 %, the 30 % column needs 2400 µL > 2000 → "over volume"
  warning naming PEG;
- mixing with target pH list including 6.5 (> pH_high 5.8) → "pH out of range" warning.

---

## 6. Frontend UI

Single page. Left: a 3-step wizard. Right: a permanent, live-updating plate preview. Editing
anything recomputes via `computeGrid` and re-renders immediately (no network).

### Step 1 — Geometry & axes
- plate rows, cols, well volume (+ unit)
- "what varies along X?" and "what varies along Y?": each = None / a reagent / pH
- meta fields (sample, operator, temperature, notes) can live here or in a header bar

### Step 2 — Define axes
For each chosen axis, a card:
- reagent → name, stock conc + unit, mode (range low→high | explicit list), values
- pH → buffer name, concentration, stock conc, pH values (range or list), prep mode toggle
  (individual | mixing), and a pKa field shown only when mixing is selected. Show a one-line
  hint of what the user must prepare ("make 2 stocks at pH 4.6 & 5.8; tool blends per row").

### Step 3 — Constant additives
A list; each row: name, stock conc + unit, target conc. Add/remove. Applied to every well.

### Live preview (always visible, right side)
- A `rows × cols` grid of cells. **Axis headers show the real resolved values** (e.g. PEG %
  across the top, pH down the left side) — not just 1..6 / A..D.
- "Colour by" selector: choose any reagent (or pH); cells are shaded by that reagent's per-well
  target, normalized min→max over one colour ramp. (This makes each gradient legible — a
  pure-X reagent shows vertical bands, pure-Y shows horizontal bands.)
- Click a well → a detail card: its axis values and full pipetting recipe (including split
  buffer lines for mixing mode), the total, and a feasibility line.
- Global warnings (over-volume wells, sub-pipettable volumes, etc.) listed beneath the grid.
- A prep-list panel ("stocks to prepare") with required volumes.

### Exports (`exports.ts`)
- **CSV**: one row per well with columns for each component volume + water + total. Plus a
  second CSV (or section) for the prep list.
- **Printable worksheet**: a clean print stylesheet — the plate map + per-well table + prep list,
  with the meta header. Just use `window.print()` against a print-only layout (no PDF lib needed).

Round every number shown on screen.

---

## 7. Backend (FastAPI + SQLite) — persistence only

### Endpoints
- `POST /api/screens` — body: a `ScreenDocument` JSON. Validates lightly (Pydantic mirror in
  `models.py`), stores it, returns `{ "slug": "...", "url": "/s/{slug}" }`.
- `GET /api/screens/{slug}` — returns the stored `ScreenDocument` JSON, or 404 if missing,
  410 if expired.
- Serve the built frontend for all other GET paths (SPA fallback to `index.html`), so
  `/s/{slug}` opens the app and the client fetches the doc.

Screens are **immutable snapshots**: each save creates a new slug. (Optional stretch: support an
edit token returned on create that allows `PUT /api/screens/{slug}` overwrite.)

### Slugs (`slugs.py`, `wordlists.py`)
Generate human-friendly random names like `wandering-violet-otter`: pick from two adjective
lists + one animal-noun list (curate ~100 of each in `wordlists.py` → ~10⁶ combos). On
collision, retry; after a few tries, append a 3-char base36 suffix.

### SQLite schema (`db.py`)
```sql
CREATE TABLE IF NOT EXISTS screens (
  slug        TEXT PRIMARY KEY,
  doc         TEXT NOT NULL,           -- JSON string
  created_at  TEXT NOT NULL,           -- ISO8601 UTC
  expires_at  TEXT                     -- ISO8601 UTC, nullable
);
```
Default TTL ~90 days (configurable via env `SCREEN_TTL_DAYS`, empty = never expire). On `GET`,
treat past-`expires_at` as 410. A lightweight sweep on startup is enough; no scheduler needed.

The SQLite file path comes from env `DB_PATH` (default `/data/gridwright.db`) so Coolify can
mount a volume at `/data`.

---

## 8. Packaging & deploy

### Dockerfile (multi-stage)
1. `node:20` stage: `cd frontend && npm ci && npm run build` → produces `frontend/dist`.
2. `python:3.12-slim` stage: `pip install -r backend/requirements.txt`, copy backend app and the
   built `dist/`, set `CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]`.
3. Expose `8000`. FastAPI serves `dist/` statically + `/api/*`.

`requirements.txt`: `fastapi`, `uvicorn[standard]`, `pydantic`.

### Coolify
- Build from the repo Dockerfile, expose port 8000.
- Mount a persistent volume at `/data` for the SQLite file.
- Env: `DB_PATH=/data/gridwright.db`, optional `SCREEN_TTL_DAYS`.

Provide `docker-compose.yml` for local dev (one service, volume `./data:/data`).

---

## 9. Conventions & guardrails (consider lifting into CLAUDE.md)

- The `engine/` module is **pure and framework-free** — no React, no fetch, no DOM. It takes a
  `ScreenDocument` and returns a `GridResult`. This is what makes it testable and trustworthy.
- **No calculation in Python.** The backend stores and returns JSON; that is all.
- TypeScript `strict: true`. No `any` in the engine.
- **Round every number that reaches the screen or an export.** Internal math stays full precision;
  rounding happens at the display/CSV boundary.
- Volumes internal unit is always µL.
- Validate unit-family compatibility before computing and surface errors in the UI rather than
  throwing.
- Keep warnings as data (typed objects), not strings thrown as exceptions.
- Write Vitest tests alongside each engine file; the §5 fixture must pass before any UI work.
- Don't reproduce the clunky form-heavy UI of older formulation tools — the live preview and the
  collapsed axis controls are the whole reason GridWright exists.

---

## 10. Build order (milestones — do them in this sequence)

- **M1 — Scaffold.** Create both projects, the `ScreenDocument` types, an empty engine API, and
  a passing "hello" test. Confirm `npm run dev` and `uvicorn` both start.
- **M2 — Engine + tests (do this fully before UI).** Implement units, expansion, per-well,
  pH mixing, feasibility, prep list. Make the §5 fixture and edge-case tests pass.
- **M3 — Live preview component.** Feed `computeGrid` output into the plate grid with real axis
  values, colour-by, click-for-recipe, warnings, prep list. Drive it from a hard-coded doc first.
- **M4 — Wizard.** Steps 1–3 editing a single `ScreenDocument` in state; every edit recomputes and
  updates the preview live.
- **M5 — Exports.** CSV + printable worksheet.
- **M6 — Persistence.** FastAPI endpoints + slug generation + SQLite; wire "save" (returns slug
  URL) and load-by-slug on `/s/{slug}`.
- **M7 — Package & deploy.** Dockerfile, docker-compose, README, Coolify notes.

Each milestone should leave the app runnable and the test suite green.