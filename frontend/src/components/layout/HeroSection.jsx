import { useRef, useEffect, useState } from "react";
import { Button } from "react-bootstrap";
import { motion, useReducedMotion, useScroll, useTransform, useMotionValueEvent } from "framer-motion";
import { Link } from "react-router-dom";

const MotionDiv = motion.div;
const MotionP = motion.p;
const MotionSpan = motion.span;

/* Ritaglio trasparente di Michela — un solo punto di verità per il path.
   <picture> serve AVIF→WebP→PNG; il layout regge anche se l'asset manca
   (l'img mostra l'alt, il resto della scena è indipendente). */
const MICHELA = {
  avif: "/hero/michela.avif",
  webp: "/hero/michela.webp",
  png: "/hero/michela.png",
};

const EASE = [0.22, 0.61, 0.36, 1];

/* Mappature scroll (riprese dall'anteprima hero-v1-preview-handoff.html).
   p = progress 0→1 della scena sticky. */
const clampN = (v, a, b) => Math.min(b, Math.max(a, v));
const mapRange = (v, a, b) => clampN((v - a) / (b - a), 0, 1);

/* Gate "play-once-per-load" a livello di MODULO (non per-mount).
   L'entrata della hero va in scena al massimo una volta per CARICAMENTO di
   pagina. Su navigazione SPA il flag persiste tra unmount/remount → al
   rientro in Home la hero è già nello stato finale: niente replay né lampo
   (la causa del vecchio glitch). Un refresh vero azzera il modulo → l'intro
   rigioca una volta sola. NIENTE storage: solo variabile di modulo. */
let heroIntroPlayed = false;

/* L'app è "visibile" quando lo splash-screen di index.html è sparito. */
function appIsReady() {
  if (typeof document === "undefined") return false;
  const root = document.getElementById("root");
  if (root && root.classList.contains("app-visible")) return true;
  const splash = document.getElementById("splash-screen");
  if (!splash) return true;
  if (splash.classList.contains("splash-hidden")) return true;
  return false;
}

export default function HeroSection({
  title = "La Bellezza\nÈ Un'Arte",
  subtitle = "Ogni trattamento, una cura su misura per te.",
  eyebrow = "Beauty Room · Calusco d'Adda",
  // hint = "⭐ 4.9 · Oltre 200 clienti soddisfatte", // social proof rimossa dalla hero (libera una riga per Michela) — ripristinabile, vedi stub nel JSX
  primaryCtaLabel = "Prenota Ora",
  primaryCtaTo = "/trattamenti",
  imgAlt = "Michela — Beauty Room, centro estetico a Calusco d'Adda",
}) {
  const reduce = useReducedMotion();
  const sceneRef = useRef(null);
  const stageRef = useRef(null);
  const coverRef = useRef(-1);

  /* ── Gate d'ingresso: l'entrata parte solo quando lo splash è sparito.
     Il respiro del glow e lo sheen del titolo NON sono gated (loop ambientali). */
  const [ready, setReady] = useState(appIsReady);

  useEffect(() => {
    if (ready) return;

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      clearTimeout(fallback);
      setReady(true);
    };

    const observer = new MutationObserver(() => {
      if (appIsReady()) finish();
    });

    const root = document.getElementById("root");
    const splash = document.getElementById("splash-screen");
    if (root) observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    if (splash) observer.observe(splash, { attributes: true, attributeFilter: ["class"] });
    observer.observe(document.body, { childList: true });

    const fallback = setTimeout(finish, 4000);

    return () => {
      observer.disconnect();
      clearTimeout(fallback);
    };
  }, [ready]);

  /* Commit del gate: appena l'app è pronta (e non reduced-motion) marchiamo
     l'intro come giocata. Se navighi via a metà e torni, al rientro si monta
     già nello stato finale (initial=false). */
  useEffect(() => {
    if (ready && !reduce) heroIntroPlayed = true;
  }, [ready, reduce]);

  /* ── Reveal allo scroll — useScroll sulla SCENA sticky, come LaserSection.
     Lenis fa scroll reale del documento → useScroll legge window.scrollY. */
  const { scrollYProgress } = useScroll({
    target: sceneRef,
    offset: ["start start", "end end"],
  });

  // Layer pilotati da transform/opacity (compositor, nessun re-render React).
  // Range DILATATI (reveal lento): il cover scuro completa ~quando la
  // LaserSection entra (overlap in _laser.css) → flusso continuo crema → buio
  // → card che emerge, senza tratto "tutto-buio" morto. Tarare con --cover.
  const creamScale = useTransform(scrollYProgress, [0, 1], [1, 0.965]);
  const glowOpacity = useTransform(scrollYProgress, [0.14, 0.55], [1, 0]);
  const michelaY = useTransform(scrollYProgress, [0.1, 0.58], [0, 150]);
  const michelaScale = useTransform(scrollYProgress, [0.1, 0.58], [1, 0.93]);
  const michelaOpacity = useTransform(scrollYProgress, [0.22, 0.56], [1, 0.05]);
  const contentOpacity = useTransform(scrollYProgress, [0.05, 0.4], [1, 0]);
  const contentY = useTransform(scrollYProgress, [0.05, 0.4], [0, -34]);
  const hintOpacity = useTransform(scrollYProgress, [0, 0.07], [1, 0]);

  /* Il "fiore" scuro: clip-path ellisse che cresce dal basso. Pilotato da una
     CSS variable (--cover) aggiornata SOLO al cambio significativo (quantizzata
     a 0.5%) → niente re-render React per frame. Mirror del BEAM_LEN_STEP di
     LaserSection. La leading-edge oro legge la stessa var (+2%). */
  useMotionValueEvent(scrollYProgress, "change", p => {
    if (reduce) return;
    const cover = mapRange(p, 0.06, 0.88) * 146;
    const q = Math.round(cover / 0.5) * 0.5;
    if (q === coverRef.current) return;
    coverRef.current = q;
    stageRef.current?.style.setProperty("--cover", q + "%");
  });

  const titleLines = title.split("\n");
  const animState = ready ? "visible" : "hidden";
  // Remount SPA o reduced-motion → nessuna entrata: montano già finali.
  const fadeInitial = heroIntroPlayed || reduce ? false : "hidden";
  // I transform di scroll si applicano solo quando l'animazione è consentita.
  const scrub = !reduce;

  /* ── Varianti d'ingresso (Framer). Gating identico a fadeInitial/animState
     per ogni elemento → l'entrata gioca una sola volta per load. */
  const fadeUp = {
    hidden: { opacity: 0, y: reduce ? 0 : 18 },
    visible: (i = 0) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.7, delay: reduce ? 0 : 0.15 + 0.1 * i, ease: EASE },
    }),
  };
  const ruleVar = {
    hidden: { opacity: 0, scaleX: 0 },
    visible: { opacity: 1, scaleX: 1, transition: { duration: 0.7, delay: reduce ? 0 : 0.3, ease: EASE } },
  };
  // Titolo: ogni riga sale da un wrapper overflow:hidden (line-rise CSS-style,
  // niente splitText → niente font-race).
  const lineVar = {
    hidden: { y: reduce ? "0%" : "110%" },
    visible: (i = 0) => ({
      y: "0%",
      transition: { duration: 0.95, delay: reduce ? 0 : 0.4 + 0.12 * i, ease: EASE },
    }),
  };
  const glowEnter = {
    hidden: { opacity: 0, scale: reduce ? 1 : 0.92 },
    visible: { opacity: 1, scale: 1, transition: { duration: 1.5, delay: reduce ? 0 : 0.25, ease: EASE } },
  };
  const michelaEnter = {
    hidden: { opacity: 0, y: reduce ? 0 : 36, scale: reduce ? 1 : 0.96 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 1.4, delay: reduce ? 0 : 0.35, ease: EASE } },
  };

  return (
    <div className="hero-scene" ref={sceneRef}>
      <div className="hero-stage" ref={stageRef}>
        {/* z0 — fondo crema (si stringe appena allo scroll) */}
        <MotionDiv className="hero-cream" aria-hidden="true" style={scrub ? { scale: creamScale } : undefined} />

        {/* z1 — alone champagne: fade-scroll (out) › entrata › respiro (CSS) */}
        <MotionDiv className="hero-glow" aria-hidden="true" style={scrub ? { opacity: glowOpacity } : undefined}>
          <MotionDiv className="hero-glow-enter" variants={glowEnter} initial={fadeInitial} animate={animState}>
            <div className="hero-glow-breath" />
          </MotionDiv>
        </MotionDiv>

        {/* z2 — Michela: scroll (drift+fade) › entrata › <picture> */}
        <MotionDiv className="hero-michela" aria-hidden="true" style={scrub ? { y: michelaY, scale: michelaScale, opacity: michelaOpacity } : undefined}>
          <MotionDiv className="hero-michela-enter" variants={michelaEnter} initial={fadeInitial} animate={animState}>
            <picture>
              <source srcSet={MICHELA.avif} type="image/avif" />
              <source srcSet={MICHELA.webp} type="image/webp" />
              <img src={MICHELA.png} alt={imgAlt} className="hero-michela-img" width={1200} height={1600} decoding="async" fetchPriority="high" draggable="false" />
            </picture>
          </MotionDiv>
        </MotionDiv>

        {/* z3 — colonna testo centrata: scroll (fade+rise) › entrata per figlio */}
        <MotionDiv className="hero-content" style={scrub ? { opacity: contentOpacity, y: contentY } : undefined}>
          <div className="hero-content-col">
            <MotionDiv className="hero-eyebrow" variants={fadeUp} initial={fadeInitial} animate={animState} custom={0}>
              <span className="hero-eyebrow-mark" aria-hidden="true">
                ✦
              </span>
              {eyebrow}
            </MotionDiv>

            <MotionDiv className="hero-rule" aria-hidden="true" variants={ruleVar} initial={fadeInitial} animate={animState} />

            <div className="hero-title-wrap">
              <h1 className="hero-title">
                {titleLines.map((line, i) => (
                  <span className="hero-title-line" key={i}>
                    <MotionSpan className="hero-title-line-inner" variants={lineVar} initial={fadeInitial} animate={animState} custom={i}>
                      {line}
                    </MotionSpan>
                  </span>
                ))}
              </h1>
              <span className="hero-title-sheen" aria-hidden="true">
                {titleLines.map((line, i) => (
                  <span className="hero-title-line" key={i}>
                    <span className="hero-title-line-inner">{line}</span>
                  </span>
                ))}
              </span>
            </div>

            <MotionP className="hero-subtitle" variants={fadeUp} initial={fadeInitial} animate={animState} custom={2.6}>
              {subtitle}
            </MotionP>

            {/* Una sola CTA per v1. Per riaggiungere una seconda CTA *distinta*
                (NON un altro link a /trattamenti) reinserire qui un secondo
                <Button> con classe .hero-cta-secondary. */}
            <MotionDiv className="hero-cta-row" variants={fadeUp} initial={fadeInitial} animate={animState} custom={3.4}>
              <Button as={Link} to={primaryCtaTo} className="hero-cta-primary" aria-label={`${primaryCtaLabel} — prenota un trattamento a Beauty Room`}>
                {primaryCtaLabel}
              </Button>
            </MotionDiv>

            {/* Social proof RIMOSSA dalla hero (libera una riga → Michela più grande).
                Ripristino: riattiva la prop `hint` sopra + questo blocco.
            <MotionDiv className="hero-hint" variants={fadeUp} initial={fadeInitial} animate={animState} custom={4.2}>
              {hint}
            </MotionDiv> */}
          </div>
        </MotionDiv>

        {/* indizio "scorri" — entrata (interno) e fade-scroll (esterno) su
            elementi distinti: non confliggono sull'opacity */}
        <MotionDiv className="hero-scrollhint" aria-hidden="true" style={scrub ? { opacity: hintOpacity } : undefined}>
          <MotionDiv className="hero-scrollhint-enter" variants={fadeUp} initial={fadeInitial} animate={animState} custom={5.5}>
            <span>scorri</span>
            <span className="hero-scrollhint-arrow" />
          </MotionDiv>
        </MotionDiv>

        {/* z4 — leading-edge oro › z5 — fiore scuro (clip-path da --cover) */}
        <div className="hero-bloom-edge" aria-hidden="true" />
        <div className="hero-bloom" aria-hidden="true" />
      </div>
    </div>
  );
}
