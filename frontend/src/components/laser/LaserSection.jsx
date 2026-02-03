import LaserFlow from "./LaserFlow";
import { Button, Container } from "react-bootstrap";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

export default function LaserSection() {
  const reduce = useReducedMotion();
  const sectionRef = useRef(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start 100%", "start 40%"],
  });

  const liftY = useTransform(scrollYProgress, [0, 0.25, 1], [0, 0, reduce ? 0 : -220]);
  const liftScale = useTransform(scrollYProgress, [0, 1], [1, reduce ? 1 : 1.02]);

  return (
    <section ref={sectionRef} className="laser-section">
      <Container className="d-flex justify-content-center">
        <motion.div className="laser-card" style={{ y: liftY, scale: liftScale }}>
          <div className="laser-fx">
            <LaserFlow
              background="#f3e7dc"
              color="#7E66C7"
              horizontalBeamOffset={0.25}
              verticalBeamOffset={-0.3}
              wispDensity={0.6}
              wispSpeed={3}
              wispIntensity={3}
              flowSpeed={0.35}
              flowStrength={0.2}
              fogIntensity={0.25}
              fogScale={0.15}
              decay={1.5}
              verticalSizing={1.9}
              horizontalSizing={0.5}
            />
          </div>

          <img src="/handpiece.png" alt="Manipolo laser" className="laser-handpiece" draggable="false" />

          <div className="laser-content">
            <div className="laser-kicker">Laser • Estetica avanzata</div>

            <h2 className="laser-title">Epilazione laser: risultati visibili, pelle più liscia</h2>

            <p className="laser-text">Un percorso personalizzato con macchinario professionale, studiato in base al tuo tipo di pelle e alle tue esigenze.</p>

            <div className="d-flex gap-2 flex-wrap">
              <Button variant="dark" className="rounded-pill px-4">
                Scopri il laser
              </Button>

              <Button variant="outline-dark" className="rounded-pill px-4">
                Prenota una consulenza
              </Button>
            </div>

            <div className="laser-info">
              Per informazioni rapide:{" "}
              <a href="https://wa.me/393780921723" target="_blank" rel="noreferrer" className="laser-whatsapp">
                WhatsApp
              </a>
            </div>
          </div>
        </motion.div>
      </Container>
    </section>
  );
}
