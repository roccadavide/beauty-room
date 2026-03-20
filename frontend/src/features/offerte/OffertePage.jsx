import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Card, Col, Container, Row, Spinner } from "react-bootstrap";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { PencilFill, Plus, Trash2Fill } from "react-bootstrap-icons";
import PromotionDrawer from "./PromotionDrawer";
import PackageDrawer from "./PackageDrawer";
import DeletePromotionModal from "../promotions/DeletePromotionModal";
import { fetchPackages } from "../../api/modules/packages.api";
import { fetchPromotions, deletePromotion } from "../../api/modules/promotions.api";
import { fetchProducts } from "../../api/modules/products.api";
import { fetchServices } from "../../api/modules/services.api";

// ── helpers ──────────────────────────────────────────────────────────────────

const getDiscountedPrice = (original, discountType, discountValue) => {
  if (!original || !discountType || !discountValue) return original;
  if (discountType === "PERCENTAGE") return original - (original * discountValue) / 100;
  if (discountType === "FIXED") return original - discountValue;
  return original;
};

const getTotalOriginalPrice = (promotion, products, services) => {
  const pSum = products.filter(p => promotion.productIds?.includes(p.productId)).reduce((s, p) => s + (p.price || 0), 0);
  const sSum = services.filter(s => promotion.serviceIds?.includes(s.serviceId)).reduce((s, sv) => s + (sv.price || 0), 0);
  return pSum + sSum;
};

// ═════════════════════════════════════════════════════════════════════════════

function OffertePage() {
  const { user, accessToken } = useSelector(state => state.auth);
  const [activeTab, setActiveTab] = useState("pacchetti");

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

  // ── IntersectionObserver per promozioni ───────────────────────────────────

  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => e.isIntersecting && setVisibleMap(prev => ({ ...prev, [e.target.dataset.id]: true }))),
      { threshold: 0.2 },
    );
    const targets = [...cardsRef.current].filter(Boolean);
    targets.forEach(el => obs.observe(el));
    return () => {
      targets.forEach(el => obs.unobserve(el));
      obs.disconnect();
    };
  }, [allPromos]);

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
      return exists
        ? prev.map(p => (p.optionId === saved.optionId ? saved : p))
        : [...prev, saved];
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

  return (
    <Container fluid className="py-4 px-3 px-md-4" style={{ background: "#fffdf8", minHeight: "80vh" }}>
      {/* HEAD */}
      <div className="text-center mb-4">
        <span className="section-eyebrow">Convenienza</span>
        <h1 className="of-page-title">Offerte</h1>
        <p className="section-subtitle">Pacchetti multi-seduta e promozioni attive per i nostri trattamenti.</p>
      </div>

      {/* TAB BAR */}
      <div className="of-tab-bar">
        <button className={`of-tab${activeTab === "pacchetti" ? " of-tab--active" : ""}`} onClick={() => setActiveTab("pacchetti")}>
          Pacchetti
        </button>
        <button className={`of-tab${activeTab === "promozioni" ? " of-tab--active" : ""}`} onClick={() => setActiveTab("promozioni")}>
          Promozioni
        </button>
      </div>

      {/* ── SEZIONE PACCHETTI ── */}
      {activeTab === "pacchetti" && (
        <Container>
          {user?.role === "ADMIN" && (
            <div className="mb-4 d-flex align-items-center justify-content-between flex-wrap gap-2">
              <p className="of-admin-note mb-0">
                Puoi anche gestire i pacchetti dalle opzioni del singolo trattamento
              </p>
              <Button
                variant="success"
                className="d-flex align-items-center gap-2 rounded-pill px-3 shadow-sm"
                onClick={() => { setEditingPkg(null); setOpenPkg(true); }}
              >
                <Plus /> Nuovo pacchetto
              </Button>
            </div>
          )}

          {pkgLoading && (
            <div className="d-flex justify-content-center py-5">
              <Spinner animation="border" />
            </div>
          )}

          {pkgError && <p className="text-danger text-center">{pkgError}</p>}

          {!pkgLoading && !pkgError && Object.keys(grouped).length === 0 && <p className="of-empty">Nessun pacchetto disponibile al momento.</p>}

          {user?.role === "ADMIN" && (
            <PackageDrawer
              show={openPkg}
              onHide={() => { setOpenPkg(false); setEditingPkg(null); }}
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
                  <div key={pkg.optionId} className="of-pkg-card">
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
                          <Button
                            size="sm"
                            variant="outline-secondary"
                            className="rounded-circle"
                            onClick={() => { setEditingPkg(pkg); setOpenPkg(true); }}
                          >
                            <PencilFill />
                          </Button>
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
              <Button
                variant="success"
                className="d-flex align-items-center gap-2 shadow-sm rounded-pill px-3"
                onClick={() => {
                  setEditingPromotion(null);
                  setOpenPromo(true);
                }}
              >
                <Plus /> Nuova promozione
              </Button>
            </div>
          )}

          {promoLoading && (
            <div className="d-flex justify-content-center py-5">
              <Spinner animation="border" />
            </div>
          )}

          {promoError && <p className="text-danger text-center">{promoError}</p>}

          {!promoLoading && !promoError && filteredPromos.length === 0 && <p className="of-empty">Nessuna promozione attiva al momento. Torna presto!</p>}

          <Row className="g-4 justify-content-center">
            {filteredPromos.map((p, idx) => {
              const totalOriginal = getTotalOriginalPrice(p, products, services);
              const totalDiscounted = totalOriginal ? getDiscountedPrice(totalOriginal, p.discountType, p.discountValue) : null;
              const img = p.cardImageUrl || p.bannerImageUrl || "/assets/placeholder.jpg";
              const discount =
                p.discountType === "PERCENTAGE" ? `-${p.discountValue}%` : p.discountType === "FIXED" ? `-€${Number(p.discountValue).toFixed(2)}` : null;

              return (
                <Col key={p.promotionId} xs={12} sm={6} md={4} lg={3} className="d-flex justify-content-center">
                  <Card
                    data-id={p.promotionId}
                    ref={el => (cardsRef.current[idx] = el)}
                    className={`promo-card border-0 rounded-4 shadow-lg overflow-hidden position-relative ${visibleMap[p.promotionId] ? "visible" : ""}`}
                  >
                    <div className="promo-img-wrapper position-relative">
                      <Card.Img src={img} alt={p.title} className="promo-img" />
                      {discount && <div className="promo-badge">{discount}</div>}
                      {user?.role === "ADMIN" && !p.active && (
                        <Badge bg="secondary" className="position-absolute top-0 start-0 m-2">
                          Inattiva
                        </Badge>
                      )}
                    </div>
                    <Card.Body className="text-center d-flex flex-column justify-content-between p-4">
                      <div>
                        <Card.Title className="fw-bold fs-5 mb-1">{p.title}</Card.Title>
                        {p.subtitle && <p className="text-muted small mb-3">{p.subtitle}</p>}
                        {totalOriginal > 0 && totalDiscounted && (
                          <div className="price-block">
                            <span className="old-price text-muted text-decoration-line-through">
                              {totalOriginal.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
                            </span>
                            <span className="price-arrow mx-2">→</span>
                            <span className="new-price text-success fw-bold fs-4">
                              {totalDiscounted.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="mt-3">
                        <small className="text-muted d-block">
                          {p.startDate ? new Date(p.startDate).toLocaleDateString() : ""}
                          {p.endDate ? ` → ${new Date(p.endDate).toLocaleDateString()}` : ""}
                        </small>
                        {user?.role === "ADMIN" && (
                          <div className="d-flex gap-2 justify-content-center mt-3">
                            <Button
                              size="sm"
                              variant="outline-secondary"
                              className="rounded-circle"
                              onClick={() => {
                                setEditingPromotion(p);
                                setOpenPromo(true);
                              }}
                            >
                              <PencilFill />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline-danger"
                              className="rounded-circle"
                              onClick={() => {
                                setSelectedPromotion(p);
                                setDeleteModal(true);
                              }}
                            >
                              <Trash2Fill />
                            </Button>
                          </div>
                        )}
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              );
            })}
          </Row>

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
    </Container>
  );
}

export default OffertePage;
