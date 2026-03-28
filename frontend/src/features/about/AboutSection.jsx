import { Link } from "react-router-dom";
import { useEffect, useRef } from "react";

const AboutSection = () => {
  const boxRef = useRef(null);
  const imgRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.25 },
    );

    if (boxRef.current) observer.observe(boxRef.current);
    if (imgRef.current) observer.observe(imgRef.current);

    return () => observer.disconnect();
  }, []);

  return (
    <section className="about-section">
      <div className="container about-container">
        <div ref={imgRef} className="about-img fade-element stagger-1">
          <img src="/negoziomichi.jpeg" alt="Beauty Room — il negozio di Michela" />
          <div className="about-img__shimmer" />
        </div>

        <div ref={boxRef} className="about-box fade-element stagger-2">
          {/* 
            about-box-border: wrapper con overflow:hidden che taglia
            il ::before rotante → effetto striscia oro sul bordo 
          */}
          <div className="about-box-border">
            <div className="about-box__inner">
              <span className="section-eyebrow">La mia storia</span>
              <h2 className="about-title">
                Il mio sogno,
                <br />
                la tua bellezza
              </h2>
              <div className="about-accent-line" />
              <p className="about-text">
                Beauty Room non è solo un centro estetico — è il posto dove la passione di Michela per il benessere diventa cura concreta per ogni persona che
                entra. Scopri chi c&apos;è dietro ogni trattamento.
              </p>
              <Link to="/chisono" className="about-cta-btn">
                Ascolta la mia storia →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
