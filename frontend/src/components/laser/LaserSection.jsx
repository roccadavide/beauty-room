import LaserFlow from "./LaserFlow";
import { Button, Container } from "react-bootstrap";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef, useEffect } from "react";

const MotionDiv = motion.div;

export default function LaserSection() {
  const reduce = useReducedMotion();
  const sectionRef = useRef(null);
  const stripRef = useRef(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start 90%", "start 55%"],
  });

  const liftY = useTransform(scrollYProgress, [0, 0.25, 1], [0, 0, reduce ? 0 : -70]);
  const liftScale = useTransform(scrollYProgress, [0, 1], [1, reduce ? 1 : 1.02]);

  // Fade-in strip mobile via IntersectionObserver
  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    if (reduce) {
      el.classList.add("laser-strip--visible");
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("laser-strip--visible");
          observer.disconnect();
        }
      },
      { threshold: 0.05 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reduce]);

  return (
    <section ref={sectionRef} className="laser-section">
      <Container className="d-flex justify-content-center align-items-center">
        <MotionDiv className="laser-card laser-card--dark" style={{ y: liftY, scale: liftScale }}>
          {/* WebGL beam */}
          <div className="laser-fx" aria-hidden="true">
            <div className="laser-fx-inner">
              <LaserFlow
                background="#2F2723"
                color="#FFD7A1"
                horizontalBeamOffset={0.25}
                verticalBeamOffset={-0.3}
                wispDensity={6.5}
                wispSpeed={1.5}
                wispIntensity={4.5}
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

          {/* Handpiece — assoluto top-right */}
          <img src="/handpiece.png" alt="Manipolo laser" className="laser-handpiece" draggable="false" />

          <div className="laser-beam-mask" aria-hidden="true" />

          <div className="laser-content">
            <div className="laser-top">
              {/* ── Colonna sinistra desktop/tablet: macchina + CTA ── */}
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

              {/* ── Wrapper ── */}
              <div className="laser-wrapper-mobile">
                {/*
                  laser-body-mobile:
                  - Desktop/tablet: display:contents → figli fluiscono normalmente
                  - Mobile ≤575px:  display:flex row → macchina sx | copy dx
                  NON mettere mai display:none qui o il copy sparisce su tablet.
                */}
                <div className="laser-body-mobile">
                  {/* Macchina: visibile SOLO su mobile ≤575px */}
                  <div className="laser-machine-mobile">
                    <img src="/laser.png" alt="Macchinario laser" className="laser-machine" draggable="false" />
                  </div>

                  {/* Copy: SEMPRE visibile su tutti i breakpoint */}
                  <div className="laser-copy">
                    <div className="laser-kicker">Laser • Estetica avanzata</div>

                    <h2 className="laser-title">Stanca di lamette e cerette ogni settimana?</h2>

                    <p className="laser-text-mobile">
                      Con <strong>HILED KUBE</strong> di <strong>HiTek Milano</strong> riduci progressivamente la ricrescita e ottieni una pelle più liscia.
                    </p>

                    {/* Testo lungo: visibile su tablet/desktop, nascosto su mobile */}
                    <p className="laser-text">
                      Con il nuovo macchinario <strong>HILED KUBE</strong> di <strong>HiTek Milano</strong> riduci progressivamente la ricrescita e ottieni una
                      pelle più liscia.
                      <br />
                      <span className="laser-subtle">
                        Spesso si nota una differenza già dalle prime sedute (i risultati possono variare in base al tipo di pelle e pelo).
                      </span>
                    </p>

                    {/* CTA tablet/desktop */}
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
                  {/* fine laser-copy */}
                </div>
                {/* fine laser-body-mobile */}
              </div>
              {/* fine laser-wrapper-mobile */}
            </div>
          </div>
          {/* fine laser-content */}

          {/*
            ── STRIP INFERIORE ── solo mobile ≤575px
            bg #1e1814 (più scuro di #2f2723), separazione netta
            il fascio "atterra" visivamente sulla strip
          */}
          <div ref={stripRef} className="laser-strip">
            <Button className="laser-btn-gold">Prenota una consulenza</Button>
            <div className="laser-strip-meta">
              <span className="laser-info">
                Per info rapide:{" "}
                <a href="https://wa.me/393780921723" target="_blank" rel="noreferrer" className="laser-whatsapp">
                  WhatsApp
                </a>
              </span>
              <span className="laser-pay">
                Pagamento in <strong>3 rate</strong> con Scalapay
              </span>
            </div>
          </div>

          <div className="laser-overlay" aria-hidden="true" />
        </MotionDiv>
      </Container>
    </section>
  );
}
