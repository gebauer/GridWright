interface Props {
  onClose: () => void
}

export default function HelpModal({ onClose }: Props) {
  return (
    <div className="help-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="help-modal" role="dialog" aria-modal="true" aria-label="GridWright help">
        <div className="help-modal-header">
          <h2>How to use GridWright</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close help">✕</button>
        </div>

        <div className="help-modal-body">

          <section className="help-section">
            <h3>What is GridWright?</h3>
            <p>
              GridWright designs <strong>per-well pipetting recipes</strong> for crystallization
              optimization trays. You define how reagent concentrations or pH vary across a
              microplate; GridWright computes the exact stock and water volumes needed for every well
              independently — no interpolation.
            </p>
          </section>

          <section className="help-section">
            <h3>Step 1 — Geometry</h3>
            <p>
              Choose your plate format (24, 48, 96-well, or custom) and set the target well volume.
              Then decide which axes vary:
            </p>
            <ul>
              <li><strong>X axis</strong> — concentration or pH varies across <em>columns</em></li>
              <li><strong>Y axis</strong> — concentration or pH varies across <em>rows</em></li>
            </ul>
            <p>You can use one axis or both. Setting an axis to "None" keeps that dimension constant.</p>
          </section>

          <section className="help-section">
            <h3>Step 2 — Axes</h3>
            <p>Configure each active axis as either a <strong>Reagent</strong> or a <strong>pH buffer</strong>.</p>

            <h4>Reagent axis</h4>
            <ul>
              <li>Pick a compound from the autocomplete list or type a name.</li>
              <li>Enter your <strong>stock concentration</strong> and its unit.</li>
              <li>Set the <strong>target concentration</strong> range (low → high) or a custom list of values — one per column or row. The unit for the target can differ from the stock unit (e.g. 1 M stock → 10–100 mM final).</li>
            </ul>

            <h4>pH axis</h4>
            <ul>
              <li>Pick a buffer compound and enter its stock concentration.</li>
              <li>Set the <strong>final buffer concentration</strong> (same for all wells on this axis).</li>
              <li>Define the <strong>pH range</strong>. The pKa auto-updates to the nearest value when you change the range; you can also edit it manually.</li>
              <li>
                <strong>Preparation mode:</strong>
                <ul>
                  <li><em>Mixing</em> — two stocks (lowest pH and highest pH) are blended per well using Henderson-Hasselbalch. Fewer stocks to prepare.</li>
                  <li><em>Individual</em> — one pre-adjusted stock per pH step. More predictable but more stocks.</li>
                </ul>
              </li>
              <li>An orange highlight on a pH endpoint means the buffer may be ineffective there (more than 1.5 units from the nearest pKa).</li>
            </ul>
          </section>

          <section className="help-section">
            <h3>Step 3 — Constants</h3>
            <p>
              Add reagents that appear at the <strong>same concentration in every well</strong>
              — precipitants, cryo-protectants, salts. Each constant needs a stock concentration
              and a target final concentration. Water is always added to top up to the well volume.
            </p>
          </section>

          <section className="help-section">
            <h3>Plate preview</h3>
            <ul>
              <li>Updates live as you fill in values.</li>
              <li><strong>Click any well</strong> to see its full recipe: which volumes of each stock to pipette, plus any warnings.</li>
              <li>Use <strong>Colour by</strong> to toggle the gradient display between X and Y axes.</li>
              <li>Warning badges on wells indicate over-volume, sub-pipettable volumes, or pH out of range.</li>
            </ul>
          </section>

          <section className="help-section">
            <h3>Exports</h3>
            <ul>
              <li><strong>Recipe CSV</strong> — one row per well; all stock volumes and water.</li>
              <li><strong>Prep list CSV</strong> — how much of each stock to prepare in total, with dead-volume margin.</li>
              <li><strong>Print worksheet</strong> — formatted A4 layout for bench use.</li>
            </ul>
            <p>Export buttons appear once the plate has a valid recipe (at least one axis defined).</p>
          </section>

          <section className="help-section">
            <h3>Saving and sharing</h3>
            <p>
              <strong>Save &amp; share</strong> uploads your screen and generates a short URL.
              Share the URL with collaborators — loading it restores the exact configuration.
              Your draft is also auto-saved locally in the browser so you don't lose work between sessions.
            </p>
            <p>
              <strong>New screen</strong> clears the current design and the local draft.
            </p>
          </section>

          <section className="help-section">
            <h3>Units</h3>
            <p>
              Stock and target concentrations must belong to the same unit family (molar: M / mM / µM;
              or %w/v, %v/v, mg/mL, X). Mixing families across a single reagent triggers a warning.
              Target units can differ from stock units within the same family — for example a 1 M stock
              dispensed at 10 mM final.
            </p>
          </section>

        </div>
      </div>
    </div>
  )
}
