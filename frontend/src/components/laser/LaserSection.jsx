import LaserFlow from "./LaserFlow";
import { Button, Container } from "react-bootstrap";
import { motion, useReducedMotion, useScroll, useTransform, useMotionValueEvent } from "framer-motion";
import { useRef, useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";

const MotionDiv = motion.div;

// ID stabile in produzione — aggiornare solo se il record viene ricreato
const LASER_SERVICE_UUID = "ea41a8cd-bfec-49d3-bfa4-206c297ecd9d";

// Soglia mobile: sotto questa larghezza la card non usa transform Framer
// (i breakpoint mobile della LaserSection restano intatti).
const MOBILE_BP = 725;

// Lunghezza verticale del fascio: cresce dal manipolo verso il basso man
// mano che la sezione entra. min = stub iniziale al manipolo · max = pieno.
// STEP = quantizzazione → limita i re-render di LaserFlow. TARARE su device.
const BEAM_LEN_MIN = 0.35;
const BEAM_LEN_MAX = 2.1;
const BEAM_LEN_STEP = 0.08;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

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
  const navigate = useNavigate();

  const [fogValue, setFogValue] = useState(getFog);
  const [isMobile, setIsMobile] = useState(getIsMobile);
  // Montaggio differito di LaserFlow: lo shader WebGL si compila a
  // pagina ferma (idle), NON al primo paint → niente scatto iniziale.
  const [showBeam, setShowBeam] = useState(false);
  // Lunghezza del fascio, pilotata dallo scroll (quantizzata).
  const [beamLen, setBeamLen] = useState(reduce ? BEAM_LEN_MAX : BEAM_LEN_MIN);

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

  // Montaggio differito: durante un momento di idle dopo il load
  // (fallback a timeout dove requestIdleCallback non esiste).
  useEffect(() => {
    let idleId;
    let timeoutId;
    const mount = () => setShowBeam(true);
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(mount, { timeout: 2500 });
    } else {
      timeoutId = setTimeout(mount, 1800);
    }
    return () => {
      if (idleId && window.cancelIdleCallback) window.cancelIdleCallback(idleId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  // Reduced-motion: fascio a piena lunghezza da subito.
  useEffect(() => {
    if (reduce) setBeamLen(BEAM_LEN_MAX);
  }, [reduce]);

  /* ── Scroll della scena.
     DESKTOP (≥726px) = SCENA PINNATA (mirror della hero): offset start start →
       end end → progress 0 = top sezione al top viewport (lo stage si pinna),
       progress 1 = bottom sezione al bottom viewport (lo stage si spinna).
     MOBILE (<726px) = sezione IN-FLOW e CORTA (più bassa del viewport): con
       start start/end end il range si invertirebbe → tengo l'offset storico
       start end / start 16% che pilota il reveal mentre la sezione sale.
     useMemo: array stabile, cambia solo al flip del breakpoint (no churn). */
  const scrollOffset = useMemo(() => (isMobile ? ["start end", "start 16%"] : ["start start", "end end"]), [isMobile]);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: scrollOffset,
  });

  // La card EMERGE dal buio IN POSIZIONE (centro viewport): sale di poco
  // (90px, non 200 → niente "scroll dal basso"), scala e si rivela in opacità.
  // Mirror del preview .laser-emerge (translateY 90→0, scale 0.86→1, opacity
  // 0→1). La centratura è del LAYOUT (Container flex assoluto), NON un transform
  // → Framer possiede liberamente y/scale/opacity (lezione Michela).
  const cardY = useTransform(scrollYProgress, [0.08, 0.45], [90, 0]);
  const cardScale = useTransform(scrollYProgress, [0.08, 0.45], [0.86, 1]);
  const cardOpacity = useTransform(scrollYProgress, [0.08, 0.4], [0, 1]);
  // Ombra morbida verso il BASSO: cresce con l'emersione e radica la card sulla
  // crema che rientra dietro. (fallback statico per reduced-motion in CSS.)
  const cardShadow = useTransform(scrollYProgress, [0.1, 0.6], ["0px 0px 0px 0px rgba(184, 151, 106, 0)", "0px 26px 60px -16px rgba(140, 109, 63, 0.4)"]);

  // La crema rientra DIETRO la card (z1 < container z2) → il buio dello stage
  // RECEDE (parità col preview). Inizia DOPO che la card si è assestata (0.45),
  // così la vedi prima EMERGERE dal buio, poi la crema entra dietro di lei.
  // KNOB coupled: overlap .laser-section margin-top + range emersione sopra.
  const creamReturn = useTransform(scrollYProgress, [0.45, 0.85], [0, 1]);

  // Fascio laser: la lunghezza cresce mentre la card EMERGE (range allineato a
  // cardY/scale: 0.08→0.5), poi resta pieno. Quantizzato per limitare i
  // re-render di LaserFlow.
  useMotionValueEvent(scrollYProgress, "change", v => {
    if (reduce) return;
    const t = clamp((v - 0.08) / (0.5 - 0.08), 0, 1);
    const raw = BEAM_LEN_MIN + t * (BEAM_LEN_MAX - BEAM_LEN_MIN);
    const q = Math.round(raw / BEAM_LEN_STEP) * BEAM_LEN_STEP;
    setBeamLen(prev => (Math.abs(prev - q) > 1e-4 ? q : prev));
  });

  // Scena scroll attiva solo su desktop/tablet con animazioni consentite.
  const sceneActive = !reduce && !isMobile;
  const cardStyle = sceneActive ? { y: cardY, scale: cardScale, opacity: cardOpacity, boxShadow: cardShadow } : {};

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
      {/* SCENA PINNATA (≥726px): lo stage sticky scuro (#2f2723) è il "buio" da
          cui la card emerge — continuo col fondo-buio di fine hero, nessun bordo.
          Su mobile (<726px) lo stage è display:contents → la card resta IN-FLOW
          (path mobile intatto). */}
      <div className="laser-stage">
        {/* Velo crema: rientra DIETRO la card (z-index 1 < container z-index 2)
            → il buio dello stage recede mentre scendi. Gate su !reduce (NON
            sceneActive) così il reveal gira anche su mobile: scrollYProgress è
            vivo a prescindere da isMobile. Una semplice opacity su un div pieno
            separato non ha transform/canvas/border-radius → niente fringing Safari
            come quello che gatava i transform della card. Port di .cream-return. */}
        <MotionDiv className="laser-cream-return" aria-hidden="true" style={!reduce ? { opacity: creamReturn } : undefined} />
        <Container className="d-flex justify-content-center align-items-center">
        <MotionDiv ref={cardRef} className="laser-card-wrapper" style={cardStyle}>
          <div className="laser-card laser-card--dark">
            {/* WebGL beam — montato in differita; la lunghezza cresce con lo scroll */}
            <div className="laser-fx" aria-hidden="true">
              <div className="laser-fx-inner">
                {showBeam && (
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
                    verticalSizing={beamLen}
                    horizontalSizing={0.5}
                  />
                )}
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
      </div>
    </section>
  );
}
