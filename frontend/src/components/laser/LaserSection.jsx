import LaserFlow from "./LaserFlow";
import { Button, Container } from "react-bootstrap";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef, useEffect, useState } from "react";

const MotionDiv = motion.div;

export default function LaserSection() {
  const reduce = useReducedMotion();
  const sectionRef = useRef(null);
  const cardRef = useRef(null);
  const stripRef = useRef(null);

  // Desktop: 2.1 (compensa il moltiplicatore 0.9 nel shader → risultato 1.89, identico a prima)
  // Mobile:  0.05 (× 0.9 nel shader = 0.045, fog molto ridotta)
  const [fogValue, setFogValue] = useState(typeof window !== "undefined" && window.innerWidth <= 575 ? 0.05 : 2.1);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start 90%", "start 55%"],
  });

  const liftY = useTransform(scrollYProgress, [0, 0.25, 1], [0, 0, reduce ? 0 : -70]);
  const liftScale = useTransform(scrollYProgress, [0, 1], [1, reduce ? 1 : 1.02]);

  // Fog adattivo al resize
  useEffect(() => {
    const handler = () => setFogValue(window.innerWidth <= 575 ? 0.05 : 2.1);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // Animazione entrata card — osserva il WRAPPER, non la MotionDiv
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    if (reduce) {
      card.classList.add("laser-card--visible");
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          card.classList.add("laser-card--visible");
          observer.disconnect();
        }
      },
      { threshold: 0.06 },
    );
    observer.observe(card);
    return () => observer.disconnect();
  }, [reduce]);

  // Fade-in strip mobile
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
        <MotionDiv ref={cardRef} className="laser-card-wrapper" style={{ y: liftY, scale: liftScale }}>
          <div className="laser-card laser-card--dark">
            {/* WebGL beam */}
            <div className="laser-fx" aria-hidden="true">
              <div className="laser-fx-inner">
                <LaserFlow
                  background="#2F2723"
                  color="#FFD7A1"
                  horizontalBeamOffset={0.25}
                  verticalBeamOffset={-0.3}
                  wispDensity={5.0} // era 6.5 — meno righe, più leggibili
                  wispSpeed={2.8} // era 1.5 — wisps si muovono più veloce
                  wispIntensity={6.5} // era 4.5 — più luminosi, si vedono su mobile
                  flowSpeed={0.85} // era 0.35 — il movimento principale è quasi doppio
                  flowStrength={0.18} // era 0.05 — distorsione molto più visibile
                  fogIntensity={fogValue}
                  fogScale={0.11}
                  decay={2.8} // era 2.5 — beam leggermente più definito
                  verticalSizing={2.1} // era 1.9 — beam più lungo, scende di più
                  horizontalSizing={0.5}
                />
              </div>
            </div>

            {/* Handpiece — assoluto top-right */}
            <img src="/handpiece.png" alt="Manipolo laser" className="laser-handpiece" draggable="false" />

            {/* Maschera beam sopra manipolo (mobile) */}
            <div className="laser-beam-mask" aria-hidden="true" />

            <div className="laser-content">
              <div className="laser-top">
                {/* Colonna sinistra desktop/tablet */}
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

                {/* Wrapper mobile */}
                <div className="laser-wrapper-mobile">
                  <div className="laser-body-mobile">
                    {/* Macchina — solo mobile */}
                    <div className="laser-machine-mobile">
                      <img src="/laser.png" alt="Macchinario laser" className="laser-machine" draggable="false" />
                    </div>

                    {/* Copy — sempre visibile */}
                    <div className="laser-copy">
                      <div className="laser-kicker">Laser • Estetica avanzata</div>
                      <h2 className="laser-title">Stanca di lamette e cerette ogni settimana?</h2>
                      {/* Testo breve solo mobile */}
                      <p className="laser-text-mobile">
                        Con <strong>HILED KUBE</strong> di <strong>HiTek Milano</strong> riduci progressivamente la ricrescita e ottieni una pelle più liscia.
                      </p>
                      {/* Testo lungo tablet/desktop */}
                      <p className="laser-text">
                        Con il nuovo macchinario <strong>HILED KUBE</strong> di <strong>HiTek Milano</strong> riduci progressivamente la ricrescita e ottieni
                        una pelle più liscia.
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
                  </div>
                </div>
              </div>
            </div>

            {/* Strip inferiore — solo mobile */}
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
          </div>
        </MotionDiv>
        {/* fine laser-card-wrapper */}
      </Container>
    </section>
  );
}
