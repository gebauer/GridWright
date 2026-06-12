# GridWright v2 — Reagent name autocomplete

A typeahead that helps users fill reagent/buffer fields faster. As they type a name, it suggests
known crystallization compounds and prefills the stock concentration (and, for buffers, the pKa).
**No shop, no links, no network** — the data is a static file bundled with the frontend.

## Data source

`compounds.json` (this folder). Shape:

```
meta: { ...notes about provenance, stock conventions, pKa, cas/mw, hint }
compounds: [
  { name, aliases[], category: "buffer"|"salt"|"polymer"|"organic",
    stock: { value, unit },
    pKa?: number[],     // buffers only
    cas?: string|null,  // CAS registry number (null where not assigned/uncertain)
    mw?: number|null,   // g/mol; common anhydrous/free-acid form unless name says hydrate
    hint?: string }     // optional advisory, shown when the compound is selected
]
```

138 entries to start (37 buffers, 60 salts, 23 polymers, 18 organics). Stock concentrations are
typical crystallization-grade values (~Hampton Optimize / near solubility); buffer pKa are
standard 25 °C reference values. **These are prefilled suggestions only — every field stays
editable.** Extend by appending objects; no code change needed. Load the JSON once at app start
(import it or fetch it) and keep it in memory.

`cas` and `mw` are **informational** (identification / weighing-out a stock) and are **not used in
the volume calculation**. `mw` is computed from the molecular formula of the common
anhydrous/free-acid form unless the name specifies a hydrate; hydration changes MW, so the UI copy
should remind the user to confirm against their actual reagent. A few entries (buffer *systems*
like phosphate/carbonate, and some proprietary polymers) have `cas: null` / `mw: null` by design.

## Matching behaviour

- Case-insensitive match of the query against `name` + every `aliases` entry.
- Rank: exact > prefix-of-name > prefix-of-alias > substring. Break ties alphabetically.
- Cap the dropdown at ~8 results. Show `name` with a small category tag and the default stock
  (e.g. "Ammonium sulfate · salt · 4.0 M").
- Selecting an item fills the form; typing a name not in the list is always allowed (free text).

## Prefill mapping

Where the field is a **reagent axis** or **constant additive**:
- `name` → reagent name
- `stock.value` → stock concentration
- `stock.unit` → unit

Where the field is a **pH axis** (buffer):
- `name` → `bufferName`
- `stock.value` / `stock.unit` → buffer `stockConc` / `stockUnit`
- `pKa` → the `pKa` field. For polyprotic buffers (`pKa` has >1 value), pick the pKa **nearest the
  midpoint of the entered pH range**. If no pH range is entered yet, prefill the middle pKa and
  show the alternatives so the user can switch. Always leave it editable.

> Example: user picks "Citric acid" (pKa `[3.13, 4.76, 6.40]`) with a pH range 5.5–6.5 → midpoint
> 6.0 → prefill pKa 6.40. With a range 4.0–5.0 → prefill 4.76.

## On selection: show the hint, CAS, and MW

When the user picks a compound, surface its reference info next to the field (a small caption or
info popover):
- **`hint`** (if present) — show it prominently; these are real cautions. Examples in the data:
  multi-pKa buffers (e.g. citrate → "pKa 3.13, 4.76, 6.40 — the mixing calculation uses the value
  nearest your chosen pH range; if your pH range spans more than one pKa, mixing-mode pH becomes
  unreliable…"), cacodylate ("contains arsenic"), phosphate ("complexes divalent cations"),
  Tris ("pKa is temperature-dependent"), volatile organics, viscous high-MW PEGs, heavy-metal salts.
- **`cas` / `mw`** — show as muted secondary text (e.g. "CAS 77-92-9 · 192.12 g/mol") to help the
  user identify and weigh out the reagent. If `null`, omit that piece.

The hint is advisory only — it never blocks the choice.

## Where it lives

- `frontend/src/data/compounds.json` — the dataset.
- `frontend/src/engine/compounds.ts` (or `ui/`) — a small, pure matcher: `search(query): Compound[]`
  and `nearestPKa(pKa[], pHmid): number`. Keep the matcher pure and unit-tested; the React
  autocomplete component is a thin wrapper around it.

## Notes & caveats (carry into the UI copy if useful)

- The stock values are conventions, not guarantees — the tooltip should say "suggested stock,
  edit to match your bottle."
- Solubility/stock for some less-common salts is approximate; the user override is the safety net.
- Buffer titration convention assumed by GridWright (HCl/NaOH, two-stock mixing) is unchanged;
  this feature only prefills the pKa used by that calculation.