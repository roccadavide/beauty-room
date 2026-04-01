import { useRef, useState, useEffect } from "react";
import { Row, Col } from "react-bootstrap";
import { useNavigate } from "react-router-dom";

const RelatedCarousel = ({ items, renderCard, getKey }) => {
  const scrollRef = useRef(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateArrows = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateArrows();
    el.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", updateArrows);
    };
  }, [items]);

  const scrollBy = dir => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.querySelector(".rc-card-wrap")?.offsetWidth || 240;
    el.scrollBy({ left: dir * (cardWidth + 16), behavior: "smooth" });
  };

  return (
    <>
      {/* DESKTOP: griglia normale Bootstrap */}
      <div className="d-none d-md-block">
        <Row className="justify-content-center g-4">
          {items.map(item => (
            <Col key={getKey(item)} md={4} lg={3}>
              {renderCard(item)}
            </Col>
          ))}
        </Row>
      </div>

      {/* MOBILE: carosello con frecce */}
      <div className="d-block d-md-none rc-wrapper">
        {canLeft && (
          <button className="rc-arrow rc-arrow--left" onClick={() => scrollBy(-1)} type="button">
            ‹
          </button>
        )}
        <div className="rc-track" ref={scrollRef}>
          {items.map(item => (
            <div key={getKey(item)} className="rc-card-wrap">
              {renderCard(item)}
            </div>
          ))}
        </div>
        {canRight && (
          <button className="rc-arrow rc-arrow--right" onClick={() => scrollBy(1)} type="button">
            ›
          </button>
        )}
      </div>
    </>
  );
};

export default RelatedCarousel;
