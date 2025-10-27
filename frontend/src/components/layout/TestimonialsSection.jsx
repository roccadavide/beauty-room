import { useEffect, useRef, useState } from "react";
import { Container, Row, Col, Card, Button } from "react-bootstrap";
import { StarFill, ChevronLeft, ChevronRight } from "react-bootstrap-icons";

const TestimonialsSection = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visibleMap, setVisibleMap] = useState({});
  const [cardsPerView, setCardsPerView] = useState(3);
  const [showArrows, setShowArrows] = useState(true);
  const [showSwipeHint, setShowSwipeHint] = useState(false);

  const sectionRef = useRef(null);
  const touchStartX = useRef(null);
  const cardRefs = useRef({});

  const TESTIMONIALS = [
    { id: 1, name: "Barbara Caivano", date: "23-08-2025", review: "Conosco Michela da un po’... Consiglio vivamente.", rating: 5 },
    { id: 2, name: "Roberta Barzan", date: "12-07-2025", review: "Trattamenti mirati... molto preparata!", rating: 5 },
    { id: 3, name: "Rosalinda Vecchi", date: "19-06-2025", review: "Cliente da tempo... negozio curato.", rating: 5 },
    { id: 4, name: "Antonella Pupillo", date: "24-07-2025", review: "Tutto perfetto... promozioni interessanti.", rating: 5 },
    { id: 5, name: "Marta Cattaneo", date: "01-08-2025", review: "Ambiente pulito... ormai cliente fissa!", rating: 5 },
    { id: 6, name: "Mara Gambirasio", date: "23-09-2025", review: "Molto professionale... tutto perfetto!", rating: 5 },
  ];

  // Layout responsive (card per view + frecce)
  useEffect(() => {
    const updateLayout = () => {
      const w = window.innerWidth;
      if (w < 680) {
        setCardsPerView(1);
        setShowArrows(false);
      } else if (w < 992) {
        setCardsPerView(2);
        setShowArrows(false);
      } else {
        setCardsPerView(3);
        setShowArrows(true);
      }
    };
    updateLayout();
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, []);

  // Mostra hint solo quando la sezione entra nel viewport
  useEffect(() => {
    const seenHint = localStorage.getItem("swipeHintSeen") === "true";
    if (seenHint) return;

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !seenHint) {
            setShowSwipeHint(true);
            localStorage.setItem("swipeHintSeen", "true");
            observer.unobserve(entry.target);

            setTimeout(() => setShowSwipeHint(false), 6000);
          }
        });
      },
      { threshold: 0.25 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);

    return () => observer.disconnect();
  }, []);

  const isAtStart = currentIndex === 0;
  const isAtEnd = currentIndex + cardsPerView >= TESTIMONIALS.length;
  const visibleTestimonials = TESTIMONIALS.slice(currentIndex, currentIndex + cardsPerView);

  const next = () => {
    if (!isAtEnd) setCurrentIndex(i => i + 1);
  };
  const prev = () => {
    if (!isAtStart) setCurrentIndex(i => i - 1);
  };

  // Fade-in per card
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            const id = e.target.getAttribute("data-id");
            setVisibleMap(prev => ({ ...prev, [id]: true }));
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.2 }
    );

    visibleTestimonials.forEach(t => {
      const el = cardRefs.current[t.id];
      if (el) obs.observe(el);
    });

    return () => obs.disconnect();
  }, [visibleTestimonials]);

  const setCardRef = (id, el) => {
    if (el) cardRefs.current[id] = el;
  };

  // Swipe mobile/tablet
  const handleTouchStart = e => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = e => {
    if (!touchStartX.current) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (delta > 50) prev();
    if (delta < -50) next();
    touchStartX.current = null;
  };

  return (
    <Container ref={sectionRef} fluid className="py-5 testimonials-root position-relative" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <h2 className="text-center mb-3 fw-bold">Cosa dicono i clienti</h2>
      <p className="text-center text-muted mb-5">Alcune testimonianze reali delle persone che hanno scelto Beauty Room.</p>

      <div className="d-flex justify-content-center align-items-center position-relative">
        {showArrows && !isAtStart && (
          <Button variant="light" className="carousel-btn left" onClick={prev}>
            <ChevronLeft size={28} />
          </Button>
        )}

        <Row className="g-4 justify-content-center" style={{ width: "90%" }}>
          {!showArrows && showSwipeHint && (
            <div className="swipe-hint-overlay">
              <div className="swipe-ghost" />
            </div>
          )}
          {visibleTestimonials.map(t => (
            <Col key={t.id} xs={12} sm={cardsPerView === 2 ? 6 : 12} md={cardsPerView === 3 ? 4 : 6} className="d-flex justify-content-center">
              <Card
                data-id={t.id}
                ref={el => setCardRef(t.id, el)}
                className={`testimonial-card shadow-sm border-0 rounded-4 p-3 ${visibleMap[t.id] ? "visible" : ""}`}
              >
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <Card.Title className="mt-3 mb-0 fw-semibold fs-5">{t.name}</Card.Title>
                    <Card.Subtitle className="text-muted fs-6">{t.date}</Card.Subtitle>
                  </div>
                  <img src="/google-logo.webp" alt="google-logo" style={{ width: "25px", height: "25px" }} />
                </div>

                <Card.Body className="ps-0 pt-2">
                  <div className="mb-2 text-warning d-flex pb-1">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <StarFill key={i} className="me-1" />
                    ))}
                  </div>
                  <Card.Text className="fst-italic text-muted text-start small">“{t.review}”</Card.Text>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>

        {showArrows && !isAtEnd && (
          <Button variant="light" className="carousel-btn right" onClick={next}>
            <ChevronRight size={28} />
          </Button>
        )}
      </div>

      <div className="text-center mt-5">
        <a
          href="https://www.google.com/search?hl=it&q=Beauty%20room%20Recensioni&rflfq=1&num=20&stick=H4sIAAAAAAAAAONgkxIxNLGwNDc2MrAwtTQDYhNLY0uDDYyMrxjFnFITS0sqFYry83MVglKTU_OKM_PzMhex4pAAAPVmQURNAAAA&rldimm=14897320859685949390&tbm=lcl&sa=X&ved=0CB0Q9fQKKABqFwoTCKDEsOHdvJADFQAAAAAdAAAAABAG&biw=1728&bih=878&dpr=2#lkt=LocalPoiReviews"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-dark rounded-pill px-4"
        >
          Vedi tutte le recensioni su Google →
        </a>
      </div>
    </Container>
  );
};

export default TestimonialsSection;
