import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Container, Row, Col, Badge, Spinner } from "react-bootstrap";
import { fetchServices } from "../../api/modules/services.api";
import { fetchCategories } from "../../api/modules/categories.api";
import BookingModal from "../bookings/BookingModal";
import RelatedCarousel from "../../components/common/RelatedCarousel";

const useInView = (options = { threshold: 0.15 }) => {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisible(true);
    }, options);
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [options]);
  return [ref, visible];
};

const ServiceDetail = () => {
  const { serviceId } = useParams();
  const [service, setService] = useState(null);
  const [allServices, setAllServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [categories, setCategories] = useState([]);
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const loadServices = async () => {
      try {
        const all = await fetchServices();
        const found = all.find(s => s.serviceId === serviceId);
        setService(found || null);
        setAllServices(all);
        const cats = await fetchCategories();
        setCategories(cats);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadServices();
  }, [serviceId]);

  const categoriesMap = useMemo(() => {
    const map = {};
    categories.forEach(c => (map[c.categoryId] = c.label));
    return map;
  }, [categories]);

  const badgeColors = {
    "2ab17c92-da9c-4b18-a04a-549eaa643ad3": "primary", //Trucco permanente
    "b5915bb8-869c-46b3-a2cc-82114e8fdeb1": "success", //Piedi
    "95b6d339-a765-4569-9aee-08107d27516b": "warning", //Mani
    "7f1255a7-7c26-4bf6-972b-d285b5bc6c36": "info", //Corpo
    "ddd9e4af-8343-42ce-8f93-1b48e2d4537c": "danger", //Viso
  };

  const related = useMemo(() => {
    if (!service || !allServices.length) return [];
    const sameCat = allServices.filter(s => s.categoryId === service.categoryId && s.serviceId !== service.serviceId);
    return sameCat.sort(() => 0.5 - Math.random()).slice(0, 3);
  }, [service, allServices]);

  const [imgRef, imgVisible] = useInView();
  const [relatedRef, relatedVisible] = useInView();

  if (loading)
    return (
      <Container className="pt-5 text-center">
        <Spinner animation="border" />
      </Container>
    );

  if (error)
    return (
      <Container className="pt-5 text-center">
        <p>{error}</p>
      </Container>
    );

  if (!service)
    return (
      <Container className="pt-5 text-center">
        <p>Servizio non trovato.</p>
      </Container>
    );

  return (
    <Container fluid className="service-detail">
      <Row className="justify-content-center align-items-start gap-1 g-5">
        {/* ▸ IMMAGINE */}
        <Col md={5} lg={5} className="d-flex justify-content-center">
          <div ref={imgRef} className={`detail-img-hero fade-slide ${imgVisible ? "visible" : ""}`}>
            <img src={service.images?.[0]} alt={service.title} />
            <div className="detail-img-shimmer" />
          </div>
        </Col>

        {/* ▸ INFO */}
        <Col md={6} lg={5} className="detail-info fade-slide visible">
          <div className="detail-meta">
            <Badge bg={badgeColors[service.categoryId] || "secondary"} className="text-uppercase detail-badge">
              {categoriesMap[service.categoryId] || "Senza categoria"}
            </Badge>
            <span className="detail-duration">⏱ {service.durationMin} min</span>
          </div>

          <h1 className="detail-title">{service.title}</h1>

          <div className="detail-accent-line" />

          <div className="detail-price-block">
            <span className="detail-price">{service.price.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</span>
            <span className="detail-price-note">prezzo per seduta</span>
          </div>

          <div className="detail-trust">
            <span className="detail-trust-pill">✓ Prenotazione gratuita</span>
            <span className="detail-trust-pill">✓ Nessun anticipo</span>
            <span className="detail-trust-pill">✓ Conferma immediata</span>
          </div>

          <button className="detail-cta-btn" onClick={() => setOpen(true)}>
            Prenota ora
          </button>

          <div className="detail-divider" />

          <div className={`detail-description ${showFullDesc ? "expanded" : ""}`}>
            <p>{service.description}</p>
          </div>

          {service.description?.length > 200 && (
            <button className="detail-expand-btn" onClick={() => setShowFullDesc(!showFullDesc)}>
              {showFullDesc ? "Mostra meno ↑" : "Leggi tutto ↓"}
            </button>
          )}
        </Col>
      </Row>

      {/* ▸ SERVIZI SIMILI */}
      {related.length > 0 && (
        <section
          ref={relatedRef}
          className={`related-section mt-5 pt-5 fade-slide ${relatedVisible ? "visible" : ""}`}
        >
          <div className="related-head">
            <span className="section-eyebrow">Scopri anche</span>
            <h3 className="related-title">Trattamenti simili</h3>
          </div>
          <RelatedCarousel
            items={related}
            getKey={(s) => s.serviceId}
            renderCard={(s) => (
              <div
                className="related-card text-center"
                onClick={() => navigate(`/trattamenti/${s.serviceId}`)}
                style={{ cursor: "pointer" }}
              >
                <div className="related-img-wrap mb-3">
                  <img src={s.images?.[0]} alt={s.title} className="img-fluid rounded-4" />
                </div>
                <h5>{s.title}</h5>
                <p className="text-muted mb-0">
                  {s.price.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
                </p>
              </div>
            )}
          />
        </section>
      )}

      <BookingModal show={open} onHide={() => setOpen(false)} service={service} />
    </Container>
  );
};

export default ServiceDetail;
