import { Container, Button } from "react-bootstrap";
import { motion, useReducedMotion, useScroll, useTransform, useMotionTemplate } from "framer-motion";
import { Link } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { animate, splitText, stagger } from "animejs";

const MotionDiv = motion.div;
const MotionH1 = motion.h1;
const MotionP = motion.p;
const MotionImg = motion.img;

export default function HeroSection({
  title = "LASER & PERMANENT MAKE-UP",
  subtitle = "Risultati visibili e sicuri, con protocolli professionali.",
  primaryCtaLabel = "Prenota",
  primaryCtaTo = "/trattamenti",
  secondaryCtaLabel = "Scopri promozioni",
  secondaryCtaTo = "/promozioni",
  imgAvif = "public/hero/hero.avif",
  imgWebp = "public/hero/hero.webp",
  imgJpg = "public/hero/hero.jpeg",
  imgAlt = "Beauty Room – trattamenti laser e permanent make-up",
}) {
  const reduce = useReducedMotion();
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0 });

  const heroRef = useRef(null);

  const titleRef = useRef(null);
  const subtitleRef = useRef(null);

  // Scroll locale sulla hero
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  const bgY = useTransform(scrollYProgress, [0, 1], [0, 170]);
  const bgScale = useTransform(scrollYProgress, [0, 1], [1.0, 1.05]);
  const bgX = reduce ? 0 : 0;

  const bgParallaxStyles = reduce ? {} : { y: bgY, scale: bgScale, x: bgX };
  const glassY = useTransform(scrollYProgress, [0, 1], [0, -50]);
  const glassParallaxStyles = reduce ? {} : { y: glassY };

  const heroFade = useTransform(scrollYProgress, [0, 0.65, 1], [1, 0.35, 0]);
  const heroBlur = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [0, 6]);
  const heroBlurFilter = useMotionTemplate`blur(${heroBlur}px)`;

  const textMotion = {
    hidden: { opacity: 0, y: reduce ? 0 : 14 },
    visible: (i = 0) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.55, delay: 0.12 * i, ease: [0.22, 0.61, 0.36, 1] },
    }),
  };

  const glassMotion = {
    hidden: { opacity: 0, y: reduce ? 0 : 30, scale: 0.96 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.8, ease: [0.25, 0.8, 0.25, 1] },
    },
  };

  const handleMouseMove = e => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const rotateX = ((y - rect.height / 2) / rect.height) * -8;
    const rotateY = ((x - rect.width / 2) / rect.width) * 8;
    setTilt({ rotateX, rotateY });
  };

  const resetTilt = () => setTilt({ rotateX: 0, rotateY: 0 });

  const hasAnimated = useRef(false);

  useEffect(() => {
    if (reduce) return;
    if (hasAnimated.current) return;
    hasAnimated.current = true;

    const titleSplit = splitText(titleRef.current, {
      chars: { wrap: "clip" },
    });

    const subtitleSplit = splitText(subtitleRef.current, {
      chars: { wrap: "clip" },
    });

    const chars = [...titleSplit.chars, ...subtitleSplit.chars];

    animate(chars, {
      y: [{ to: ["100%", "0%"] }],
      duration: 1300,
      ease: "out(4)",
      delay: stagger(35),
      loop: false,
    });
  }, [reduce]);

  return (
    <section ref={heroRef} className="hero-section position-relative">
      <picture>
        <source srcSet={imgAvif} type="image/avif" />
        <source srcSet={imgWebp} type="image/webp" />
        <MotionImg src={imgJpg} alt={imgAlt} className="hero-media" decoding="async" fetchPriority="high" style={bgParallaxStyles} />
      </picture>

      <div className="hero-overlay" aria-hidden="true" />

      <Container className="hero-inner">
        <MotionDiv
          className="hero-glass"
          variants={glassMotion}
          initial="hidden"
          animate="visible"
          style={{
            opacity: heroFade,
            filter: reduce ? "none" : heroBlurFilter,
            transformPerspective: 800,
            rotateX: tilt.rotateX,
            rotateY: tilt.rotateY,
            ...glassParallaxStyles,
          }}
          onMouseMove={handleMouseMove}
          onMouseLeave={resetTilt}
          whileHover={{
            scale: 1.02,
            transition: { duration: 0.5, ease: [0.22, 0.61, 0.36, 1] },
          }}
        >
          <MotionH1 ref={titleRef} className="hero-title" variants={textMotion} initial="hidden" animate="visible" custom={0}>
            {title}
          </MotionH1>

          <MotionP ref={subtitleRef} className="hero-subtitle" variants={textMotion} initial="hidden" animate="visible" custom={1}>
            {subtitle}
          </MotionP>

          <MotionDiv className="hero-cta-row" variants={textMotion} initial="hidden" animate="visible" custom={2}>
            <Button as={Link} to={primaryCtaTo} size="lg" variant="light" className="hero-cta-primary">
              {primaryCtaLabel}
            </Button>

            <Button as={Link} to={secondaryCtaTo} size="lg" variant="outline-light" className="hero-cta-secondary">
              {secondaryCtaLabel}
            </Button>
          </MotionDiv>

          <MotionDiv className="hero-hint" variants={textMotion} initial="hidden" animate="visible" custom={3}>
            ★★★★★ 4.9/5 da recensioni reali
          </MotionDiv>
        </MotionDiv>
      </Container>
    </section>
  );
}
