import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { Container, Row, Col, Badge, Spinner } from "react-bootstrap";
import { fetchServices, fetchServiceById } from "../../api/modules/services.api";
import { fetchCategories } from "../../api/modules/categories.api";
import BookingModal from "../bookings/BookingModal";
import RelatedCarousel from "../../components/common/RelatedCarousel";
import ImageGallery from "../../components/common/ImageGallery";
import SEO from "../../components/common/SEO";

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
  const location = useLocation();
  const [service, setService] = useState(null);
  const [allServices, setAllServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [categories, setCategories] = useState([]);
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [open, setOpen] = useState(false);
  const [prefill, setPrefill] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [activeGroup, setActiveGroup] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const wasCancelled = searchParams.get("cancel") === "1";
  const navigate = useNavigate();

  useEffect(() => {
    if (!wasCancelled) return;
    const t = setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      next.delete("cancel");
      setSearchParams(next, { replace: true });
    }, 4000);
    return () => clearTimeout(t);
  }, [wasCancelled, searchParams, setSearchParams]);

  useEffect(() => {
    if (location.state?.openBooking && location.state?.prefill) {
      setPrefill(location.state.prefill);
      setOpen(true);
    }
  }, [location.state]);

  useEffect(() => {
    const loadServices = async () => {
      try {
        const [found, all, cats] = await Promise.all([fetchServiceById(serviceId), fetchServices(), fetchCategories()]);
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

  const categoryColorMap = useMemo(() => {
    const colors = ["primary", "success", "warning", "info", "danger", "secondary"];
    const map = {};
    categories.forEach((cat, i) => {
      map[cat.categoryId] = colors[i % colors.length];
    });
    return map;
  }, [categories]);

  const related = useMemo(() => {
    if (!service || !allServices.length) return [];
    const sameCat = allServices.filter(s => s.categoryId === service.categoryId && s.serviceId !== service.serviceId);
    return sameCat.sort(() => 0.5 - Math.random()).slice(0, 3);
  }, [service, allServices]);

  const [imgRef, imgVisible] = useInView();
  const [relatedRef, relatedVisible] = useInView();

  const activeOptions = service?.options?.filter(o => o.active) ?? [];

  const zoneOptions = activeOptions.filter(o => !o.sessions || o.sessions === 1);
  const packageOptions = activeOptions.filter(o => o.sessions && o.sessions > 1);

  const zoneGroups = useMemo(() => [...new Set(zoneOptions.map(o => o.optionGroup).filter(Boolean))], [zoneOptions]);

  const hasZoneGroups = zoneGroups.length > 0;
  const hasZoneOptions = zoneOptions.length > 0 && !hasZoneGroups;
  const hasPackages = packageOptions.length > 0;

  const visibleZoneOptions = hasZoneGroups && activeGroup ? zoneOptions.filter(o => o.optionGroup === activeGroup) : hasZoneGroups ? [] : zoneOptions;

  const displayPrice = selectedOption?.price ?? service?.price;

  const needsZoneSelection = (hasZoneGroups || hasZoneOptions) && selectedOption === null;

  const calcSavings = opt => {
    if (!opt?.sessions || opt.sessions < 2 || !service?.price) return null;
    const fullPrice = service.price * opt.sessions;
    const saved = fullPrice - opt.price;
    return saved > 0 ? { fullPrice, saved } : null;
  };

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
    <>
      <SEO
        title={service?.title}
        description={service?.description ? service.description.slice(0, 150) : undefined}
        image={service?.images?.[0]}
        jsonLd={service ? {
          "@context": "https://schema.org",
          "@type": "Service",
          name: service.title,
          description: service.description,
          provider: {
            "@type": "BeautySalon",
            name: "Beauty Room di Michela",
            url: "https://www.beauty-room.it",
          },
          url: `https://www.beauty-room.it/services/${service.serviceId}`,
        } : undefined}
      />
      <Container fluid="xxl" className="service-detail">
      {wasCancelled && (
        <div className="sd-cancel-banner">
          <span className="sd-cancel-banner__icon">↩</span>
          <span>Pagamento annullato — nessun addebito effettuato. Puoi riprovare quando vuoi.</span>
        </div>
      )}
      <Row className="justify-content-center align-items-start g-4 g-md-5">
        {/* ▸ IMMAGINE */}
        <Col md={5} lg={5} className="d-flex justify-content-center">
          <div ref={imgRef} className={`fade-slide ${imgVisible ? "visible" : ""}`}>
            <ImageGallery
              images={service.images?.filter(Boolean) ?? []}
              alt={service.title}
            />
          </div>
        </Col>

        {/* ▸ INFO */}
        <Col md={6} lg={5} className="detail-info fade-slide visible">
          <div className="detail-meta">
            <Badge bg={categoryColorMap[service.categoryId] || "secondary"} className="text-uppercase detail-badge">
              {categoriesMap[service.categoryId] || "Senza categoria"}
            </Badge>
            <span className="detail-duration">⏱ {service.durationMin} min</span>
          </div>

          <h1 className="detail-title">{service.title}</h1>

          <div className="detail-accent-line" />

          <div className="detail-price-block">
            <span className="detail-price">{displayPrice.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</span>
            <span className="detail-price-note">{selectedOption?.sessions > 1 ? `pacchetto ${selectedOption.sessions} sedute` : "prezzo per seduta"}</span>
          </div>

          {/* ── Selettore ZONE (seduta singola, varianti) ── */}
          {(hasZoneGroups || hasZoneOptions) && (
            <div className="so-selector">
              {hasZoneGroups && (
                <div className="so-groups">
                  <span className="so-label">Seleziona zona:</span>
                  <div className="so-group-pills">
                    {zoneGroups.map(g => (
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
              {visibleZoneOptions.length > 0 && (
                <div className="so-options">
                  <span className="so-label">Seleziona opzione:</span>
                  <div className="so-option-list">
                    {visibleZoneOptions.map(opt => (
                      <button
                        key={opt.optionId}
                        type="button"
                        className={`so-option-card${selectedOption?.optionId === opt.optionId ? " so-option-card--selected" : ""}`}
                        onClick={() => setSelectedOption(opt)}
                      >
                        <span className="so-option-name">{opt.name}</span>
                        <span className="so-option-price">{opt.price.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</span>
                        {opt.gender && <span className="so-option-gender">{opt.gender}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Selettore PACCHETTI (multi-seduta, opzionale) ── */}
          {hasPackages && (
            <div className="so-pkg-section">
              <div className="so-pkg-header">
                <span className="so-pkg-eyebrow">Pacchetti multi-seduta</span>
                <span className="so-pkg-subtitle">Prenota più sedute e risparmia rispetto al prezzo singolo</span>
              </div>
              <div className="so-pkg-list">
                {packageOptions.map(opt => {
                  const savings = calcSavings(opt);
                  const isSelected = selectedOption?.optionId === opt.optionId;
                  return (
                    <button
                      key={opt.optionId}
                      type="button"
                      className={`so-pkg-card${isSelected ? " so-pkg-card--selected" : ""}`}
                      onClick={() => setSelectedOption(prev => (prev?.optionId === opt.optionId ? null : opt))}
                    >
                      <span className="so-pkg-sessions-badge">{opt.sessions} sedute</span>
                      <span className="so-pkg-name">{opt.name}</span>
                      <div className="so-pkg-price-block">
                        {savings && (
                          <span className="so-pkg-price-full">{savings.fullPrice.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</span>
                        )}
                        <span className="so-pkg-price-actual">{opt.price.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</span>
                      </div>
                      {savings && (
                        <span className="so-pkg-savings">Risparmi {savings.saved.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</span>
                      )}
                      {opt.gender && <span className="so-pkg-gender">{opt.gender}</span>}
                      {isSelected && <span className="so-pkg-check">✓</span>}
                    </button>
                  );
                })}
              </div>

              {selectedOption?.sessions > 1 && <p className="so-pkg-note">Paghi ora la prima seduta · Le successive le fissi con me</p>}
            </div>
          )}

          <div className="detail-trust">
            <span className="detail-trust-pill">✓ Prenotazione gratuita</span>
            <span className="detail-trust-pill">✓ Nessun anticipo</span>
            <span className="detail-trust-pill">✓ Conferma immediata</span>
          </div>

          <div className="detail-cart-actions">
            <button className="detail-pay-btn" onClick={() => setOpen(true)} disabled={needsZoneSelection}>
              {needsZoneSelection
                ? "Scegli una zona"
                : selectedOption?.sessions > 1
                  ? `Prenota il pacchetto · ${selectedOption.sessions} sedute →`
                  : "Prenota ora →"}
            </button>
          </div>

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
        <section ref={relatedRef} className={`related-section mt-5 pt-5 fade-slide ${relatedVisible ? "visible" : ""}`}>
          <div className="related-head">
            <span className="section-eyebrow">Scopri anche</span>
            <h3 className="related-title">Trattamenti simili</h3>
          </div>
          <RelatedCarousel
            items={related}
            getKey={s => s.serviceId}
            renderCard={s => (
              <div className="related-card text-center" onClick={() => navigate(`/trattamenti/${s.serviceId}`)} style={{ cursor: "pointer" }}>
                <div className="related-img-wrap mb-3">
                  <img src={s.images?.[0]} alt={s.title} className="img-fluid rounded-4" />
                </div>
                <h5>{s.title}</h5>
                <p className="text-muted mb-0">{s.price.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</p>
              </div>
            )}
          />
        </section>
      )}

      <BookingModal
        show={open}
        onHide={() => {
          setOpen(false);
          setPrefill(null);
        }}
        service={service}
        initialOptionId={selectedOption?.optionId ?? null}
        prefill={prefill}
      />
      </Container>
    </>
  );
};

export default ServiceDetail;
