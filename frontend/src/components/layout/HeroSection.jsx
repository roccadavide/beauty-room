import { Container, Button } from "react-bootstrap";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Link } from "react-router-dom";
import { useState, useRef } from "react";

const MotionDiv = motion.div;
const MotionH1 = motion.h1;
const MotionP = motion.p;
const MotionImg = motion.img;

export default function HeroSection({
  title = "Laser & Permanent Make-Up",
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

  // scroll locale sulla sezione hero
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"], // da quando l'hero entra finché esce
  });

  // parallax immagine (più evidente)
  const bgY = useTransform(scrollYProgress, [0, 1], [0, 140]); // prima era [0, 80]

  // leggero zoom dinamico per dare più profondità
  const bgScale = useTransform(scrollYProgress, [0, 1], [1.02, 1.1]);

  // parallax contenuto (movimento un filo più contenuto)
  const glassY = useTransform(scrollYProgress, [0, 1], [0, -50]); // prima -40

  const bgParallaxStyles = reduce ? {} : { y: bgY, scale: bgScale };
  const glassParallaxStyles = reduce ? {} : { y: glassY };

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

  return (
    <section ref={heroRef} className="hero-section position-relative">
      <picture>
        <source srcSet={imgAvif} type="image/avif" />
        <source srcSet={imgWebp} type="image/webp" />
        <MotionImg src={imgJpg} alt={imgAlt} className="hero-media" decoding="async" fetchpriority="high" style={bgParallaxStyles} />
      </picture>

      <div className="hero-overlay" aria-hidden="true" />

      <Container className="hero-inner">
        <MotionDiv
          className="hero-glass"
          variants={glassMotion}
          initial="hidden"
          animate="visible"
          style={{
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
          <MotionH1 className="hero-title" variants={textMotion} initial="hidden" animate="visible" custom={0}>
            {title}
          </MotionH1>

          <MotionP className="hero-subtitle" variants={textMotion} initial="hidden" animate="visible" custom={1}>
            {subtitle}
          </MotionP>

          <MotionDiv className="d-flex flex-wrap gap-3 mt-3" variants={textMotion} initial="hidden" animate="visible" custom={2}>
            <Button as={Link} to={primaryCtaTo} size="lg" variant="light" className="hero-cta-primary">
              {primaryCtaLabel}
            </Button>
            <Button as={Link} to={secondaryCtaTo} size="lg" variant="outline-light" className="hero-cta-secondary">
              {secondaryCtaLabel}
            </Button>
          </MotionDiv>

          <MotionDiv className="hero-hint mt-3" variants={textMotion} initial="hidden" animate="visible" custom={3}>
            ★★★★★ 4.9/5 da recensioni reali
          </MotionDiv>
        </MotionDiv>
      </Container>
    </section>
  );
}
