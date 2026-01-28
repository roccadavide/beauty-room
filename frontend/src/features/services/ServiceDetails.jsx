import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Container, Row, Col, Badge, Button, Image, Spinner } from "react-bootstrap";
import { fetchServices } from "../../api/modules/services.api";
import { fetchCategories } from "../../api/modules/categories.api";
import BookingModal from "../bookings/BookingModal";

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
      <Row className="justify-content-center align-items-start gap-5 g-5">
        {/* ▸ IMMAGINE */}
        <Col md={5} className="d-flex justify-content-center position-relative">
          <div ref={imgRef} className={`service-image-glass fade-slide ${imgVisible ? "visible" : ""}`}>
            <Image src={service.images?.[0]} alt={service.title} fluid rounded />
          </div>
        </Col>

        {/* ▸ INFO */}
        <Col md={6} lg={5} className="service-info fade-slide visible">
          <h1 className="service-title">{service.title}</h1>

          <div className="d-flex align-items-center gap-2 mb-3">
            <Badge bg={badgeColors[service.categoryId] || "secondary"} className="text-uppercase">
              {categoriesMap[service.categoryId] || "Senza categoria"}
            </Badge>
            <small className="text-muted">{service.durationMin} min</small>
          </div>

          <div className="service-price-wrap mb-3">
            <h3 className="service-price">{service.price.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</h3>

            <div className="scalapay-info" title="Paga in 3 rate con Scalapay">
              <img src="/scalapay.jpeg" alt="Scalapay" className="scalapay-logo" />
              <span>Pagamento a rate disponibile</span>
            </div>
          </div>

          <div className="trust-box mb-4">
            <p>✅ Prenotazione semplice e veloce</p>
            <p>✅ Nessun pagamento anticipato</p>
            <p>✅ Conferma immediata</p>
          </div>

          <Button variant="dark" className="rounded-pill px-4 mb-4" onClick={() => setOpen(true)}>
            Prenota ora
          </Button>

          <hr className="my-4" />

          {/* ▸ DESCRIZIONE */}
          <div className={`service-description ${showFullDesc ? "expanded" : ""}`}>
            <p>{service.description}</p>
          </div>

          {service.description?.length > 200 && (
            <Button variant="outline-dark" size="sm" className="rounded-pill mt-2" onClick={() => setShowFullDesc(!showFullDesc)}>
              {showFullDesc ? "Mostra meno" : "Mostra di più"}
            </Button>
          )}
        </Col>
      </Row>

      {/* ▸ SERVIZI SIMILI */}
      {related.length > 0 && (
        <section ref={relatedRef} className={`related-section mt-5 pt-5 fade-slide ${relatedVisible ? "visible" : ""}`}>
          <h3 className="text-center mb-4">Altri trattamenti simili</h3>
          <Row className="justify-content-center g-4">
            {related.map(s => (
              <Col key={s.serviceId} xs={10} sm={6} md={4} lg={3}>
                <div className="related-card text-center" onClick={() => navigate(`/trattamenti/${s.serviceId}`)}>
                  <div className="related-img-wrap mb-3">
                    <img src={s.images?.[0]} alt={s.title} className="img-fluid rounded-4" />
                  </div>
                  <h5>{s.title}</h5>
                  <p className="text-muted mb-0">{s.price.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</p>
                </div>
              </Col>
            ))}
          </Row>
        </section>
      )}

      <BookingModal show={open} onHide={() => setOpen(false)} service={service} />
    </Container>
  );
};

export default ServiceDetail;
