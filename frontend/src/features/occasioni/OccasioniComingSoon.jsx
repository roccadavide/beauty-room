import SEO from "../../components/common/SEO";
import "./OccasioniComingSoon.css";

// Public placeholder shown while the "Occasioni" feature is gated off
// (FEATURE_OCCASIONI_ENABLED === false). Branded "coming soon" — no data fetch,
// no booking surface. Re-enabling the flag restores the real OccasioniPage.
export default function OccasioniComingSoon() {
  return (
    <section className="ocs-section">
      <SEO title="Occasioni" description="Pacchetti e promozioni Beauty Room: presto disponibili. Trattamenti laser ed estetica avanzata a Calusco d'Adda." />

      <div className="ocs-inner">
        <span className="ocs-eyebrow">
          <span className="ocs-eyebrow__star" aria-hidden="true">
            ✦
          </span>
          In arrivo
        </span>

        <h1 className="ocs-title">Le occasioni stanno arrivando</h1>

        <p className="ocs-subtitle">
          Pacchetti e promozioni pensati su misura per te. Ci stiamo lavorando con cura — torna a trovarci tra poco.
        </p>

        <div className="ocs-divider" aria-hidden="true">
          <span className="ocs-divider__shine" />
        </div>

        <span className="ocs-note">Disponibili a breve</span>
      </div>
    </section>
  );
}
