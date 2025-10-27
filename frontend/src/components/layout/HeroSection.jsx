import { Container, Button } from "react-bootstrap";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";

export default function HeroSection({
  title = "Laser & Permanent Make-Up",
  subtitle = "Risultati visibili e sicuri, con protocolli professionali.",
  primaryCtaLabel = "Prenota",
  primaryCtaTo = "/trattamenti",
  secondaryCtaLabel = "Scopri promozioni",
  secondaryCtaTo = "/promozioni",
  // media
  imgAvif = "public/hero/hero.avif",
  imgWebp = "public/hero/hero.webp",
  imgJpg = "public/hero/hero.jpeg",
  imgAlt = "Beauty Room – trattamenti laser e permanent make-up",
}) {
  const reduce = useReducedMotion();

  const textMotion = {
    hidden: { opacity: 0, y: reduce ? 0 : 14 },
    visible: (i = 0) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.55, delay: 0.12 * i, ease: [0.22, 0.61, 0.36, 1] },
    }),
  };

  return (
    <section className="hero-section position-relative">
      {/* immagine LCP con picture AVIF/WebP + fallback */}
      <picture>
        <source srcSet={imgAvif} type="image/avif" />
        <source srcSet={imgWebp} type="image/webp" />
        <img src={imgJpg} alt={imgAlt} className="hero-media" decoding="async" fetchpriority="high" />
      </picture>

      {/* overlay per leggibilità */}
      <div className="hero-overlay" aria-hidden="true" />

      {/* contenuto */}
      <Container className="hero-inner">
        <motion.h1 className="hero-title" variants={textMotion} initial="hidden" animate="visible" custom={0}>
          {title}
        </motion.h1>

        <motion.p className="hero-subtitle" variants={textMotion} initial="hidden" animate="visible" custom={1}>
          {subtitle}
        </motion.p>

        <motion.div className="d-flex flex-wrap gap-3 mt-3" variants={textMotion} initial="hidden" animate="visible" custom={2}>
          <Button as={Link} to={primaryCtaTo} size="lg" variant="light" className="hero-cta-primary">
            {primaryCtaLabel}
          </Button>

          <Button as={Link} to={secondaryCtaTo} size="lg" variant="outline-light" className="hero-cta-secondary">
            {secondaryCtaLabel}
          </Button>
        </motion.div>

        {/* micro trust hint (opzionale, puoi togliere) */}
        <motion.div className="hero-hint mt-3" variants={textMotion} initial="hidden" animate="visible" custom={3}>
          ★★★★☆ 4.9/5 da recensioni reali
        </motion.div>
      </Container>
    </section>
  );
}
