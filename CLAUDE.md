# CLAUDE.md

Operational guide for working in this repository. The full reference spec is
`gridwright-build-spec.md` — read it before starting. This file is the short list of things to
keep in mind on **every** change.

## What this is

**GridWright** — a single-page web tool for designing per-well crystallization optimization
trays. A user defines how reagents and/or pH vary across a microplate; the app computes an
explicit pipetting recipe (stock volumes + water) for every well, a stock-prep list, and live
feasibility warnings. It uses the **individual-pipetting** model — every well is computed
independently, no interpolation.

## Golden rules — do not violate

1. **The engine is pure.** `frontend/src/engine/` imports no React, no `fetch`, no DOM. It is a
   function: `ScreenDocument -> GridResult`. This is what makes the math testable and trusted.
2. **No calculation in Python.** The backend only stores/returns JSON and mints slugs. All
   chemistry/volume math lives in the TS engine and runs in the browser.
3. **Engine before UI.** Build and green the engine + its Vitest tests (milestone M2) before
   writing any UI. The worked fixture in spec §5 is the ground truth — it must pass.
4. **Round at the boundary.** Keep full precision internally; round only at the display/CSV
   boundary. Internal volume unit is always µL.
5. **Warnings are data, not exceptions.** Return typed warning objects; the UI renders them live.
   Validate unit-family compatibility before computing.
6. `tsconfig` `strict: true`. No `any` in the engine.

## Repo map

```
frontend/src/engine/   pure TS calc (types, units, expand, ph, well, screen)  <- the heart
frontend/src/engine/__tests__/   Vitest specs (write alongside the engine)
frontend/src/ui/       React: wizard (Step1-3), PlatePreview, WellDetail, PrepList, exports
frontend/src/api/      thin client for the backend
backend/app/           FastAPI: main, db, models, slugs, wordlists  (persistence only)
Dockerfile             multi-stage: build frontend -> serve via FastAPI
```

## Commands

```
# frontend
cd frontend && npm install
npm run dev          # vite dev server
npm run test         # vitest (run this constantly while building the engine)
npm run build        # outputs dist/

# backend
cd backend && pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# whole app
docker compose up --build
```

## How to work

- Follow milestones **M1 -> M7** from the spec, in order. Each milestone must leave the app
  runnable and the test suite green before moving on.
- TDD the engine: write the spec §5 fixture test first, then implement until it passes, then add
  the edge-case tests (over-volume, cannot-concentrate, sub-pipettable, pH-out-of-range).
- Keep dependencies minimal. Frontend: React, Vite, Vitest, and optionally Zustand for state.
  Backend: FastAPI, Uvicorn, Pydantic. Flag before adding anything else.
- Always make sure that you can continue work, in the case tokens run out in the middle of a coding run.
## Domain quick-reference (so you don't reinvent it)

- **Axes:** X varies across columns; Y varies across rows; constants apply to all wells; water
  always tops up to the well volume.
- **Core formula:** `V_stock = (C_target / C_stock) * V_well`, with `C_target` and `C_stock` in
  the same unit family.
- **pH is ONE reagent.** `mixing` mode = exactly 2 stocks (lowest- and highest-pH), blended per
  well via the pKa using Henderson-Hasselbalch on the base-form fraction (it is NOT linear in
  pH). `individual` mode = one pre-adjusted stock per pH value. See spec §4.3.
- A screen with only one varying axis is valid (the other axis is `null`).

## Don't

- Don't put domain math in React components or in Python.
- Don't treat `localStorage` as the source of truth for shared screens — that's the backend's
  job (save -> slug, load by slug). A local draft autosave for the in-progress screen is fine.
- Don't skip the engine tests to get to UI faster — the math correctness is the whole point.
- Don't reproduce the clunky form-heavy UI of older formulation tools — the live preview and the
  collapsed axis controls are the whole reason GridWright exists.