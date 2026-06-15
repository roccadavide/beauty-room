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
import { addToCart, removeFromCart } from "../cart/slices/cart.slice";
import { useLike } from "../../hooks/useLike";
import LikePill from "../../components/common/LikePill";
import LikeBurst from "../../components/common/LikeBurst";
import BodyMap from "../../components/common/BodyMap";
import { regionsForOptions } from "./zoneRegions";

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

// Categories whose services drive the reactive silhouette + multi-select zone UI.
// Labels live in the DB (not in code), so we match tolerantly (case-insensitive,
// any "laser"/"cera"/"epilaz" wording) and additionally require that the zones
// actually resolve to body regions — so the silhouette never shows up empty and
// non-epilation services are never affected.
const EPILATION_LABEL_RE = /epilaz|laser|cera/i;

const stripGenderSuffix = name => (name || "").replace(/\s*[—–-]\s*(Donna|Uomo)\s*$/i, "");
const isGenderedOption = o => o?.gender === "FEMALE" || o?.gender === "MALE";
const euro = n => Number(n ?? 0).toLocaleString("it-IT", { style: "currency", currency: "EUR" });

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
  // OLD selector state (non-epilation optioned services: massage durations, ecc.)
  const [selectedOption, setSelectedOption] = useState(null);
  const [activeGroup, setActiveGroup] = useState(null);
  // NEW multi-select zone state (Epilazione laser / a cera)
  const [selectedZoneIds, setSelectedZoneIds] = useState(() => new Set());
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [openGroups, setOpenGroups] = useState(() => new Set());
  const [pkgOpen, setPkgOpen] = useState(false);
  // shared
  const [selectedGender, setSelectedGender] = useState("FEMALE");
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
  // (Deep-links carry no zone selection → initialOption stays null, books the base.)
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

  // Composite cart id per (service, option) so the same service can sit in the cart once per option
  // (e.g. multiple laser zones). Optional-chained: this runs at render time before the !service guard.
  const cartId = optId => `service-${service?.serviceId}-${optId ?? "base"}`;
  const cartHasOption = optId => cartItems.some(i => i.id === cartId(optId));

  // ── Is this the reactive zone selector path? (Epilazione laser / a cera) ──
  const categoryLabel = categoriesMap[service?.categoryId] || "";
  const isEpilationCat = EPILATION_LABEL_RE.test(categoryLabel);
  const isZoneService = isEpilationCat && zoneOptions.length > 0;
  const showBodyMap = isZoneService && regionsForOptions(zoneOptions).length > 0;

  // ── OLD selector derivations (non-epilation optioned services) — unchanged ──
  const zoneGroups = useMemo(() => {
    const all = [...new Set(zoneOptions.map(o => o.optionGroup).filter(Boolean))];
    if (!hasGenderOptions) return all;
    return all.filter(g => zoneOptions.some(o => o.optionGroup === g && (!o.gender || o.gender === selectedGender)));
  }, [zoneOptions, hasGenderOptions, selectedGender]);

  const hasZoneGroups = zoneGroups.length > 0;
  const hasZoneOptions = zoneOptions.length > 0 && !hasZoneGroups;
  const genderFilteredZoneOptions = hasGenderOptions ? zoneOptions.filter(o => !o.gender || o.gender === selectedGender) : zoneOptions;
  const visibleZoneOptions =
    hasZoneGroups && activeGroup ? genderFilteredZoneOptions.filter(o => o.optionGroup === activeGroup) : hasZoneGroups ? [] : genderFilteredZoneOptions;

  // ── Package browser (shared markup; selection differs per path) ──
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

  // ── NEW multi-select derivations (Epilazione laser / a cera) ──
  const selectedZoneOptions = zoneOptions.filter(o => selectedZoneIds.has(o.optionId));

  // In-cart zone lines for THIS service (cart line carries no gender → resolve via serviceOptionId).
  const cartZoneOptions = service
    ? cartItems
        .filter(i => i.type === "service" && i.serviceId === service.serviceId && i.serviceOptionId != null)
        .map(i => service.options?.find(o => o.optionId === i.serviceOptionId))
        .filter(Boolean)
    : [];

  // Gender lock: a gender context is set by a gender-specific zone in selection OR in the cart.
  // Unisex options never set it. The active tab is forced to the locked gender.
  const lockedGender = selectedZoneOptions.find(isGenderedOption)?.gender ?? cartZoneOptions.find(isGenderedOption)?.gender ?? null;
  const activeGender = lockedGender ?? selectedGender;

  const genderVisibleZones = hasGenderOptions ? zoneOptions.filter(o => !isGenderedOption(o) || o.gender === activeGender) : zoneOptions;

  const query = searchQuery.trim().toLowerCase();
  const matchesQuery = o => !query || stripGenderSuffix(o.name).toLowerCase().includes(query);

  const zoneGroupsData = (() => {
    const map = new Map();
    genderVisibleZones.forEach(o => {
      const key = o.optionGroup || "Zone";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(o);
    });
    return [...map.entries()].map(([name, opts]) => ({ name, opts, matched: opts.filter(matchesQuery) }));
  })();
  const visibleGroups = query ? zoneGroupsData.filter(g => g.matched.length > 0) : zoneGroupsData;

  const selCount = selectedZoneOptions.length;
  const selTotal = selectedZoneOptions.reduce((s, o) => s + (o.price || 0), 0);
  const selDuration = selectedZoneOptions.reduce((s, o) => s + (o.durationMin || 0), 0);

  const selectedRegions = regionsForOptions(selectedZoneOptions);
  const inCartRegions = regionsForOptions(cartZoneOptions);

  // ── Unified booking / display values (branch on the active selector) ──
  const bookingOption = isZoneService ? selectedPackage ?? (selCount === 1 ? selectedZoneOptions[0] : null) : selectedOption;

  const displayPrice = isZoneService
    ? selectedPackage
      ? selectedPackage.price
      : selCount > 0
        ? selTotal
        : service?.price
    : selectedOption?.price ?? service?.price;

  const displayDuration = (() => {
    if (isZoneService) {
      if (selectedPackage) return selectedPackage.durationMin ?? service?.durationMin;
      if (selCount > 0) return selDuration;
    } else if (selectedOption?.durationMin) {
      return selectedOption.durationMin;
    }
    if (activeOptions.length > 0) {
      const durs = activeOptions.map(o => o.durationMin).filter(Boolean);
      return durs.length > 0 ? Math.min(...durs) : service?.durationMin;
    }
    return service?.durationMin;
  })();

  const noNewSelection = selCount === 0 && !selectedPackage;
  const showDaPrefix = (isZoneService ? noNewSelection : !selectedOption) && activeOptions.length > 0;
  const durationPrefix = showDaPrefix ? "da " : "";
  const pricePrefix = showDaPrefix ? "da " : "";

  const priceNote = isZoneService
    ? selectedPackage?.sessions > 1
      ? `pacchetto ${selectedPackage.sessions} sedute`
      : selCount > 1
        ? `${selCount} zone selezionate`
        : selCount === 1
          ? "1 zona selezionata"
          : activeOptions.length > 0
            ? "seleziona una o più zone"
            : "prezzo per seduta"
    : selectedOption?.sessions > 1
      ? `pacchetto ${selectedOption.sessions} sedute`
      : activeOptions.length > 0 && !selectedOption
        ? "seleziona un'opzione"
        : "prezzo per seduta";

  const needsZoneSelection = isZoneService ? zoneOptions.length > 0 && !bookingOption : (hasZoneGroups || hasZoneOptions) && selectedOption === null;

  const isInCart = cartHasOption(bookingOption?.optionId);

  // ── Handlers ──
  const toggleZone = o => {
    if (cartHasOption(o.optionId)) return; // in-cart rows aren't re-selectable; use ✕ to remove
    setSelectedZoneIds(prev => {
      const next = new Set(prev);
      if (next.has(o.optionId)) next.delete(o.optionId);
      else next.add(o.optionId);
      return next;
    });
  };

  const switchGender = g => {
    if (lockedGender && g !== lockedGender) return; // opposite tab is disabled
    setSelectedGender(g);
    // Drop selected zones whose gender is set and ≠ the new gender (keep unisex).
    setSelectedZoneIds(prev => {
      const next = new Set();
      prev.forEach(id => {
        const o = zoneOptions.find(z => z.optionId === id);
        if (o && (!isGenderedOption(o) || o.gender === g)) next.add(id);
      });
      return next;
    });
  };

  // openGroups tracks which accordion groups are expanded — empty set = all start collapsed.
  const toggleGroup = name =>
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const clearSelection = () => {
    setSelectedZoneIds(new Set());
    setSelectedPackage(null);
  };

  const handleAddZonesToCart = () => {
    if (!service || selCount === 0) return;
    const hasPromotion = cartItems.some(i => i.type === "promotion");
    if (hasPromotion) {
      alert("Non puoi aggiungere trattamenti insieme a una promozione. Rimuovi la promozione dal carrello prima.");
      return;
    }
    // Defensive: never mix genders for this service in the cart.
    const cartGender = cartZoneOptions.find(isGenderedOption)?.gender ?? null;
    selectedZoneOptions.forEach(o => {
      if (cartGender && isGenderedOption(o) && o.gender !== cartGender) return;
      dispatch(
        addToCart({
          id: cartId(o.optionId),
          type: "service",
          name: service.title,
          price: o.price ?? 0,
          durationMinutes: o.durationMin ?? service.durationMin ?? 0,
          serviceId: service.serviceId,
          serviceOptionId: o.optionId,
          optionName: o.name ?? null,
          image: service.images?.[0] ?? null,
          quantity: 1,
        }),
      );
    });
    setSelectedZoneIds(new Set());
    setCartFeedback(true);
    setTimeout(() => setCartFeedback(false), 2500);
  };

  // OLD single-option add (non-epilation optioned services) — unchanged shape.
  const handleAddToCart = () => {
    if (!service) return;
    const hasPromotion = cartItems.some(i => i.type === "promotion");
    if (hasPromotion) {
      alert("Non puoi aggiungere trattamenti insieme a una promozione. Rimuovi la promozione dal carrello prima.");
      return;
    }
    dispatch(
      addToCart({
        id: cartId(selectedOption?.optionId),
        type: "service",
        name: service.title,
        price: displayPrice ?? 0,
        durationMinutes: displayDuration ?? service.durationMin ?? 0,
        serviceId: service.serviceId,
        // Fix 11: keep the chosen option's id so the cart can charge its price (not the base).
        serviceOptionId: selectedOption?.optionId ?? null,
        // Fix 16: option label for the cart line (Commit 3 renders it to distinguish same-service rows).
        optionName: selectedOption?.name ?? null,
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

  // Physical-pointer → side-drawer (unchanged). Virtual-keyboard device → push the
  // booking surface as a route (no position:fixed, keyboard-safe). Books the single
  // resolved option (selected package, or the single selected zone / option).
  const openBooking = () => {
    if (isDesktop) {
      setOpen(true);
      return;
    }
    navigate(
      ...openBookingSurface({
        type: "service",
        service,
        initialOptionId: bookingOption?.optionId ?? null,
        initialOption: bookingOption,
      }),
    );
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

  // Package selection differs per path: NEW path uses selectedPackage, OLD uses selectedOption.
  const onSelectPackage = opt =>
    isZoneService
      ? setSelectedPackage(prev => (prev?.optionId === opt.optionId ? null : opt))
      : setSelectedOption(prev => (prev?.optionId === opt.optionId ? null : opt));

  const renderPackageSection = selectedId => (
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
        className={["so-pkg-list-wrap", hasMorePackages && "so-pkg-list-wrap--has-more", pkgExpanded && "so-pkg-list-wrap--expanded"].filter(Boolean).join(" ")}
      >
        <div className="so-pkg-list">
          {filteredPackages.map(opt => {
            const savings = calcSavings(opt);
            const isSelected = selectedId === opt.optionId;
            return (
              <button
                key={opt.optionId}
                type="button"
                className={`so-pkg-card${isSelected ? " so-pkg-card--selected" : ""}`}
                onClick={() => onSelectPackage(opt)}
              >
                <span className="so-pkg-sessions-badge">{opt.sessions} sedute</span>
                <span className="so-pkg-name">{opt.name}</span>
                <div className="so-pkg-price-block">
                  {savings && <span className="so-pkg-price-full">{euro(savings.fullPrice)}</span>}
                  <span className="so-pkg-price-actual">{euro(opt.price)}</span>
                </div>
                {savings && <span className="so-pkg-savings">Risparmi {euro(savings.saved)}</span>}
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

      {selectedId && filteredPackages.some(p => p.optionId === selectedId) && (
        <p className="so-pkg-note">Paghi ora la prima seduta · Le successive le fissi con me</p>
      )}
    </div>
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

            {/* Epilation: compact save heart sits next to the title; non-epilation keeps the plain title (wishlist stays in .sd-cta-stack). */}
            {isZoneService ? (
              <div className="sd-title-row">
                <h1 className="detail-title">{service.title}</h1>
                <WishlistHeart itemType="SERVICE" itemId={service.serviceId} variant="card" />
              </div>
            ) : (
              <h1 className="detail-title">{service.title}</h1>
            )}

            <ServiceLikesRow serviceId={service.serviceId} initialCount={service.likesCount ?? 0} />

            <div className="detail-accent-line" />

            <div className="detail-price-block">
              <span className="detail-price">
                {pricePrefix}
                {euro(displayPrice)}
              </span>
              <span className="detail-price-note">{priceNote}</span>
            </div>

            {/* Epilation: trust pills as a compact strip right under the price (reassurance at the decision point) */}
            {isZoneService && (
              <div className="detail-trust detail-trust--compact">
                <span className="detail-trust-pill">✓ Prenotazione gratuita</span>
                <span className="detail-trust-pill">✓ Pagamento sicuro</span>
                <span className="detail-trust-pill">✓ Conferma immediata</span>
                <span className="detail-trust-pill">✦ Spostamento facile — Scrivimi su WhatsApp</span>
              </div>
            )}

            {/* ── NEW: multi-select zone selector + reactive silhouette (laser / cera) ── */}
            {isZoneService && (
              <div className="zs-wrap">
                <div className={`zs-layout${showBodyMap ? " zs-layout--with-fig" : ""}`}>
                  <div className="zs-main">
                    {hasGenderOptions && (
                      <div className="zs-gender">
                        <div className="of-tab-bar-services">
                          <button
                            className={`of-tab${activeGender === "FEMALE" ? " of-tab--active" : ""}`}
                            disabled={lockedGender === "MALE"}
                            onClick={() => switchGender("FEMALE")}
                          >
                            Donna
                          </button>
                          <button
                            className={`of-tab${activeGender === "MALE" ? " of-tab--active" : ""}`}
                            disabled={lockedGender === "FEMALE"}
                            onClick={() => switchGender("MALE")}
                          >
                            Uomo
                          </button>
                        </div>
                        {lockedGender && (
                          <span className="zs-gender-note">
                            Hai zone {lockedGender === "FEMALE" ? "Donna" : "Uomo"} in selezione o nel carrello — svuota per cambiare genere
                          </span>
                        )}
                      </div>
                    )}

                    <div className="zs-search">
                      <span className="zs-search-ic" aria-hidden="true">
                        ⌕
                      </span>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Cerca una zona…"
                        aria-label="Cerca una zona"
                      />
                      {searchQuery && (
                        <button type="button" className="zs-search-clear" onClick={() => setSearchQuery("")} aria-label="Pulisci ricerca">
                          ✕
                        </button>
                      )}
                    </div>

                    <div className="zs-groups">
                      {visibleGroups.map(group => {
                        const isOpen = query ? true : openGroups.has(group.name);
                        const rows = query ? group.matched : group.opts;
                        const activeCount = group.opts.filter(o => selectedZoneIds.has(o.optionId) || cartHasOption(o.optionId)).length;
                        return (
                          <div key={group.name} className={`zs-group${isOpen ? " open" : ""}`}>
                            <button type="button" className="zs-group-head" onClick={() => !query && toggleGroup(group.name)}>
                              <span className="zs-group-name">{group.name}</span>
                              {activeCount > 0 && <span className="zs-group-active">{activeCount}</span>}
                              <span className="zs-group-count">{group.opts.length}</span>
                              <span className="zs-group-chev">▸</span>
                            </button>
                            <div className="zs-group-body">
                              {rows.map(o => {
                                const inCart = cartHasOption(o.optionId);
                                const selected = selectedZoneIds.has(o.optionId);
                                return (
                                  <div
                                    key={o.optionId}
                                    role="button"
                                    tabIndex={inCart ? -1 : 0}
                                    aria-pressed={selected}
                                    className={`zs-row${selected ? " zs-row--sel" : ""}${inCart ? " zs-row--cart" : ""}`}
                                    onClick={() => toggleZone(o)}
                                    onKeyDown={e => {
                                      if ((e.key === "Enter" || e.key === " ") && !inCart) {
                                        e.preventDefault();
                                        toggleZone(o);
                                      }
                                    }}
                                  >
                                    <span className="zs-check">{selected || inCart ? "✓" : ""}</span>
                                    <span className="zs-name">{stripGenderSuffix(o.name)}</span>
                                    {o.durationMin ? <span className="zs-dur">{o.durationMin} min</span> : null}
                                    <span className="zs-price">{euro(o.price)}</span>
                                    {inCart && <span className="zs-tag">Nel carrello</span>}
                                    {inCart && (
                                      <span
                                        role="button"
                                        tabIndex={0}
                                        className="zs-rm"
                                        aria-label="Rimuovi questa zona dal carrello"
                                        onClick={e => {
                                          e.stopPropagation();
                                          dispatch(removeFromCart(cartId(o.optionId)));
                                        }}
                                        onKeyDown={e => {
                                          if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            dispatch(removeFromCart(cartId(o.optionId)));
                                          }
                                        }}
                                      >
                                        ✕
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                      {query && visibleGroups.length === 0 && <div className="zs-empty">Nessuna zona trovata per “{searchQuery}”.</div>}
                    </div>

                    {selCount >= 3 && hasPackages && (
                      <div className="zs-hint">
                        <span aria-hidden="true">✦</span>
                        <span>
                          Hai scelto {selCount} zone — con un pacchetto multi-seduta risparmi sul singolo.{" "}
                          <button type="button" className="zs-hint-link" onClick={() => setPkgOpen(true)}>
                            Vedi i pacchetti
                          </button>
                        </span>
                      </div>
                    )}

                    {selCount > 1 && (
                      <p className="zs-multi-note">Per prenotare più zone aggiungile al carrello — la prenotazione singola vale per una sola zona.</p>
                    )}

                    {/* Floating island — renders only on selection (zones or a package); consolidates the cart + booking actions. */}
                    {(selCount > 0 || selectedPackage) && (
                      <div className="zs-island" role="region" aria-label="Riepilogo selezione">
                        <div className="zs-island-top">
                          <div className="zs-island-info">
                            <span className="zs-island-total">{euro(displayPrice)}</span>
                            <span className="zs-island-sub">
                              {selectedPackage
                                ? `Pacchetto ${selectedPackage.sessions} sedute · ≈ ${displayDuration} min`
                                : `${selCount} ${selCount === 1 ? "zona" : "zone"} · ≈ ${selDuration} min`}
                            </span>
                          </div>
                          <button type="button" className="zs-island-clear" onClick={clearSelection}>
                            Svuota selezione
                          </button>
                        </div>
                        <div className="zs-island-actions">
                          {selCount > 0 && (
                            <button type="button" className="zs-island-add" onClick={handleAddZonesToCart}>
                              {cartFeedback ? "Aggiunto ✓" : "Aggiungi al carrello"}
                            </button>
                          )}
                          {bookingOption && (
                            <button type="button" className="zs-island-book" onClick={openBooking}>
                              {bookingOption.sessions > 1 ? `Prenota · ${bookingOption.sessions} sedute` : "Prenota ora"}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Pacchetti — teaser collassato (sotto il selettore su desktop, sopra la silhouette su mobile) */}
                  {hasPackages && (
                    <div className="zs-pkg">
                      <button type="button" className={`zs-pkg-teaser${pkgOpen ? " open" : ""}`} onClick={() => setPkgOpen(o => !o)}>
                        <span className="zs-pkg-teaser-label">
                          Preferisci un pacchetto multi-seduta?
                          {selectedPackage && <span className="zs-pkg-teaser-tag">{selectedPackage.sessions} sedute selezionate</span>}
                        </span>
                        <span className="zs-pkg-teaser-chev">▸</span>
                      </button>
                      {pkgOpen && renderPackageSection(selectedPackage?.optionId ?? null)}
                    </div>
                  )}

                  {/* Silhouette reattiva — colonna destra sticky su desktop, in fondo alla selezione su mobile */}
                  {showBodyMap && (
                    <div className="zs-fig">
                      <BodyMap selectedRegions={selectedRegions} inCartRegions={inCartRegions} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── OLD selector (non-epilation optioned services) — lasciato invariato ── */}
            {!isZoneService && (hasZoneGroups || hasZoneOptions) && (
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
                      {visibleZoneOptions.map(opt => {
                        // Derived from cart state → the badge persists across zone/group/gender switches and reloads.
                        const optInCart = cartItems.some(i => i.id === cartId(opt.optionId));
                        return (
                          <button
                            key={opt.optionId}
                            type="button"
                            className={`so-option-card${selectedOption?.optionId === opt.optionId ? " so-option-card--selected" : ""}${optInCart ? " so-option-card--in-cart" : ""}`}
                            onClick={() => setSelectedOption(opt)}
                          >
                            <span className="so-option-name">{opt.name.replace(/\s*—\s*(Donna|Uomo)$/i, "")}</span>
                            <span className="so-option-price">{opt.price.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</span>
                            {opt.durationMin && <span className="so-option-dur">{opt.durationMin} min</span>}
                            {optInCart && (
                              <span className="so-option-incart">
                                <span className="so-option-incart-label">✓ Nel carrello</span>
                                {/* Separate element (not a nested <button>): removes only this option in place. */}
                                <span
                                  role="button"
                                  tabIndex={0}
                                  className="so-option-incart-remove"
                                  aria-label="Rimuovi questa opzione dal carrello"
                                  onClick={e => {
                                    e.stopPropagation();
                                    dispatch(removeFromCart(cartId(opt.optionId)));
                                  }}
                                  onKeyDown={e => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      dispatch(removeFromCart(cartId(opt.optionId)));
                                    }
                                  }}
                                >
                                  ✕
                                </span>
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── OLD package section (non-epilation) ── */}
            {!isZoneService && hasPackages && renderPackageSection(selectedOption?.optionId ?? null)}

            {!isZoneService && (hasZoneGroups || hasZoneOptions) && (
              <p className="so-pkg-note" style={{ marginBottom: "1rem" }}>
                Per prenotare più zone aggiungile al carrello — altrimenti prenota una sola zona.
              </p>
            )}

            {/* Non-epilation: trust pills keep their original position above the CTA stack (epilation shows them under the price). */}
            {!isZoneService && (
              <div className="detail-trust">
                <span className="detail-trust-pill">✓ Prenotazione gratuita</span>
                <span className="detail-trust-pill">✓ Pagamento sicuro</span>
                <span className="detail-trust-pill">✓ Conferma immediata</span>
                <span className="detail-trust-pill">✦ Spostamento facile — Scrivimi su WhatsApp</span>
              </div>
            )}

            {/* Non-epilation CTA stack — wishlist + prenota/carrello, unchanged. On the epilation path these live near the title and inside the island. */}
            {!isZoneService && (
            <div className="sd-cta-stack">
              <WishlistHeart itemType="SERVICE" itemId={service.serviceId} variant="detail" />
              <div className="pd-cta-row">
                <button className="detail-pay-btn" onClick={openBooking} disabled={needsZoneSelection}>
                  {needsZoneSelection
                    ? isZoneService && selCount > 1
                      ? "Più zone — usa il carrello"
                      : "Scegli una zona"
                    : bookingOption?.sessions > 1
                      ? `Prenota il pacchetto · ${bookingOption.sessions} sedute →`
                      : "Prenota ora →"}
                </button>
                {isZoneService
                  ? selCount === 1 &&
                    !selectedPackage && (
                      <button
                        className={`detail-cart-btn${isInCart ? " detail-cart-btn--added" : ""}${cartFeedback ? " detail-cart-btn--feedback" : ""}`}
                        onClick={handleAddZonesToCart}
                        disabled={isInCart}
                        title={isInCart ? "Già nel carrello" : "Aggiungi al carrello"}
                      >
                        {cartFeedback ? "Aggiunto ✓" : isInCart ? "Nel carrello ✓" : "+ Carrello"}
                      </button>
                    )
                  : !needsZoneSelection &&
                    !(selectedOption?.sessions > 1) && (
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
            )}

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
          initialOptionId={bookingOption?.optionId ?? null}
          initialOption={bookingOption}
          prefill={prefill}
        />
      </Container>
    </>
  );
};

export default ServiceDetail;
