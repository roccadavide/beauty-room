import LaserFlow from "./LaserFlow";
import { Button, Container } from "react-bootstrap";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

const MotionDiv = motion.div;

export default function LaserSection() {
  const reduce = useReducedMotion();
  const sectionRef = useRef(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start 90%", "start 55%"],
  });

  const liftY = useTransform(scrollYProgress, [0, 0.25, 1], [0, 0, reduce ? 0 : -70]);
  const liftScale = useTransform(scrollYProgress, [0, 1], [1, reduce ? 1 : 1.02]);

  return (
    <section ref={sectionRef} className="laser-section">
      <Container className="d-flex justify-content-center align-items-center">
        <MotionDiv className="laser-card laser-card--dark" style={{ y: liftY, scale: liftScale }}>
          <div className="laser-fx" aria-hidden="true">
            <div className="laser-fx-inner">
              <LaserFlow
                background="#2F2723"
                color="#FFD7A1"
                horizontalBeamOffset={0.25}
                verticalBeamOffset={-0.3}
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
          </div>

          <img src="/handpiece.png" alt="Manipolo laser" className="laser-handpiece" draggable="false" />

          <div className="laser-content">
            <div className="laser-top">
              <div className="laser-left">
                <img src="/laser.png" alt="Macchinario laser" className="laser-machine" draggable="false" />

                <div className="laser-side">
                  <div className="laser-ctas d-flex gap-2 flex-column px-3">
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
                  </div>

                  <div className="laser-pay">
                    Disponibile pagamento in <strong>3 rate</strong> con Scalapay
                  </div>
                </div>
              </div>

              <div className="laser-wrapper-mobile">
                <div className="laser-copy">
                  <div className="laser-kicker">Laser • Estetica avanzata</div>

                  <h2 className="laser-title">Stanca di lamette e cerette ogni settimana?</h2>

                  <p className="laser-text">
                    Con il nuovo macchinario <strong>HILED KUBE</strong> di <strong>HiTek Milano</strong> riduci progressivamente la ricrescita e ottieni una
                    pelle più liscia.
                    <br />
                    <span className="laser-subtle">
                      Spesso si nota una differenza già dalle prime sedute (i risultati possono variare in base al tipo di pelle e pelo).
                    </span>
                  </p>

                  <div className="laser-ctas-mobile">
                    <Button variant="light" className="rounded-pill px-4 laser-btn-primary">
                      Prenota una consulenza
                    </Button>
                  </div>

                  <div className="laser-ctas d-flex gap-2 flex-wrap laser-ctas--main">
                    <Button variant="light" className="rounded-pill px-4 laser-btn-primary">
                      Prenota una consulenza
                    </Button>

                    <Button variant="outline-light" className="rounded-pill px-4">
                      Guarda i risultati
                    </Button>
                  </div>

                  <div className="laser-meta laser-meta--main">
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
                <div className="laser-machine-mobile">
                  <img src="/laser.png" alt="Macchinario laser" className="laser-machine" draggable="false" />
                </div>
              </div>
            </div>
          </div>

          <div className="laser-overlay" aria-hidden="true" />
        </MotionDiv>
      </Container>
    </section>
  );
}
