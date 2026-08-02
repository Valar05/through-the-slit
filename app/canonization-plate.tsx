"use client";

export default function CanonizationPlate({ onClose }: { onClose: () => void }) {
  return (
    <section className="canonization-plate" role="region" aria-live="assertive" aria-labelledby="canon-title">
      <header>
        <p className="eyebrow">SAINT MENDEL // THIRD GENERATION</p>
        <h2 id="canon-title">THE ARMY LEARNED</h2>
        <button type="button" onClick={onClose}>RETURN TO THE SLIT</button>
      </header>
      <div className="canonical-lineage" aria-label="Martyr's Winch three-generation history">
        <article><b>01</b><strong>LANDSHIP</strong><span>Paid in exposed tissue to recover one endangered body.</span></article>
        <article><b>02</b><strong>SAPPER BROOD</strong><span>Released the mechanism; several bodies learned the responsibility.</span></article>
        <article><b>03</b><strong>CORRECTION</strong><span>Refused the captured gun and kept the casualty route alive.</span></article>
      </div>
      <footer>
        <strong>CANONICAL: COALITION RESCUE JURISDICTION</strong>
        <span>Future possibility pool only · no starting item · no stat ladder · no guaranteed appearance</span>
      </footer>
    </section>
  );
}
