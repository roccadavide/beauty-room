import { Container, Row, Col, Card } from "react-bootstrap";
import { useEffect, useRef, useState } from "react";

const AcademySection = () => {
  const cardsRef = useRef([]);
  const [visible, setVisible] = useState({});

  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setVisible(prev => ({ ...prev, [entry.target.dataset.id]: true }));
          }
        });
      },
      { threshold: 0.2 }
    );

    const targets = [...cardsRef.current].filter(Boolean);
    targets.forEach(el => obs.observe(el));

    return () => {
      targets.forEach(el => obs.unobserve(el));
      obs.disconnect();
    };
  }, []);

  const ACADEMIES = [
    {
      id: "a2",
      title: "PhiAcademy",
      img: "/academy/phiaccademy.jpg",
      tag: "Trucco Permanente",
      desc: "Tecniche avanzate di trucco permanente.",
      link: "https://www.phi-academy.com/it-it",
    },
    {
      id: "a1",
      title: "My Beauty Academy",
      img: "/academy/logo-my.png",
      tag: "Trattamenti Viso & Corpo",
      desc: "Specializzazione in trattamenti viso e corpo.",
      link: "https://mybeautyacademy.it/",
    },
    {
      id: "a3",
      title: "Kalentin Training Academy",
      img: "/academy/kalentin.png",
      tag: "Estetica Professionale",
      desc: "Formazione completa in estetica professionale.",
      link: "https://kalentin.com/it/",
    },
  ];

  return (
    <Container fluid className="py-5 academy-root">
      <div className="ac-head">
        <span className="section-eyebrow">Formazione</span>
        <h2 className="section-title ac-section-title">Le mie Accademie</h2>
        <p className="section-subtitle">
          Una selezione di percorsi formativi che hanno arricchito le mie competenze professionali.
        </p>
      </div>

      <div className="ac-track-wrapper">
        <div className="ac-track" id="acTrack">
          {ACADEMIES.map((a, idx) => (
            <div key={a.id} className="ac-slide">
              <Card
                data-id={a.id}
                ref={el => (cardsRef.current[idx] = el)}
                className={`academy-card ${visible[a.id] ? "visible" : ""}`}
                onClick={() => window.open(a.link, "_blank")}
              >
                <div className="ac-logo-wrap">
                  <img src={a.img} alt={a.title} className="ac-logo-img" />
                </div>
                <div className="ac-body">
                  <span className="ac-tag">{a.tag}</span>
                  <h3 className="ac-title">{a.title}</h3>
                  <p className="ac-desc">{a.desc}</p>
                  <span className="ac-cta">Visita il sito →</span>
                </div>
              </Card>
            </div>
          ))}
        </div>

        <button
          className="ac-arrow ac-arrow--prev"
          aria-label="Precedente"
          onClick={() =>
            document.getElementById("acTrack")?.scrollBy({ left: -320, behavior: "smooth" })
          }
        >
          ‹
        </button>
        <button
          className="ac-arrow ac-arrow--next"
          aria-label="Successivo"
          onClick={() =>
            document.getElementById("acTrack")?.scrollBy({ left: 320, behavior: "smooth" })
          }
        >
          ›
        </button>
      </div>
    </Container>
  );
};

export default AcademySection;
