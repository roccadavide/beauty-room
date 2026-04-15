import { useEffect, useMemo, useRef, useState } from "react";
import { Col, Container, Row } from "react-bootstrap";
import OccasioniPageSkeleton from "./OccasioniPageSkeleton";
import { useSelector } from "react-redux";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { EditButton } from "../../components/common/AdminActionButtons";
import AdminAddButton from "../../components/common/AdminAddButton";
import AdminToggle from "../../components/common/AdminToggle";
import PromotionDrawer from "./PromotionDrawer";
import PackageDrawer from "./PackageDrawer";
import BookingModal from "../bookings/BookingModal";
import DeletePromotionModal from "../promotions/DeletePromotionModal";
import PromoCard from "./PromoCard";
import PromoDetailDrawer from "./PromoDetailDrawer";
import { BadgeFlags } from "../../components/common/BadgeFlag";
import { fetchPackages } from "../../api/modules/packages.api";
import { fetchPromotions, deletePromotion } from "../../api/modules/promotions.api";
import { fetchProducts } from "../../api/modules/products.api";
import { fetchServices } from "../../api/modules/services.api";
import SEO from "../../components/common/SEO";

// ── helpers ──────────────────────────────────────────────────────────────────

const getDiscountedPrice = (original, discountType, discountValue) => {
  if (!original || !discountType || !discountValue) return original;
  if (discountType === "PERCENTAGE")
    return original - (original * discountValue) / 100;
  if (discountType === "FIXED")
    return Math.max(0, original - discountValue);
  if (discountType === "PRICE_OVERRIDE")
    return Number(discountValue);
  return original;
};

const getTotalOriginalPrice = (promotion, products, services) => {
  const pSum = products.filter(p => promotion.productIds?.includes(p.productId)).reduce((s, p) => s + (p.price || 0), 0);
  const sSum = services.filter(s => promotion.serviceIds?.includes(s.serviceId)).reduce((s, sv) => s + (sv.price || 0), 0);
  return pSum + sSum;
};

// ═════════════════════════════════════════════════════════════════════════════

function OccasioniPage() {
  const navigate = useNavigate();
  const { user, accessToken } = useSelector(state => state.auth);
  const [activeTab, setActiveTab] = useState("promozioni");

  // Pacchetti
  const [packages, setPackages] = useState([]);
  const [pkgLoading, setPkgLoading] = useState(true);
  const [pkgError, setPkgError] = useState(null);

  // Promozioni
  const [allPromos, setAllPromos] = useState([]);
  const [products, setProducts] = useState([]);
  const [services, setServices] = useState([]);
  const [promoLoading, setPromoLoading] = useState(true);
  const [promoError, setPromoError] = useState(null);

  // Admin promo state
  const [openPromo, setOpenPromo] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState(null);
  const [deleteModal, setDeleteModal] = useState(false);
  const [selectedPromotion, setSelectedPromotion] = useState(null);
  const [drawerPromo, setDrawerPromo] = useState(null);
  const [bookingService,       setBookingService]       = useState(null);
  const [bookingPromoPrice,    setBookingPromoPrice]    = useState(null);
  const [bookingPromoId,       setBookingPromoId]       = useState(null);
  const [bookingPromoProducts, setBookingPromoProducts] = useState([]);
  const [openBooking,          setOpenBooking]          = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const wasCancelled = searchParams.get("cancel") === "1";
  const cancelPromoId = searchParams.get("promo");
  const cancelTab = searchParams.get("tab");

  // Admin pacchetti state
  const [openPkg, setOpenPkg] = useState(false);
  const [editingPkg, setEditingPkg] = useState(null);
  const [allServices, setAllServices] = useState([]);

  // IntersectionObserver per promo cards
  const cardsRef = useRef([]);
  const [visibleMap, setVisibleMap] = useState({});

  // ── fetch ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchPackages();
        setPackages(data);
      } catch (err) {
        setPkgError(err.message || "Errore nel caricamento pacchetti");
      } finally {
        setPkgLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const [promos, prods, servs] = await Promise.all([fetchPromotions(), fetchProducts(), fetchServices()]);
        setAllPromos(Array.isArray(promos) ? promos : (promos.content ?? []));
        setProducts(Array.isArray(prods) ? prods : (prods.content ?? []));
        setServices(Array.isArray(servs) ? servs : (servs.content ?? []));
        setAllServices(Array.isArray(servs) ? servs : (servs.content ?? []));
      } catch (err) {
        setPromoError(err.message || "Errore nel caricamento promozioni");
      } finally {
        setPromoLoading(false);
      }
    };
    load();
  }, []);

  // ── computed ──────────────────────────────────────────────────────────────

  const grouped = useMemo(() => {
    return packages.reduce((acc, pkg) => {
      const key = pkg.serviceName;
      if (!acc[key]) acc[key] = { serviceId: pkg.serviceId, serviceImageUrl: pkg.serviceImageUrl, items: [] };
      acc[key].items.push(pkg);
      return acc;
    }, {});
  }, [packages]);

  const filteredPromos = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const base = user?.role === "ADMIN" ? allPromos : allPromos.filter(p => p.active && (!p.endDate || new Date(p.endDate) >= today));
    return base.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }, [allPromos, user]);

  // ── IntersectionObserver per promozioni ───────────────────────────────────

  useEffect(() => {
    const obs = new IntersectionObserver(
      entries =>
        entries.forEach(e => {
          if (e.isIntersecting) {
            setVisibleMap(prev => ({ ...prev, [e.target.dataset.id]: true }));
          }
        }),
      { threshold: 0.2 },
    );
    const targets = [...cardsRef.current].filter(Boolean);
    targets.forEach(el => obs.observe(el));

    const fallbackTimer = setTimeout(() => {
      const allVisible = {};
      filteredPromos.forEach(p => {
        allVisible[String(p.promotionId)] = true;
      });
      setVisibleMap(prev => ({ ...prev, ...allVisible }));
    }, 400);

    return () => {
      clearTimeout(fallbackTimer);
      targets.forEach(el => obs.unobserve(el));
      obs.disconnect();
    };
  }, [filteredPromos]);

  useEffect(() => {
    if (!cancelPromoId || allPromos.length === 0) return;
    if (cancelTab) setActiveTab(cancelTab);
    const promo = allPromos.find(p => String(p.promotionId) === cancelPromoId);
    if (promo) setDrawerPromo(promo);
  }, [cancelPromoId, cancelTab, allPromos]);

  useEffect(() => {
    if (!wasCancelled) return;
    const t = setTimeout(() => {
      setSearchParams(prev => {
        prev.delete("cancel");
        prev.delete("promo");
        prev.delete("tab");
        return prev;
      });
    }, 5000);
    return () => clearTimeout(t);
  }, [wasCancelled, setSearchParams]);

  // ── admin handlers ────────────────────────────────────────────────────────

  const handlePromoSaved = saved => {
    setAllPromos(prev => {
      const exists = prev.some(p => p.promotionId === saved.promotionId);
      return exists ? prev.map(p => (p.promotionId === saved.promotionId ? saved : p)) : [saved, ...prev];
    });
    setOpenPromo(false);
    setEditingPromotion(null);
  };

  const handlePkgSaved = saved => {
    setPackages(prev => {
      const exists = prev.some(p => p.optionId === saved.optionId);
      return exists ? prev.map(p => (p.optionId === saved.optionId ? saved : p)) : [...prev, saved];
    });
    setOpenPkg(false);
    setEditingPkg(null);
  };

  const handlePkgDeleted = optionId => {
    setPackages(prev => prev.filter(p => p.optionId !== optionId));
    setOpenPkg(false);
    setEditingPkg(null);
  };

  const handleDeleteConfirm = async id => {
    try {
      await deletePromotion(id, accessToken);
      setAllPromos(prev => prev.filter(p => p.promotionId !== id));
      setDeleteModal(false);
      setSelectedPromotion(null);
    } catch (err) {
      alert("Errore durante l'eliminazione: " + err.message);
    }
  };

  // ── render ────────────────────────────────────────────────────────────────

  const isLoading = pkgLoading || promoLoading;
  if (isLoading) return <OccasioniPageSkeleton />;

  return (
    <Container fluid className="py-4 px-3 px-md-4" style={{ background: "#fffdf8", minHeight: "80vh" }}>
      <SEO
        title="Occasioni"
        description="Promozioni e offerte speciali su trattamenti laser ed estetica avanzata a Calusco d'Adda."
      />
      {/* HEAD */}
      <div className="text-center mb-4">
        <span className="section-eyebrow">Convenienza</span>
        <h1 className="of-page-title">Occasioni</h1>
        <p className="section-subtitle">Pacchetti multi-seduta e promozioni attive per i nostri trattamenti.</p>
      </div>

      {/* TAB BAR */}
      <div className="of-tab-bar">
        <button className={`of-tab${activeTab === "promozioni" ? " of-tab--active" : ""}`} onClick={() => setActiveTab("promozioni")}>
          Promozioni
        </button>
        <button className={`of-tab${activeTab === "pacchetti" ? " of-tab--active" : ""}`} onClick={() => setActiveTab("pacchetti")}>
          Pacchetti
        </button>
      </div>

      {/* ── SEZIONE PACCHETTI ── */}
      {activeTab === "pacchetti" && (
        <Container>
          {user?.role === "ADMIN" && (
            <div className="mb-4 d-flex align-items-center justify-content-between flex-wrap gap-2">
              <p className="of-admin-note mb-0">Puoi anche gestire i pacchetti dalle opzioni del singolo trattamento</p>
              <AdminAddButton
                label="Nuovo pacchetto"
                onClick={() => {
                  setEditingPkg(null);
                  setOpenPkg(true);
                }}
              />
            </div>
          )}

          {pkgError && <p className="text-danger text-center">{pkgError}</p>}

          {!pkgLoading && !pkgError && Object.keys(grouped).length === 0 && <p className="of-empty">Nessun pacchetto disponibile al momento.</p>}

          {user?.role === "ADMIN" && (
            <PackageDrawer
              show={openPkg}
              onHide={() => {
                setOpenPkg(false);
                setEditingPkg(null);
              }}
              onSaved={handlePkgSaved}
              onDeleted={handlePkgDeleted}
              services={allServices}
              pkg={editingPkg}
            />
          )}

          {Object.entries(grouped).map(([serviceName, group]) => (
            <div key={serviceName} className="mb-5">
              <h2 className="of-service-group-title">{serviceName}</h2>
              <div className="of-pkg-grid">
                {group.items.map(pkg => (
                  <div key={pkg.optionId} className={`of-pkg-card${user?.role === "ADMIN" && !(pkg.active ?? true) ? " admin-entity--inactive" : ""}`} style={{ position: "relative" }}>
                    <BadgeFlags badges={pkg?.badges ?? []} />
                    <div className="of-pkg-sessions-badge">{pkg.sessions} sedute</div>
                    <div className="of-pkg-body">
                      <div className="of-pkg-accent" />
                      <p className="of-pkg-group">
                        {pkg.optionGroup || ""}
                        {pkg.gender ? ` · ${pkg.gender}` : ""}
                      </p>
                      <h3 className="of-pkg-name">{pkg.optionName}</h3>
                      <div className="of-pkg-price">
                        <span className="of-pkg-price-value">{Number(pkg.price).toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</span>
                        <span className="of-pkg-price-note">/ pacchetto</span>
                      </div>
                      <Link to={`/trattamenti/${pkg.serviceId}`} className="of-pkg-link">
                        Scopri il trattamento →
                      </Link>
                      {user?.role === "ADMIN" && (
                        <div className="of-pkg-admin-actions">
                          <div onClick={e => e.stopPropagation()}>
                            <AdminToggle
                              entityId={pkg.optionId}
                              isActive={pkg.active ?? true}
                              endpoint="/service-items/options"
                              onToggleSuccess={newVal =>
                                setPackages(prev => prev.map(p => p.optionId === pkg.optionId ? { ...p, active: newVal } : p))
                              }
                            />
                          </div>
                          <EditButton onClick={() => { setEditingPkg(pkg); setOpenPkg(true); }} />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </Container>
      )}

      {/* ── SEZIONE PROMOZIONI ── */}
      {activeTab === "promozioni" && (
        <Container>
          {user?.role === "ADMIN" && (
            <div className="mb-4 d-flex justify-content-end">
              <AdminAddButton
                label="Nuova promozione"
                onClick={() => {
                  setEditingPromotion(null);
                  setOpenPromo(true);
                }}
              />
            </div>
          )}

          {promoError && <p className="text-danger text-center">{promoError}</p>}

          {!promoLoading && !promoError && filteredPromos.length === 0 && <p className="of-empty">Nessuna promozione attiva al momento. Torna presto!</p>}

          <div className="promo-grid">
            {filteredPromos.map((p, idx) => {
              const totalOriginal = getTotalOriginalPrice(p, products, services);
              const totalDiscounted = totalOriginal ? getDiscountedPrice(totalOriginal, p.discountType, p.discountValue) : null;
              return (
                <div
                  key={p.promotionId}
                  data-id={String(p.promotionId)}
                  ref={el => (cardsRef.current[idx] = el)}
                  className={`pc-anim ${visibleMap[String(p.promotionId)] ? "pc-visible" : ""}`}
                >
                  <PromoCard
                    promo={p}
                    totalOriginal={totalOriginal}
                    totalDiscounted={totalDiscounted}
                    isAdmin={user?.role === "ADMIN"}
                    onEdit={promo => {
                      setEditingPromotion(promo);
                      setOpenPromo(true);
                    }}
                    onDelete={promo => {
                      setSelectedPromotion(promo);
                      setDeleteModal(true);
                    }}
                    onClick={promo => setDrawerPromo(promo)}
                    onToggle={(id, newVal) =>
                      setAllPromos(prev => prev.map(pr => pr.promotionId === id ? { ...pr, active: newVal } : pr))
                    }
                  />
                </div>
              );
            })}
          </div>

          {user?.role === "ADMIN" && (
            <>
              <PromotionDrawer
                show={openPromo}
                onHide={() => {
                  setOpenPromo(false);
                  setEditingPromotion(null);
                }}
                onSaved={handlePromoSaved}
                products={products}
                services={services}
                promotion={editingPromotion}
              />
              <DeletePromotionModal show={deleteModal} onHide={() => setDeleteModal(false)} promotion={selectedPromotion} onConfirm={handleDeleteConfirm} />
            </>
          )}
        </Container>
      )}

      <PromoDetailDrawer
        show={!!drawerPromo}
        onHide={() => setDrawerPromo(null)}
        promo={drawerPromo}
        products={products}
        services={services}
        showCancelBanner={wasCancelled && !!cancelPromoId}
        onBooking={(service, promoPrice, promotionId, promoProducts = []) => {
          setDrawerPromo(null);
          setBookingService(service);
          setBookingPromoPrice(promoPrice);
          setBookingPromoId(promotionId);
          setBookingPromoProducts(promoProducts);
          setOpenBooking(true);
        }}
      />

      <BookingModal
        show={openBooking}
        onHide={() => {
          setOpenBooking(false);
          setBookingService(null);
          setBookingPromoPrice(null);
          setBookingPromoId(null);
          setBookingPromoProducts([]);
        }}
        service={bookingService}
        promoPrice={bookingPromoPrice}
        promotionId={bookingPromoId}
        promoProducts={bookingPromoProducts}
      />
    </Container>
  );
}

export default OccasioniPage;
