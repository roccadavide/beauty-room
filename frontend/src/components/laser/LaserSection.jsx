import LaserFlow from "./LaserFlow";
import { Button, Container } from "react-bootstrap";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const MotionDiv = motion.div;

// ID stabile in produzione — aggiornare solo se il record viene ricreato
const LASER_SERVICE_UUID = "ea41a8cd-bfec-49d3-bfa4-206c297ecd9d";

// ── Fog: compensa DPR per densità uniforme su Retina / Safari Metal ──
// Il canvas WebGL renderizza a DPR×risoluzione → fog appare DPR× più
// densa. Dividiamo per min(DPR, 2) per riallineare tutti i display.
const getFog = () => {
  if (typeof window === "undefined") return 2.1;
  if (window.innerWidth <= 725) return 0.05;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  return 2.1 / dpr;
  // DPR 1 (non-Retina, Chrome/Firefox) → 2.1
  // DPR 2 (Retina MacBook, iPhone)     → 1.05
  // DPR 3 (Android high-end, capped 2) → 1.05
};

export default function LaserSection() {
  const reduce = useReducedMotion();
  const sectionRef = useRef(null);
  const cardRef = useRef(null);
  const stripRef = useRef(null);
  const navigate = useNavigate();

  const [fogValue, setFogValue] = useState(getFog);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start 90%", "start 55%"],
  });

  const liftY = useTransform(scrollYProgress, [0, 0.25, 1], [0, 0, reduce ? 0 : -70]);
  const liftScale = useTransform(scrollYProgress, [0, 1], [1, reduce ? 1 : 1.02]);

  // Su mobile nessun parallax (evita GPU compositing e fringing Safari)
  const motionStyle = reduce ? {} : { y: liftY, scale: liftScale };

  useEffect(() => {
    const handler = () => {
      setFogValue(getFog());
    };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // Entry animation — osserva il WRAPPER, non la MotionDiv
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

  // Fade-in strip
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
        <MotionDiv ref={cardRef} className="laser-card-wrapper" style={motionStyle}>
          <div className="laser-card laser-card--dark">
            {/* WebGL beam */}
            <div className="laser-fx" aria-hidden="true">
              <div className="laser-fx-inner">
                <LaserFlow
                  background="#2F2723"
                  color="#FFD7A1"
                  horizontalBeamOffset={0.25}
                  verticalBeamOffset={-0.3}
                  wispDensity={5.0}
                  wispSpeed={2.8}
                  wispIntensity={6.5}
                  flowSpeed={0.85}
                  flowStrength={0.18}
                  fogIntensity={fogValue}
                  fogScale={0.11}
                  decay={2.8}
                  verticalSizing={2.1}
                  horizontalSizing={0.5}
                />
              </div>
            </div>

            {/* Handpiece */}
            <img src="/handpiece.png" alt="Manipolo laser" className="laser-handpiece" draggable="false" />

            {/* Beam mask — solo mobile, gestita da CSS */}
            <div className="laser-beam-mask" aria-hidden="true" />

            <div className="laser-content">
              <div className="laser-top">
                {/* Colonna sinistra: macchinario (desktop/tablet) */}
                <div className="laser-left">
                  <img src="/laser.png" alt="Macchinario laser" className="laser-machine" draggable="false" />
                </div>

                {/* Wrapper mobile */}
                <div className="laser-wrapper-mobile">
                  <div className="laser-body-mobile">
                    {/* Macchina — solo mobile */}
                    <div className="laser-machine-mobile">
                      <img src="/laser.png" alt="Macchinario laser" className="laser-machine" draggable="false" />
                    </div>

                    <div className="laser-copy">
                      <div className="laser-kicker">
                        <span className="laser-kicker-dot" aria-hidden="true" />
                        Laser • Estetica avanzata
                      </div>

                      <h2 className="laser-title">
                        Stanca di lamette e cerette <span className="laser-title--gold">ogni settimana?</span>
                      </h2>

                      <div className="laser-divider" aria-hidden="true" />

                      {/* Testo breve — solo mobile */}
                      <p className="laser-text-mobile">
                        Con <strong>HILED KUBE</strong> di <strong>HiTek Milano</strong> riduci progressivamente la ricrescita e ottieni una pelle più liscia.
                      </p>

                      {/* Testo lungo — tablet/desktop */}
                      <p className="laser-text">
                        Con il nuovo macchinario <strong>HILED KUBE</strong> di <strong>HiTek Milano</strong> riduci progressivamente la ricrescita e ottieni
                        una pelle più liscia.
                        <br />
                        <span className="laser-subtle">
                          Spesso si nota una differenza già dalle prime sedute (i risultati possono variare in base al tipo di pelle e pelo).
                        </span>
                      </p>

                      {/* Benefit pills — solo desktop */}
                      <div className="laser-benefits">
                        <span className="laser-benefit-pill">✦ Zero rasatura</span>
                        <span className="laser-benefit-pill">✦ Visibile già dalla 1ª seduta</span>
                        <span className="laser-benefit-pill">✦ HiTek Milano</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Strip CTA — visibile su tutti i viewport */}
            <div ref={stripRef} className="laser-strip">
              <Button className="laser-btn-gold" onClick={() => navigate(`/trattamenti/${LASER_SERVICE_UUID}`)}>
                Prenota la tua seduta
              </Button>
              <div className="laser-strip-meta">
                <span className="laser-info">
                  Per info rapide:{" "}
                  <a href="https://wa.me/393780921723" target="_blank" rel="noreferrer" className="laser-whatsapp">
                    WhatsApp
                  </a>
                </span>
                <span className="laser-pay">Pagamento con carta o PayPal</span>
              </div>
            </div>

            <div className="laser-overlay" aria-hidden="true" />
          </div>
        </MotionDiv>
      </Container>
    </section>
  );
}
