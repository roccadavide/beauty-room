import { useEffect, useMemo, useState, useRef } from "react";
import { Badge, Button, Card, Col, Container, Form, Row, Spinner } from "react-bootstrap";
import { useSelector } from "react-redux";
import { PencilFill, Plus, Trash2Fill } from "react-bootstrap-icons";
import { fetchPromotions, deletePromotion } from "../../api/modules/promotions.api";
import { fetchProducts } from "../../api/modules/products.api";
import { fetchServices } from "../../api/modules/services.api";
import PromotionModal from "./PromotionModal";
import DeletePromotionModal from "./DeletePromotionModal";

const getDiscountedPrice = (original, discountType, discountValue) => {
  if (!original || !discountType || !discountValue) return original;
  if (discountType === "PERCENTAGE") {
    return original - (original * discountValue) / 100;
  } else if (discountType === "FIXED") {
    return original - discountValue;
  } else {
    return original;
  }
};

const getTotalOriginalPrice = (promotion, products, services) => {
  const productSum = products.filter(prod => promotion.productIds?.includes(prod.productId)).reduce((sum, p) => sum + (p.price || 0), 0);
  const serviceSum = services.filter(serv => promotion.serviceIds?.includes(serv.serviceId)).reduce((sum, s) => sum + (s.price || 0), 0);
  return productSum + serviceSum;
};

function PromotionsPage() {
  const { user, token } = useSelector(state => state.auth);

  const [allPromos, setAllPromos] = useState([]);
  const [q, setQ] = useState("");
  const [scope, setScope] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [open, setOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState(null);
  const [deleteModal, setDeleteModal] = useState(false);
  const [selectedPromotion, setSelectedPromotion] = useState(null);

  const [products, setProducts] = useState([]);
  const [services, setServices] = useState([]);

  const cardsRef = useRef([]);
  const [visibleMap, setVisibleMap] = useState({});

  useEffect(() => {
    const load = async () => {
      try {
        const [promos, prods, servs] = await Promise.all([fetchPromotions(), fetchProducts(), fetchServices()]);
        setAllPromos(promos);
        setProducts(prods);
        setServices(servs);
      } catch (err) {
        setError(err.message || "Errore nel caricamento promozioni");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => {
        entries.forEach(e => e.isIntersecting && setVisibleMap(prev => ({ ...prev, [e.target.dataset.id]: true })));
      },
      { threshold: 0.25 }
    );
    const targets = [...cardsRef.current].filter(Boolean);
    targets.forEach(el => obs.observe(el));
    return () => {
      targets.forEach(el => obs.unobserve(el));
      obs.disconnect();
    };
  }, [allPromos, scope, q]);

  const filtered = useMemo(() => {
    return allPromos
      .filter(p => (scope === "all" ? true : p.scope === scope))
      .filter(p => {
        const str = `${p.title} ${p.subtitle ?? ""} ${p.description ?? ""}`.toLowerCase();
        return str.includes(q.toLowerCase());
      })
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }, [allPromos, scope, q]);

  const handleCreate = () => {
    setEditingPromotion(null);
    setOpen(true);
  };

  const handleEdit = promo => {
    setEditingPromotion(promo);
    setOpen(true);
  };

  const handleSaved = saved => {
    setAllPromos(prev => {
      const exists = prev.some(p => p.promotionId === saved.promotionId);
      return exists ? prev.map(p => (p.promotionId === saved.promotionId ? saved : p)) : [saved, ...prev];
    });
    setOpen(false);
    setEditingPromotion(null);
  };

  const handleDeleteConfirm = async id => {
    try {
      await deletePromotion(id, token);
      setAllPromos(prev => prev.filter(p => p.promotionId !== id));
      setDeleteModal(false);
      setSelectedPromotion(null);
    } catch (err) {
      alert("Errore durante l'eliminazione: " + err.message);
    }
  };

  if (loading) {
    return (
      <Container className="container-base">
        <Spinner animation="border" />
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="container-base">
        <p className="text-danger">{error}</p>
      </Container>
    );
  }

  return (
    <Container fluid className="py-4 container-base flex-column">
      <h1 className="text-center mb-2 fw-bold display-5">Promozioni</h1>
      <p className="text-center lead mb-4">Scopri le offerte speciali su prodotti e trattamenti.</p>

      <Container className="mb-4">
        <Row className="g-2 align-items-center justify-content-center">
          <Col xs="12" md="6">
            <Form.Control placeholder="Cerca promozione..." value={q} onChange={e => setQ(e.target.value)} />
          </Col>
          <Col xs="12" md="3">
            <Form.Select value={scope} onChange={e => setScope(e.target.value)}>
              <option value="all">Tutti gli ambiti</option>
              <option value="GLOBAL">Globale</option>
              <option value="PRODUCTS">Prodotti</option>
              <option value="SERVICES">Servizi</option>
              <option value="MIXED">Misto</option>
            </Form.Select>
          </Col>
          {user?.role === "ADMIN" && (
            <Col xs="12" md="3" className="d-flex justify-content-md-end">
              <Button variant="success" onClick={handleCreate} className="d-flex align-items-center gap-2 shadow-sm">
                <Plus /> Nuova promozione
              </Button>
            </Col>
          )}
        </Row>
      </Container>

      <Container>
        <Row className="g-4 justify-content-center">
          {filtered.map((p, idx) => {
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
                        {p.startDate ? new Date(p.startDate).toLocaleDateString() : ""} {p.endDate ? `→ ${new Date(p.endDate).toLocaleDateString()}` : ""}
                      </small>

                      {user?.role === "ADMIN" && (
                        <div className="d-flex gap-2 justify-content-center mt-3">
                          <Button size="sm" variant="outline-secondary" className="rounded-circle" onClick={() => handleEdit(p)}>
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

        {filtered.length === 0 && <p className="text-center text-muted mt-4">Nessuna promozione trovata.</p>}
      </Container>

      {user?.role === "ADMIN" && (
        <>
          <PromotionModal
            show={open}
            onHide={() => {
              setOpen(false);
              setEditingPromotion(null);
            }}
            onSaved={handleSaved}
            products={products}
            services={services}
            promotion={editingPromotion}
          />

          <DeletePromotionModal show={deleteModal} onHide={() => setDeleteModal(false)} promotion={selectedPromotion} onConfirm={handleDeleteConfirm} />
        </>
      )}
    </Container>
  );
}

export default PromotionsPage;
