import { Fragment, useRef, useEffect, useState } from "react";
import { Container, Button } from "react-bootstrap";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Link } from "react-router-dom";
import { animate, splitText, stagger } from "animejs";

const MotionDiv = motion.div;
const MotionH1 = motion.h1;
const MotionP = motion.p;
const MotionImg = motion.img;

/* Parole chiave statiche — sostituiscono il vecchio marquee scorrevole. */
const KEYWORDS = ["Laser", "Permanent Make-Up", "Estetica Avanzata"];

/* ── Spinta su Michela — punto d'arrivo della "camera" ──────────────
   Mentre il contenuto crema sfuma, la foto fa pan + zoom per
   ri-centrare e avvicinare Michela. VALORI DA TARARE per breakpoint
   sulla foto reale (Sprint 2): scale = zoom finale, x/y = pan in px. */
const PUSH = {
  desktop: { scale: 1.3, x: -90, y: 22 },
  mobile: { scale: 1.22, x: -30, y: 14 },
};

const HERO_MOBILE_BP = 768;

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

const getIsMobile = () => typeof window !== "undefined" && window.innerWidth < HERO_MOBILE_BP;

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
  const sceneRef = useRef(null);
  const titleRef = useRef(null);
  const dustRef = useRef(null);
  const hasAnimated = useRef(false);

  /* ── Gate d'ingresso ──────────────────────────────────────────────
     Le animazioni d'INGRESSO partono solo quando lo splash è sparito.
     Aurora, polvere e shimmer NON sono gated: sono loop ambientali. */
  const [ready, setReady] = useState(appIsReady);
  const [isMobile, setIsMobile] = useState(getIsMobile);

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

  // Larghezza viewport → scelta dei valori di spinta + (CSS) lunghezza binario.
  useEffect(() => {
    const handler = () => setIsMobile(getIsMobile());
    handler();
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  /* ── Scroll della scena ───────────────────────────────────────────
     Il target è il BINARIO alto (.hero-scene), non la section: la hero
     resta pinnata e il progress 0→1 copre l'intero binario. */
  const { scrollYProgress } = useScroll({
    target: sceneRef,
    offset: ["start start", "end start"],
  });

  const push = isMobile ? PUSH.mobile : PUSH.desktop;

  // Spinta su Michela: pan + zoom convergente, conclusa entro il 46%.
  const photoScale = useTransform(scrollYProgress, [0, 0.46], [1, reduce ? 1 : push.scale]);
  const photoX = useTransform(scrollYProgress, [0, 0.46], [0, reduce ? 0 : push.x]);
  const photoY = useTransform(scrollYProgress, [0, 0.46], [0, reduce ? 0 : push.y]);
  // Velo scuro: luce di sera, non notte piena — Michela resta leggibile.
  const photoDarken = useTransform(scrollYProgress, [0.1, 0.46], [0, reduce ? 0 : 0.52]);
  // Contenuto crema: si solleva e sfuma presto, dentro la fase di pin.
  const contentOpacity = useTransform(scrollYProgress, [0, 0.28], [1, 0]);
  const contentY = useTransform(scrollYProgress, [0, 0.34], [0, reduce ? 0 : -80]);
  // Filo conduttore: l'ultimo residuo di luce dorata della hero.
  const threadOpacity = useTransform(scrollYProgress, [0.55, 0.92], [0, reduce ? 0 : 1]);

  const fadeUp = {
    hidden: { opacity: 0, y: reduce ? 0 : 20 },
    visible: (i = 0) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, delay: 0.09 * i, ease: [0.22, 0.61, 0.36, 1] },
    }),
  };

  // Titolo: solo opacità. Lo scorrimento dei caratteri lo fa anime.js.
  const titleReveal = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.4 } },
  };

  /* ── anime.js — split caratteri SOLO sul titolo, dopo il gate ────── */
  useEffect(() => {
    if (reduce || !ready || hasAnimated.current || !titleRef.current) return;
    hasAnimated.current = true;

    const titleSplit = splitText(titleRef.current, { chars: { wrap: "clip" } });

    animate(titleSplit.chars, {
      y: [{ to: ["100%", "0%"] }],
      opacity: [0, 1],
      duration: 2000,
      ease: "out(3)",
      delay: stagger(52),
    });
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

  return (
    <div ref={sceneRef} className="hero-scene">
      <div className="hero-sticky">
        <section className={`hero-section${ready ? " hero-ready" : ""}`}>
          {/* Foto di sfondo — Ken Burns sul frame, spinta (pan+zoom) sull'img */}
          <div className="hero-photo-frame">
            <picture>
              <source srcSet={imgAvif} type="image/avif" />
              <source srcSet={imgWebp} type="image/webp" />
              <MotionImg
                src={imgJpg}
                alt={imgAlt}
                className="hero-media"
                decoding="async"
                fetchPriority="high"
                style={reduce ? {} : { scale: photoScale, x: photoX, y: photoY }}
              />
            </picture>
          </div>

          {/* Vignettatura calda in alto */}
          <div className="hero-overlay" aria-hidden="true" />

          {/* Velo crema — mobile: sfuma dal basso · tablet+: pannello sinistro */}
          <div className="hero-gradient-veil" aria-hidden="true" />

          {/* Aurora — 7 luci di colore distinte sparse su tutta la zona crema */}
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

          {/* Shimmer del pannello — scia di luce dorata che lo attraversa */}
          <div className="hero-fx-layer hero-shimmer" aria-hidden="true" />

          {/* Sfumatura inferiore — chiude la hero su crema (tablet+) */}
          <div className="hero-base-fade" aria-hidden="true" />

          {/* Velo di scurimento — la hero "va a riposo" mentre la card sale */}
          <MotionDiv className="hero-photo-darken" aria-hidden="true" style={reduce ? {} : { opacity: photoDarken }} />

          {/* Filo conduttore — l'ultimo filo di luce dorata della hero */}
          <MotionDiv className="hero-thread" aria-hidden="true" style={reduce ? {} : { opacity: threadOpacity }} />

          {/* Contenuto */}
          <Container fluid className="hero-inner">
            <MotionDiv className="hero-text-panel" style={reduce ? {} : { opacity: contentOpacity, y: contentY }}>
              <MotionDiv className="hero-eyebrow" variants={fadeUp} initial="hidden" animate={animState} custom={0}>
                <span className="hero-eyebrow-mark" aria-hidden="true">
                  ✦
                </span>
                {eyebrow}
              </MotionDiv>

              <div className="hero-rule" aria-hidden="true" />

              {/* Titolo: h1 reale (split anime.js) + overlay sheen sopra */}
              <div className="hero-title-wrap">
                <MotionH1 ref={titleRef} className="hero-title" variants={titleReveal} initial="hidden" animate={animState}>
                  {titleLines.map((line, i) => (
                    <Fragment key={i}>
                      {i > 0 && <br />}
                      {line}
                    </Fragment>
                  ))}
                </MotionH1>
                <span className="hero-title-sheen" aria-hidden="true">
                  {titleLines.map((line, i) => (
                    <Fragment key={i}>
                      {i > 0 && <br />}
                      {line}
                    </Fragment>
                  ))}
                </span>
              </div>

              <MotionP className="hero-subtitle" variants={fadeUp} initial="hidden" animate={animState} custom={1}>
                {subtitle}
              </MotionP>

              <MotionDiv className="hero-cta-row" variants={fadeUp} initial="hidden" animate={animState} custom={2}>
                <Button as={Link} to={primaryCtaTo} className="hero-cta-primary" aria-label={`${primaryCtaLabel} — prenota un trattamento a Beauty Room`}>
                  {primaryCtaLabel}
                </Button>
                <Button as={Link} to={secondaryCtaTo} className="hero-cta-secondary" aria-label={secondaryCtaLabel}>
                  {secondaryCtaLabel}
                </Button>
              </MotionDiv>

              <MotionDiv className="hero-hint" variants={fadeUp} initial="hidden" animate={animState} custom={3}>
                {hint}
              </MotionDiv>

              {/* Keywords statiche — visibili tablet+ */}
              <MotionDiv className="hero-keywords" variants={fadeUp} initial="hidden" animate={animState} custom={4}>
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
            </MotionDiv>
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
