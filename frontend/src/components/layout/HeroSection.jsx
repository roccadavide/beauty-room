import { Fragment, useRef, useEffect, useLayoutEffect, useState } from "react";
import { Container, Button } from "react-bootstrap";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { animate, splitText, stagger } from "animejs";

const MotionDiv = motion.div;
const MotionP = motion.p;

/* Parole chiave statiche — sostituiscono il vecchio marquee scorrevole. */
const KEYWORDS = ["Laser", "Permanent Make-Up", "Estetica Avanzata"];

/* Gate "play-once-per-load" a livello di MODULO (non per-mount).
   L'intro del titolo va in scena al massimo una volta per caricamento di
   pagina. Su navigazione SPA il flag persiste tra unmount/remount → al
   rientro in Home il titolo è già nello stato finale, niente replay né
   lampo. Un refresh vero del browser azzera il modulo → l'intro rigioca
   una volta sola. NIENTE localStorage/sessionStorage: solo variabile di
   modulo, di proposito. */
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
  hint = "⭐ 4.9 · Oltre 200 clienti soddisfatte",
  primaryCtaLabel = "Prenota Ora",
  primaryCtaTo = "/trattamenti",
  secondaryCtaLabel = "Scopri i trattamenti",
  secondaryCtaTo = "/trattamenti",
  imgAvif = "/hero/hero.avif",
  imgWebp = "/hero/hero.webp",
  imgJpg = "/hero/hero.jpeg",
  imgAlt = "Michela — Beauty Room, centro estetico a Calusco d'Adda",
}) {
  const reduce = useReducedMotion();
  const titleRef = useRef(null);
  const titleWrapRef = useRef(null);
  const dustRef = useRef(null);

  /* ── Gate d'ingresso ──────────────────────────────────────────────
     Le animazioni d'INGRESSO partono solo quando lo splash è sparito.
     Aurora, polvere e shimmer NON sono gated: sono loop ambientali. */
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

  /* ── anime.js — split caratteri SOLO sul titolo, dopo il gate ──────
     useLayoutEffect (non useEffect): lo split è applicato PRIMA del paint,
     così non si vede mai il titolo intero che diventa split (niente reflow
     a scatto). Gira solo se l'intro non è ancora andato in scena in questo
     load (heroIntroPlayed). Il flag si setta SUBITO, appena le guardie
     passano (non a fine animazione): se navighi via a metà intro e torni,
     al rientro vedi il titolo finale senza replay. */
  useLayoutEffect(() => {
    if (reduce || !ready || heroIntroPlayed || !titleRef.current) return;
    heroIntroPlayed = true; // commit: l'intro va in scena ORA

    const titleEl = titleRef.current;
    const wrap = titleWrapRef.current;
    let cancelled = false;
    let titleSplit = null;
    let titleAnim = null;

    /* Pre-reveal: nascondi il wrap PRIMA del paint (modificatore via classe,
       aggiunto da JS solo ora che l'intro gioca). Così niente lampo del
       titolo intero né degli slot vuoti mentre si attende il font. */
    wrap?.classList.add("is-title-prereveal");

    const runSplit = () => {
      if (cancelled || !titleEl) return;

      titleSplit = splitText(titleEl, { chars: { wrap: "clip" } });

      titleAnim = animate(titleSplit.chars, {
        y: [{ to: ["100%", "0%"] }],
        opacity: [0, 1],
        duration: 2000,
        ease: "out(3)",
        delay: stagger(52),
      });

      /* Rivela sullo stesso frame in cui split+animazione partono: ora i
         caratteri sono già clippati a y:100% / opacity:0, quindi scoprire il
         wrap non mostra nulla "di troppo". */
      wrap?.classList.remove("is-title-prereveal");
    };

    /* Non misurare/splittare prima che il font del titolo (SaolDisplay-Light)
       sia pronto, altrimenti lo split misura la metrica sbagliata. Fail-safe:
       se document.fonts non esiste, splitta SUBITO (sincrono, prima del paint)
       → il titolo non resta mai bloccato invisibile. */
    if (document.fonts?.ready) {
      // 2° arg = handler di reject: se mai la promise non si risolvesse,
      // splittiamo comunque → il titolo non resta bloccato invisibile.
      document.fonts.ready.then(runSplit, runSplit);
    } else {
      runSplit();
    }

    return () => {
      cancelled = true;
      titleAnim?.revert(); // 1) annulla l'animazione e ripristina gli stili inline
      titleSplit?.revert(); // 2) ripristina il DOM originale (titolo non splittato)
      wrap?.classList.remove("is-title-prereveal"); // mai lasciare il titolo invisibile
    };
  }, [reduce, ready]);

  /* ── Polvere di luce (canvas) ─────────────────────────────────────
     Granelli d'oro che CADONO lenti dall'alto del pannello crema:
     compaiono in alto, scendono, si dissolvono in basso.
     Pausa automatica con tab nascosta o hero fuori viewport.
     Rispetta prefers-reduced-motion (un solo frame statico). */
  useEffect(() => {
    const canvas = dustRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let particles = [];
    let w = 0;
    let h = 0;
    let dpr = 1;
    let last = 0;
    let running = false;

    // initial=true → sparso su tutta l'altezza · false → rientra da sopra
    const spawn = initial => ({
      x: Math.random() * w,
      y: initial ? Math.random() * h : -10 - Math.random() * 50,
      r: 0.5 + Math.random() * 1.3,
      drift: 0.035 + Math.random() * 0.075, // caduta lenta verso il basso
      sway: 0.15 + Math.random() * 0.5,
      swaySpeed: 0.0004 + Math.random() * 0.0011,
      phase: Math.random() * Math.PI * 2,
      alpha: 0.28 + Math.random() * 0.42,
      twinkle: 0.0006 + Math.random() * 0.0013,
    });

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const pw = w;
      const ph = h;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (particles.length === 0) {
        const n = w < 600 ? 8 : w < 1000 ? 12 : 16;
        particles = Array.from({ length: n }, () => spawn(true));
      } else if (pw > 0 && ph > 0) {
        const sx = w / pw;
        const sy = h / ph;
        for (const p of particles) {
          p.x *= sx;
          p.y *= sy;
        }
      }
    };

    const draw = (t, dt) => {
      ctx.clearRect(0, 0, w, h);
      const fadeInZone = h * 0.12;
      const fadeOutZone = h * 0.2;
      for (const p of particles) {
        p.y += p.drift * dt;
        p.x += Math.sin(t * p.swaySpeed + p.phase) * p.sway * 0.04 * dt;
        if (p.y > h + 10) {
          p.y = -10 - Math.random() * 40;
          p.x = Math.random() * w;
        }
        // dissolve in alto (appena entrato) e in basso (prima di sparire)
        const fadeIn = Math.min(1, p.y / fadeInZone);
        const fadeOut = Math.min(1, (h - p.y) / fadeOutZone);
        const edge = Math.max(0, Math.min(fadeIn, fadeOut));
        const tw = 0.6 + 0.4 * Math.sin(t * p.twinkle + p.phase);
        const a = p.alpha * tw * edge;
        if (a <= 0.002) continue;
        const rad = p.r * 3.4;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
        // nucleo caldo luminoso + alone oro → legge come granello di luce, non punto scuro
        g.addColorStop(0, "rgba(255, 246, 224, " + a + ")");
        g.addColorStop(0.4, "rgba(216, 178, 116, " + a * 0.55 + ")");
        g.addColorStop(1, "rgba(216, 178, 116, 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const loop = t => {
      const dt = last ? Math.min((t - last) / 16.67, 3) : 1;
      last = t;
      draw(t, dt);
      raf = requestAnimationFrame(loop);
    };

    const start = () => {
      if (running) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(loop);
    };

    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    resize();

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ro = new ResizeObserver(() => {
      resize();
      if (reduced) draw(0, 1);
    });
    ro.observe(canvas);

    if (reduced) {
      draw(0, 1); // frame statico, niente loop
      return () => ro.disconnect();
    }

    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);

    const io = new IntersectionObserver(([entry]) => (entry.isIntersecting && !document.hidden ? start() : stop()), { threshold: 0 });
    io.observe(canvas);

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const titleLines = title.split("\n");
  const animState = ready ? "visible" : "hidden";

  const fadeUp = {
    hidden: { opacity: 0, y: reduce ? 0 : 20 },
    visible: (i = 0) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, delay: 0.09 * i, ease: [0.22, 0.61, 0.36, 1] },
    }),
  };

  /* initial degli elementi fadeUp: se l'intro è già stata giocata in questo
     load (remount SPA) → false = niente entrata, montano già visibili.
     Primo load → "hidden" = giocano una volta. Il titolo NON passa di qui:
     lo gestiscono anime.js + il pre-reveal del wrap. */
  const fadeInitial = heroIntroPlayed ? false : "hidden";

  return (
    <div className="hero-scene">
      <div className="hero-sticky">
        <section className={`hero-section${ready ? " hero-ready" : ""}`}>
          {/* Foto di sfondo — Ken Burns sul frame (CSS) */}
          <div className="hero-photo-frame">
            <picture>
              <source srcSet={imgAvif} type="image/avif" />
              <source srcSet={imgWebp} type="image/webp" />
              <img src={imgJpg} alt={imgAlt} className="hero-media" decoding="async" fetchPriority="high" />
            </picture>
          </div>

          {/* Vignettatura calda in alto */}
          <div className="hero-overlay" aria-hidden="true" />

          {/* Velo crema */}
          <div className="hero-gradient-veil" aria-hidden="true" />

          {/* Aurora */}
          <div className="hero-fx-layer hero-aurora" aria-hidden="true">
            <span className="hero-aurora-blob hero-aurora-blob--1" />
            <span className="hero-aurora-blob hero-aurora-blob--2" />
            <span className="hero-aurora-blob hero-aurora-blob--3" />
            <span className="hero-aurora-blob hero-aurora-blob--4" />
            <span className="hero-aurora-blob hero-aurora-blob--5" />
            <span className="hero-aurora-blob hero-aurora-blob--6" />
            <span className="hero-aurora-blob hero-aurora-blob--7" />
          </div>

          {/* Polvere di luce — granelli d'oro che cadono dall'alto (canvas) */}
          <canvas ref={dustRef} className="hero-fx-layer hero-dust" aria-hidden="true" />

          {/* Shimmer del pannello */}
          <div className="hero-fx-layer hero-shimmer" aria-hidden="true" />

          {/* Sfumatura inferiore */}
          <div className="hero-base-fade" aria-hidden="true" />

          {/* Faretto morbido — valorizza Michela al centro */}
          <div className="hero-spotlight" aria-hidden="true" />

          {/* Contenuto */}
          <Container fluid className="hero-inner">
            <div className="hero-text-panel">
              <MotionDiv className="hero-eyebrow" variants={fadeUp} initial={fadeInitial} animate={animState} custom={0}>
                <span className="hero-eyebrow-mark" aria-hidden="true">
                  ✦
                </span>
                {eyebrow}
              </MotionDiv>

              <div className="hero-rule" aria-hidden="true" />

              {/* Titolo: h1 reale (split anime.js) + overlay sheen sopra.
                  L'opacità del titolo NON è più pilotata da Framer: la possiede
                  anime.js (reveal dei caratteri) + il pre-reveal del wrap. */}
              <div className="hero-title-wrap" ref={titleWrapRef}>
                <h1 ref={titleRef} className="hero-title">
                  {titleLines.map((line, i) => (
                    <Fragment key={i}>
                      {i > 0 && <br />}
                      {line}
                    </Fragment>
                  ))}
                </h1>
                <span className="hero-title-sheen" aria-hidden="true">
                  {titleLines.map((line, i) => (
                    <Fragment key={i}>
                      {i > 0 && <br />}
                      {line}
                    </Fragment>
                  ))}
                </span>
              </div>

              <MotionP className="hero-subtitle" variants={fadeUp} initial={fadeInitial} animate={animState} custom={1}>
                {subtitle}
              </MotionP>

              <MotionDiv className="hero-cta-row" variants={fadeUp} initial={fadeInitial} animate={animState} custom={2}>
                <Button as={Link} to={primaryCtaTo} className="hero-cta-primary" aria-label={`${primaryCtaLabel} — prenota un trattamento a Beauty Room`}>
                  {primaryCtaLabel}
                </Button>
                <Button as={Link} to={secondaryCtaTo} className="hero-cta-secondary" aria-label={secondaryCtaLabel}>
                  {secondaryCtaLabel}
                </Button>
              </MotionDiv>

              <MotionDiv className="hero-hint" variants={fadeUp} initial={fadeInitial} animate={animState} custom={3}>
                {hint}
              </MotionDiv>

              {/* Keywords statiche — visibili tablet+ */}
              <MotionDiv className="hero-keywords" variants={fadeUp} initial={fadeInitial} animate={animState} custom={4}>
                {KEYWORDS.map((k, i) => (
                  <Fragment key={k}>
                    {i > 0 && (
                      <span className="hero-keywords-sep" aria-hidden="true">
                        ✦
                      </span>
                    )}
                    <span className="hero-keyword">{k}</span>
                  </Fragment>
                ))}
              </MotionDiv>
            </div>
          </Container>

          {/* Pill località — solo desktop */}
          <div className="hero-location-pill" aria-hidden="true">
            ✦ Calusco d'Adda · Bergamo
          </div>
        </section>
      </div>
    </div>
  );
}
