import { Button } from "react-bootstrap";
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
      { threshold: 0.65 }
    );

    observer.observe(boxRef.current);
    observer.observe(imgRef.current);

    return () => observer.disconnect();
  }, []);

  return (
    <section className="about-section">
      <div className="container about-container">
        <div ref={imgRef} className="about-img fade-element stagger-1">
          <img src="/negoziomichi.jpeg" alt="Negozio Michela" />
        </div>

        <div ref={boxRef} className="about-box fade-element stagger-2">
          <h2 className="stagger-2">Il Negozio di Michela</h2>
          <p className="stagger-3">
            Vieni a scoprire il mondo Beauty Room, dove estetica e benessere si incontrano. Michela ti guiderà con professionalità e passione verso il tuo
            percorso di bellezza e relax.
          </p>
          <Link to="/chisono">
            <Button variant="dark" className="rounded-pill px-4 py-2 stagger-4">
              Scopri di più
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
