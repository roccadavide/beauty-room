import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { Container } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import CategoryBadge from "../../components/common/CategoryBadge";
import ServiceDetailSkeleton from "./ServiceDetailSkeleton";
import { fetchServices, fetchServiceById } from "../../api/modules/services.api";
import { fetchCategories } from "../../api/modules/categories.api";
import BookingModal from "../bookings/BookingModal";
import openBookingSurface from "../bookings/openBookingSurface";
import useIsDesktop from "../../hooks/useIsDesktop";
import RelatedCarousel from "../../components/common/RelatedCarousel";
import ImageGallery from "../../components/common/ImageGallery";
import SEO from "../../components/common/SEO";
import WishlistHeart from "../../components/common/WishlistHeart";
import { addToCart } from "../cart/slices/cart.slice";
import { useLike } from "../../hooks/useLike";
import LikePill from "../../components/common/LikePill";
import LikeBurst from "../../components/common/LikeBurst";

function ServiceLikesRow({ serviceId, initialCount }) {
  const { count, liked, burst, triggerLike } = useLike("SERVICE", serviceId, initialCount);
  return (
    <div className="sd-likes-row">
      <LikeBurst active={burst} />
      <LikePill count={count} liked={liked} onClick={triggerLike} />
      {count > 0 && <span className="sd-likes-label">{count === 1 ? "persona ama questo trattamento" : "persone amano questo trattamento"}</span>}
    </div>
  );
}

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
  const [selectedGender, setSelectedGender] = useState("FEMALE");
  const [activeGroup, setActiveGroup] = useState(null);
  const [cartFeedback, setCartFeedback] = useState(false);
  const [pkgExpanded, setPkgExpanded] = useState(false);
  const [pkgGender, setPkgGender] = useState(null);
  const [pkgGroup, setPkgGroup] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const wasCancelled = searchParams.get("cancel") === "1";
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const cartItems = useSelector(state => state.cart?.items ?? []);
  const isDesktop = useIsDesktop();

  // Physical-pointer → side-drawer (unchanged). Virtual-keyboard device → push the
  // booking surface as a route (no position:fixed, keyboard-safe).
  const openBooking = () => {
    if (isDesktop) {
      setOpen(true);
      return;
    }
    navigate(
      ...openBookingSurface({
        type: "service",
        service,
        initialOptionId: selectedOption?.optionId ?? null,
        initialOption: selectedOption,
      }),
    );
  };

  useEffect(() => {
    if (!wasCancelled) return;
    const t = setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      next.delete("cancel");
      setSearchParams(next, { replace: true });
    }, 4000);
    return () => clearTimeout(t);
  }, [wasCancelled, searchParams, setSearchParams]);

  // Deep-link (e.g. from the waitlist): open booking prefilled. Desktop opens the
  // drawer as before; touch routes to /prenota once the service has loaded, with
  // `replace` so backing out of the booking doesn't re-trigger this and re-open it.
  useEffect(() => {
    if (!location.state?.openBooking || !location.state?.prefill) return;
    if (isDesktop) {
      setPrefill(location.state.prefill);
      setOpen(true);
      return;
    }
    if (!service) return;
    const [to, opts] = openBookingSurface({
      type: "service",
      service,
      initialOptionId: selectedOption?.optionId ?? null,
      initialOption: selectedOption,
      prefill: location.state.prefill,
    });
    navigate(to, { ...opts, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, isDesktop, service]);

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

  const related = useMemo(() => {
    if (!service || !allServices.length) return [];
    const sameCat = allServices.filter(s => s.categoryId === service.categoryId && s.serviceId !== service.serviceId);
    return sameCat.sort(() => 0.5 - Math.random()).slice(0, 3);
  }, [service, allServices]);

  const [relatedRef, relatedVisible] = useInView();

  const activeOptions = service?.options?.filter(o => o.active) ?? [];

  const zoneOptions = activeOptions.filter(o => !o.sessions || o.sessions === 1);
  const packageOptions = activeOptions.filter(o => o.sessions && o.sessions > 1);

  const hasGenderOptions = zoneOptions.some(o => o.gender !== null && o.gender !== undefined && o.gender !== "");

  const zoneGroups = useMemo(() => {
    const all = [...new Set(zoneOptions.map(o => o.optionGroup).filter(Boolean))];
    if (!hasGenderOptions) return all;
    return all.filter(g => zoneOptions.some(o => o.optionGroup === g && (!o.gender || o.gender === selectedGender)));
  }, [zoneOptions, hasGenderOptions, selectedGender]);

  const hasZoneGroups = zoneGroups.length > 0;
  const hasZoneOptions = zoneOptions.length > 0 && !hasZoneGroups;
  const genderFilteredZoneOptions = hasGenderOptions ? zoneOptions.filter(o => !o.gender || o.gender === selectedGender) : zoneOptions;
  const hasPackages = packageOptions.length > 0;

  const pkgHasFemale = packageOptions.some(o => o.gender === "FEMALE");
  const pkgHasMale = packageOptions.some(o => o.gender === "MALE");
  const showPkgGenderToggle = pkgHasFemale && pkgHasMale;
  const effectivePkgGender = showPkgGenderToggle ? (pkgGender ?? "FEMALE") : null;
  const pkgGroups = [
    ...new Set(
      packageOptions
        .filter(o => !effectivePkgGender || !o.gender || o.gender === effectivePkgGender)
        .map(o => o.optionGroup)
        .filter(Boolean),
    ),
  ];
  const hasPkgGroups = pkgGroups.length > 0;
  const effectivePkgGroup = pkgGroups.includes(pkgGroup) ? pkgGroup : null;
  const filteredPackages = packageOptions.filter(o => {
    if (effectivePkgGender && o.gender && o.gender !== effectivePkgGender) return false;
    if (effectivePkgGroup && o.optionGroup !== effectivePkgGroup) return false;
    return true;
  });
  const PKG_TEASER = 3;
  const hasMorePackages = filteredPackages.length > PKG_TEASER;

  const visibleZoneOptions =
    hasZoneGroups && activeGroup ? genderFilteredZoneOptions.filter(o => o.optionGroup === activeGroup) : hasZoneGroups ? [] : genderFilteredZoneOptions;

  const displayPrice = selectedOption?.price ?? service?.price;

  const displayDuration = (() => {
    if (selectedOption?.durationMin) return selectedOption.durationMin;
    if (activeOptions.length > 0) {
      const durs = activeOptions.map(o => o.durationMin).filter(Boolean);
      return durs.length > 0 ? Math.min(...durs) : service?.durationMin;
    }
    return service?.durationMin;
  })();

  const durationPrefix = !selectedOption && activeOptions.length > 0 ? "da " : "";
  const pricePrefix = !selectedOption && activeOptions.length > 0 ? "da " : "";

  const needsZoneSelection = (hasZoneGroups || hasZoneOptions) && selectedOption === null;

  const isInCart = cartItems.some(i => i.id === `service-${service?.serviceId}`);

  const handleAddToCart = () => {
    if (!service) return;
    const hasPromotion = cartItems.some(i => i.type === "promotion");
    if (hasPromotion) {
      alert("Non puoi aggiungere trattamenti insieme a una promozione. Rimuovi la promozione dal carrello prima.");
      return;
    }
    dispatch(
      addToCart({
        id: `service-${service.serviceId}`,
        type: "service",
        name: service.title,
        price: displayPrice ?? 0,
        durationMinutes: displayDuration ?? service.durationMin ?? 0,
        serviceId: service.serviceId,
        image: service.images?.[0] ?? null,
        quantity: 1,
      }),
    );
    setCartFeedback(true);
    setTimeout(() => setCartFeedback(false), 2500);
  };

  // collapse package list when filters change
  useEffect(() => {
    setPkgExpanded(false);
  }, [pkgGender, pkgGroup]);

  const calcSavings = opt => {
    if (!opt?.sessions || opt.sessions < 2 || !service?.price) return null;
    const fullPrice = service.price * opt.sessions;
    const saved = fullPrice - opt.price;
    return saved > 0 ? { fullPrice, saved } : null;
  };

  if (loading) return <ServiceDetailSkeleton />;

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
        jsonLd={
          service
            ? {
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
              }
            : undefined
        }
      />
      <Container fluid className="service-detail">
        {wasCancelled && (
          <div className="sd-cancel-banner">
            <span className="sd-cancel-banner__icon">↩</span>
            <span>Pagamento annullato — nessun addebito effettuato. Puoi riprovare quando vuoi.</span>
          </div>
        )}
        <div className="sd-layout-grid">
          <div className="sd-col-img">
            <ImageGallery images={service.images?.filter(Boolean) ?? []} alt={service.title} />
          </div>

          {/* ▸ INFO */}
          <div className="detail-info sd-col-info">
            <div className="detail-meta">
              <CategoryBadge label={categoriesMap[service.categoryId] || ""} className="detail-badge" />
              <span className="detail-duration">
                ⏱ {durationPrefix}
                {displayDuration} min
              </span>
            </div>

            <h1 className="detail-title">{service.title}</h1>

            <ServiceLikesRow serviceId={service.serviceId} initialCount={service.likesCount ?? 0} />

            <div className="detail-accent-line" />

            <div className="detail-price-block">
              <span className="detail-price">
                {pricePrefix}
                {displayPrice.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
              </span>
              <span className="detail-price-note">
                {selectedOption?.sessions > 1
                  ? `pacchetto ${selectedOption.sessions} sedute`
                  : activeOptions.length > 0 && !selectedOption
                    ? "seleziona un'opzione"
                    : "prezzo per seduta"}
              </span>
            </div>

            {/* ── Selettore ZONE ── */}
            {(hasZoneGroups || hasZoneOptions) && (
              <div className="so-selector">
                {hasGenderOptions && (
                  <>
                    <span className="so-label">Seleziona genere:</span>
                    <div className="of-tab-bar-services">
                      <button
                        className={`of-tab${selectedGender === "FEMALE" ? " of-tab--active" : ""}`}
                        onClick={() => {
                          setSelectedGender("FEMALE");
                          setSelectedOption(null);
                        }}
                      >
                        Donna
                      </button>
                      <button
                        className={`of-tab${selectedGender === "MALE" ? " of-tab--active" : ""}`}
                        onClick={() => {
                          setSelectedGender("MALE");
                          setSelectedOption(null);
                        }}
                      >
                        Uomo
                      </button>
                    </div>
                  </>
                )}
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
                            const closing = activeGroup === g;
                            setActiveGroup(closing ? null : g);
                            setSelectedOption(null);
                          }}
                        >
                          <span className="so-group-pill__chevron me-1">{activeGroup === g ? "↑" : "↓"}</span>
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
                          <span className="so-option-name">{opt.name.replace(/\s*—\s*(Donna|Uomo)$/i, "")}</span>
                          <span className="so-option-price">{opt.price.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</span>
                          {opt.durationMin && <span className="so-option-dur">{opt.durationMin} min</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Selettore PACCHETTI ── */}
            {hasPackages && (
              <div className="so-pkg-section">
                <div className="so-pkg-header">
                  <span className="so-pkg-eyebrow">Pacchetti multi-seduta</span>
                  <span className="so-pkg-subtitle">Prenota più sedute e risparmia rispetto al prezzo singolo</span>
                </div>

                {showPkgGenderToggle && (
                  <div className="of-tab-bar-services so-pkg-gender-tabs">
                    <button className={`of-tab${(pkgGender ?? "FEMALE") === "FEMALE" ? " of-tab--active" : ""}`} onClick={() => setPkgGender("FEMALE")}>
                      Donna
                    </button>
                    <button className={`of-tab${(pkgGender ?? "FEMALE") === "MALE" ? " of-tab--active" : ""}`} onClick={() => setPkgGender("MALE")}>
                      Uomo
                    </button>
                  </div>
                )}

                {hasPkgGroups && (
                  <div className="so-pkg-filter-chips">
                    <button className={`so-pkg-chip${effectivePkgGroup === null ? " so-pkg-chip--active" : ""}`} onClick={() => setPkgGroup(null)}>
                      Tutti
                    </button>
                    {pkgGroups.map(g => (
                      <button key={g} className={`so-pkg-chip${effectivePkgGroup === g ? " so-pkg-chip--active" : ""}`} onClick={() => setPkgGroup(g)}>
                        {g}
                      </button>
                    ))}
                  </div>
                )}

                <div
                  className={["so-pkg-list-wrap", hasMorePackages && "so-pkg-list-wrap--has-more", pkgExpanded && "so-pkg-list-wrap--expanded"]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <div className="so-pkg-list">
                    {filteredPackages.map(opt => {
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
                </div>

                {hasMorePackages && (
                  <button className="so-pkg-expand-btn" onClick={() => setPkgExpanded(prev => !prev)}>
                    {pkgExpanded ? "Mostra meno ↑" : `Mostra tutti i pacchetti (${filteredPackages.length}) ↓`}
                  </button>
                )}

                {selectedOption?.sessions > 1 && <p className="so-pkg-note">Paghi ora la prima seduta · Le successive le fissi con me</p>}
              </div>
            )}

            {(hasZoneGroups || hasZoneOptions) && (
              <p className="so-pkg-note" style={{ marginBottom: "1rem" }}>
                Per prenotare più zone selezionale separatamente — ogni zona è una prenotazione indipendente.
              </p>
            )}

            <div className="detail-trust">
              <span className="detail-trust-pill">✓ Prenotazione gratuita</span>
              <span className="detail-trust-pill">✓ Pagamento sicuro</span>
              <span className="detail-trust-pill">✓ Conferma immediata</span>
              <span className="detail-trust-pill">✦ Spostamento facile — Scrivimi su WhatsApp</span>
            </div>

            <div className="sd-cta-stack">
              <WishlistHeart itemType="SERVICE" itemId={service.serviceId} variant="detail" />
              <div className="pd-cta-row">
                <button className="detail-pay-btn" onClick={openBooking} disabled={needsZoneSelection}>
                  {needsZoneSelection
                    ? "Scegli una zona"
                    : selectedOption?.sessions > 1
                      ? `Prenota il pacchetto · ${selectedOption.sessions} sedute →`
                      : "Prenota ora →"}
                </button>
                {!needsZoneSelection && !(selectedOption?.sessions > 1) && (
                  <button
                    className={`detail-cart-btn${isInCart ? " detail-cart-btn--added" : ""}${cartFeedback ? " detail-cart-btn--feedback" : ""}`}
                    onClick={handleAddToCart}
                    disabled={isInCart}
                    title={isInCart ? "Già nel carrello" : "Aggiungi al carrello"}
                  >
                    {cartFeedback ? "Aggiunto ✓" : isInCart ? "Nel carrello ✓" : "+ Carrello"}
                  </button>
                )}
              </div>
            </div>

            <div className="detail-divider" />

            <div className="detail-desc-label">
              <span className="detail-desc-label__line" />
              <span className="detail-desc-label__text">Descrizione</span>
            </div>
            <div className={`detail-description ${showFullDesc ? "expanded" : ""}`}>
              <p>{service.description}</p>
            </div>

            {service.description?.length > 200 && (
              <button className="detail-expand-btn" onClick={() => setShowFullDesc(!showFullDesc)}>
                {showFullDesc ? "Mostra meno ↑" : "Leggi tutto ↓"}
              </button>
            )}
          </div>
        </div>

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
          initialOption={selectedOption}
          prefill={prefill}
        />
      </Container>
    </>
  );
};

export default ServiceDetail;
