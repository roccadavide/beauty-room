import LaserFlow from "./LaserFlow";
import { Button, Container } from "react-bootstrap";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

export default function LaserSection() {
  const reduce = useReducedMotion();
  const sectionRef = useRef(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start 90%", "start 55%"],
  });

  // Se vuoi un effetto meno “invadente”, cambia -70 in -45
  const liftY = useTransform(scrollYProgress, [0, 0.25, 1], [0, 0, reduce ? 0 : -70]);
  const liftScale = useTransform(scrollYProgress, [0, 1], [1, reduce ? 1 : 1.02]);

  return (
    <section ref={sectionRef} className="laser-section">
      <Container className="d-flex justify-content-center align-items-center">
        <motion.div className="laser-card laser-card--dark" style={{ y: liftY, scale: liftScale }}>
          <div className="laser-fx">
            <LaserFlow
              background="#2F2723"
              color="#FFC46B"
              horizontalBeamOffset={0.25}
              verticalBeamOffset={-0.2}
              wispDensity={8.75}
              wispSpeed={1.5}
              wispIntensity={5.6}
              flowSpeed={0.35}
              flowStrength={0.05}
              fogIntensity={1.05}
              fogScale={0.11}
              decay={2.5}
              verticalSizing={1.9}
              horizontalSizing={0.5}
            />
          </div>

          <img src="/handpiece.png" alt="Manipolo laser" className="laser-handpiece" draggable="false" />

          <div className="laser-content">
            <img src="/laser.png" alt="Macchinario laser" className="laser-machine" draggable="false" />

            <div className="laser-copy">
              <div className="laser-kicker">Laser • Estetica avanzata</div>

              <h2 className="laser-title">Stanca di lamette e cerette ogni settimana?</h2>

              <p className="laser-text">
                Con il nuovo laser <strong>HILED</strong> di <strong>HiTek Milano</strong> riduci progressivamente la ricrescita e ottieni una pelle più liscia.
                <br />
                <span className="laser-subtle">
                  Spesso si nota una differenza già dalle prime sedute <br />
                  (i risultati possono variare in base al tipo di pelle e pelo).
                </span>
              </p>

              <div className="laser-ctas d-flex gap-2 flex-wrap">
                <Button variant="light" className="rounded-pill px-4 laser-btn-primary">
                  Prenota una consulenza
                </Button>

                <Button variant="outline-light" className="rounded-pill px-4">
                  Guarda i risultati
                </Button>
              </div>

              <div className="laser-meta">
                <div className="laser-info">
                  Per info rapide:{" "}
                  <a href="https://wa.me/393780921723" target="_blank" rel="noreferrer" className="laser-whatsapp">
                    WhatsApp
                  </a>
                </div>

                <div className="laser-pay">
                  Disponibile pagamento in <strong>3 rate</strong> con Scalapay
                </div>
              </div>
            </div>
          </div>

          <div className="laser-overlay" aria-hidden="true" />
        </motion.div>
      </Container>
    </section>
  );
}
