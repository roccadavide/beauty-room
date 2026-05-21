import LaserFlow from "./LaserFlow";
import { Button, Container } from "react-bootstrap";
import { motion, useReducedMotion, useScroll, useTransform, useMotionValueEvent } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const MotionDiv = motion.div;

// ID stabile in produzione — aggiornare solo se il record viene ricreato
const LASER_SERVICE_UUID = "ea41a8cd-bfec-49d3-bfa4-206c297ecd9d";

// Soglia mobile: sotto questa larghezza la card non usa transform Framer
// (i breakpoint mobile della LaserSection restano intatti).
const MOBILE_BP = 725;

// Progresso di scroll oltre il quale la card è "in posizione" → innesco fascio.
const BEAM_IGNITE_AT = 0.8;

const getFog = () => {
  if (typeof window === "undefined") return 2.1;
  if (window.innerWidth <= MOBILE_BP) return 0.05;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const ua = navigator.userAgent || "";
  const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua) && !/Chromium/.test(ua);
  return isSafari ? 2.1 / (dpr * 2.5) : 4.1 / dpr;
};

const getIsMobile = () => typeof window !== "undefined" && window.innerWidth <= MOBILE_BP;

export default function LaserSection() {
  const reduce = useReducedMotion();
  const sectionRef = useRef(null);
  const cardRef = useRef(null);
  const stripRef = useRef(null);
  const litRef = useRef(false);
  const navigate = useNavigate();

  const [fogValue, setFogValue] = useState(getFog);
  const [isMobile, setIsMobile] = useState(getIsMobile);
  // Innesco fascio: one-shot, parte spento. In reduced-motion è già acceso.
  const [beamLit, setBeamLit] = useState(false);

  // Un solo listener resize: aggiorna fog e flag mobile insieme.
  useEffect(() => {
    const handler = () => {
      setFogValue(getFog());
      setIsMobile(getIsMobile());
    };
    handler();
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // Reduced-motion: il fascio è acceso da subito, niente innesco animato.
  useEffect(() => {
    if (reduce) {
      litRef.current = true;
      setBeamLit(true);
    }
  }, [reduce]);

  /* ── Scroll della sezione — pilota l'ingresso "in scena" della card ──
     offset: progress 0 = bordo alto sezione al fondo viewport;
             progress 1 = bordo alto al 30% dell'altezza viewport. */
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "start 30%"],
  });

  // La card scura "sale a salutarti": risale, scala e proietta
  // un'ombra calda crescente verso l'alto.
  const cardY = useTransform(scrollYProgress, [0, 1], [110, 0]);
  const cardScale = useTransform(scrollYProgress, [0, 1], [0.93, 1]);
  const cardShadow = useTransform(scrollYProgress, [0.05, 0.85], ["0px 0px 0px 0px rgba(184, 151, 106, 0)", "0px -22px 60px -14px rgba(184, 151, 106, 0.4)"]);

  // Innesco fascio: ONE-SHOT quando la card raggiunge la posizione.
  // Slegato dallo scroll → l'accensione ha un suo ritmo e non si perde
  // nemmeno scrollando veloce. Vale anche su mobile.
  useMotionValueEvent(scrollYProgress, "change", v => {
    if (!litRef.current && v >= BEAM_IGNITE_AT) {
      litRef.current = true;
      setBeamLit(true);
    }
  });

  // Scena scroll attiva solo su desktop/tablet con animazioni consentite.
  const sceneActive = !reduce && !isMobile;
  const cardStyle = sceneActive ? { y: cardY, scale: cardScale, boxShadow: cardShadow } : {};

  // Entry animation del CONTENUTO INTERNO — osserva il wrapper.
  // (Movimento del wrapper = solo Framer; questo IO tocca solo i figli.)
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
        <MotionDiv ref={cardRef} className="laser-card-wrapper" style={cardStyle}>
          {/* Filo conduttore — filamento d'oro sul bordo della card,
              raccorda con .hero-thread; flare all'innesco del fascio */}
          <div className={`laser-card-thread${beamLit ? " laser-card-thread--lit" : ""}`} aria-hidden="true" />

          <div className="laser-card laser-card--dark">
            {/* WebGL beam — spento finché la card non è in scena (innesco one-shot) */}
            <div className={`laser-fx${beamLit ? " laser-fx--lit" : ""}`} aria-hidden="true">
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
