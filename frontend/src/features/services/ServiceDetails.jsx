import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Container, Row, Col, Badge, Spinner } from "react-bootstrap";
import { fetchServices, fetchServiceById } from "../../api/modules/services.api";
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
  // FIX-2: opzione selezionata dal cliente prima di aprire il modal
  const [selectedOption, setSelectedOption] = useState(null);
  // FIX-2: gruppo attivo nel selettore (caso laser con più zone)
  const [activeGroup, setActiveGroup] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const loadServices = async () => {
      try {
        // FIX-2: fetchServiceById garantisce il DTO completo con options[] popolato
        const [found, all, cats] = await Promise.all([
          fetchServiceById(serviceId),
          fetchServices(),
          fetchCategories(),
        ]);
        setService(found || null);
        setAllServices(all);
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

  // FIX-2: calcola gruppi distinti dalle opzioni attive
  const activeOptions = service?.options?.filter(o => o.active) ?? [];
  const optionGroups = useMemo(() => {
    const groups = [...new Set(activeOptions.map(o => o.optionGroup).filter(Boolean))];
    return groups; // es. ["Gambe", "Ascelle", "Viso"] oppure [] se nessun gruppo
  }, [activeOptions]);
  const hasGroups = optionGroups.length > 0;
  // Opzioni visibili: se ci sono gruppi mostra solo quelle del gruppo attivo
  const visibleOptions = hasGroups && activeGroup
    ? activeOptions.filter(o => o.optionGroup === activeGroup)
    : hasGroups
      ? [] // nessun gruppo ancora selezionato → non mostrare opzioni
      : activeOptions;
  const hasOptions = activeOptions.length > 0;
  // Prezzo dinamico: usa il prezzo dell'opzione selezionata se presente
  const displayPrice = selectedOption?.price ?? service?.price;

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
            {/* FIX-2: prezzo dinamico aggiornato in base all'opzione scelta */}
            <span className="detail-price">{displayPrice.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</span>
            <span className="detail-price-note">
              {selectedOption?.sessions > 1 ? `pacchetto ${selectedOption.sessions} sedute` : "prezzo per seduta"}
            </span>
          </div>

          {/* FIX-2: selettore opzioni — visibile solo se il servizio ha opzioni */}
          {hasOptions && (
            <div className="so-selector">
              {/* Pill gruppi (caso laser: zone corpo) */}
              {hasGroups && (
                <div className="so-groups">
                  <span className="so-label">Seleziona zona:</span>
                  <div className="so-group-pills">
                    {optionGroups.map(g => (
                      <button
                        key={g}
                        type="button"
                        className={`so-group-pill${activeGroup === g ? " so-group-pill--active" : ""}`}
                        onClick={() => {
                          setActiveGroup(g);
                          setSelectedOption(null);
                        }}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Lista opzioni */}
              {visibleOptions.length > 0 && (
                <div className="so-options">
                  <span className="so-label">{hasGroups ? "Seleziona pacchetto:" : "Seleziona opzione:"}</span>
                  <div className="so-option-list">
                    {visibleOptions.map(opt => (
                      <button
                        key={opt.optionId}
                        type="button"
                        className={`so-option-card${selectedOption?.optionId === opt.optionId ? " so-option-card--selected" : ""}`}
                        onClick={() => setSelectedOption(opt)}
                      >
                        <span className="so-option-name">{opt.name}</span>
                        <span className="so-option-price">
                          {opt.price.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
                        </span>
                        {opt.sessions > 1 && (
                          <span className="so-option-sessions">{opt.sessions} sedute</span>
                        )}
                        {opt.gender && (
                          <span className="so-option-gender">{opt.gender}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="detail-trust">
            <span className="detail-trust-pill">✓ Prenotazione gratuita</span>
            <span className="detail-trust-pill">✓ Nessun anticipo</span>
            <span className="detail-trust-pill">✓ Conferma immediata</span>
          </div>

          {/* FIX-2: bottone disabilitato finché non è scelta un'opzione (quando esistono) */}
          <button
            className="detail-cta-btn"
            onClick={() => setOpen(true)}
            disabled={hasOptions && selectedOption === null}
          >
            {hasOptions && selectedOption === null ? "Scegli un'opzione" : "Prenota ora"}
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

      {/* FIX-2: passa l'opzione scelta al modal */}
      <BookingModal
        show={open}
        onHide={() => setOpen(false)}
        service={service}
        initialOptionId={selectedOption?.optionId ?? null}
      />
    </Container>
  );
};

export default ServiceDetail;
