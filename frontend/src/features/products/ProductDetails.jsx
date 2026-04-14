import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Container, Badge, Spinner } from "react-bootstrap";
import { fetchProducts } from "../../api/modules/products.api";
import { fetchCategories } from "../../api/modules/categories.api";
import { createCheckoutSession, createCheckoutSessionGuest } from "../../api/modules/stripe.api";
import { subscribeStockAlert } from "../../api/modules/products.api";
import { addToCart } from "../cart/slices/cart.slice";
import RelatedCarousel from "../../components/common/RelatedCarousel";
import PayNowModal from "./PayNowModal";
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

const ProductDetail = () => {
  const { productId } = useParams();
  const [product, setProduct] = useState(null);
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [categories, setCategories] = useState([]);
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [qty, setQty] = useState(1);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user, accessToken } = useSelector(s => s.auth);

  // ── PayNow modal state ──
  const [showPayNow, setShowPayNow] = useState(false);

  // ── Stock alert state ──
  const [alertEmail, setAlertEmail] = useState("");
  const [alertName, setAlertName] = useState("");
  const [alertLoading, setAlertLoading] = useState(false);
  const [alertStatus, setAlertStatus] = useState(null); // null | 'success' | 'already' | 'error'

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const prods = await fetchProducts();
        const found = prods.find(p => p.productId === productId);
        setProduct(found || null);
        setAllProducts(prods);
        const cats = await fetchCategories();
        setCategories(cats);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadProducts();
  }, [productId]);

  // Pre-fill alert fields when user/product loads
  useEffect(() => {
    if (user) {
      setAlertEmail(user.email || "");
      setAlertName(`${user.name || ""} ${user.surname || ""}`.trim());
    }
  }, [user]);

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

  const relatedProducts = useMemo(() => {
    if (!product || !allProducts.length) return [];
    const sameCat = allProducts.filter(p => p.categoryId === product.categoryId && p.productId !== product.productId);
    return sameCat.sort(() => 0.5 - Math.random()).slice(0, 3);
  }, [product, allProducts]);

  const [relatedRef, relatedVisible] = useInView();

  const handleAddToCart = () => {
    dispatch(
      addToCart({
        id: product.productId,
        type: "product",
        productId: product.productId,
        name: product.name,
        price: product.price,
        quantity: qty,
        image: product.images?.[0],
        stock: product.stock,
      }),
    );
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 1800);
  };

  const handlePayNow = () => {
    setShowPayNow(true);
  };

  const handleCheckoutAuth = async orderData => {
    const { url } = await createCheckoutSession(orderData);
    window.location.href = url;
  };

  const handleCheckoutGuest = async orderData => {
    const res = await createCheckoutSessionGuest(orderData);
    window.location.href = res.url;
  };

  const handleStockAlert = async () => {
    if (!alertEmail || !/\S+@\S+\.\S+/.test(alertEmail)) return;
    try {
      setAlertLoading(true);
      await subscribeStockAlert(product.productId, alertEmail, alertName || "Cliente");
      setAlertStatus("success");
    } catch (err) {
      setAlertStatus(err.message === "ALREADY_SUBSCRIBED" ? "already" : "error");
    } finally {
      setAlertLoading(false);
    }
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

  if (!product)
    return (
      <Container className="pt-5 text-center">
        <p>Prodotto non trovato.</p>
      </Container>
    );

  return (
    <>
      <SEO
        title={product?.name}
        description={product?.description ? product.description.slice(0, 150) : undefined}
        image={product?.images?.[0]}
        jsonLd={
          product
            ? {
                "@context": "https://schema.org",
                "@type": "Product",
                name: product.name,
                description: product.description,
                image: product.images?.[0],
                offers: {
                  "@type": "Offer",
                  price: product.price,
                  priceCurrency: "EUR",
                  availability: "https://schema.org/InStock",
                  url: `https://www.beauty-room.it/products/${product.productId}`,
                },
                brand: {
                  "@type": "Brand",
                  name: "Beauty Room di Michela",
                },
              }
            : undefined
        }
      />
      <Container fluid className="product-detail">
        <div className="sd-layout-grid">
          <div className="sd-col-img">
            <ImageGallery images={product.images?.filter(Boolean) ?? []} alt={product.name} />
          </div>

          <div className="detail-info sd-col-info">
            <div className="detail-meta">
              <Badge bg={categoryColorMap[product.categoryId] || "secondary"} className="text-uppercase detail-badge">
                {categoriesMap[product.categoryId] || "Senza categoria"}
              </Badge>
              <span className="detail-duration">{product.stock > 0 ? `${product.stock} disponibili` : "Esaurito"}</span>
            </div>

            <h1 className="detail-title">{product.name}</h1>

            <div className="detail-accent-line" />

            <div className="detail-price-block">
              <span className="detail-price">{product.price.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</span>
              <span className="detail-price-note">prezzo al pezzo</span>
            </div>

            <div className="detail-trust">
              <span className="detail-trust-pill">✓ Ritiro in negozio</span>
              <span className="detail-trust-pill">✓ Pagamenti sicuri</span>
              <span className="detail-trust-pill">✓ Nessun costo al ritiro</span>
            </div>

            {product.stock === 0 ? (
              /* ── PRODOTTO ESAURITO ── */
              <div className="detail-sold-out-section">
                <div className="detail-sold-out-badge">
                  <span className="detail-sold-out-icon">◆</span>
                  Temporaneamente esaurito
                </div>

                {alertStatus === "success" ? (
                  <div className="detail-alert-success">
                    <span>✓</span> Ti avviseremo via email appena torna disponibile.
                  </div>
                ) : alertStatus === "already" ? (
                  <div className="detail-alert-success">
                    <span>✓</span> Sei già in lista d&apos;attesa per questo prodotto.
                  </div>
                ) : (
                  <div className="detail-alert-form">
                    <p className="detail-alert-title">Avvisami quando torna disponibile</p>
                    <div className="detail-alert-inputs">
                      {!user && (
                        <input className="detail-alert-input" placeholder="Il tuo nome" value={alertName} onChange={e => setAlertName(e.target.value)} />
                      )}
                      <input
                        className="detail-alert-input"
                        type="email"
                        placeholder="La tua email"
                        value={alertEmail}
                        onChange={e => setAlertEmail(e.target.value)}
                      />
                      <button className="detail-alert-btn" onClick={handleStockAlert} disabled={alertLoading || !alertEmail}>
                        {alertLoading ? "..." : "Avvisami"}
                      </button>
                    </div>
                    {alertStatus === "error" && <p className="detail-alert-error">Si è verificato un errore. Riprova.</p>}
                  </div>
                )}
              </div>
            ) : (
              /* ── PRODOTTO DISPONIBILE: CTAs normali ── */
              <>
                <div className="detail-qty-wrap">
                  <span className="so-label">Quantità</span>
                  <div className="detail-qty-controls">
                    <button className="cart-qty-btn" onClick={() => setQty(q => Math.max(1, q - 1))} disabled={qty <= 1}>
                      −
                    </button>
                    <span className="cart-qty-num">{qty}</span>
                    <button className="cart-qty-btn" onClick={() => setQty(q => Math.min(product.stock, q + 1))} disabled={qty >= product.stock}>
                      +
                    </button>
                  </div>
                </div>

                <div className="detail-cart-actions">
                  <button className="detail-pay-btn" onClick={handlePayNow} disabled={payLoading}>
                    {payLoading ? "..." : "Paga ora"}
                  </button>
                  <button className={`detail-cart-btn${addedFeedback ? " added" : ""}`} onClick={handleAddToCart}>
                    {addedFeedback ? "✓ Aggiunto" : "Aggiungi al carrello"}
                  </button>
                </div>
              </>
            )}

            <div className="detail-divider" />

            <div className={`detail-description ${showFullDesc ? "expanded" : ""}`}>
              <p>{product.description}</p>
            </div>

            {product.description?.length > 200 && (
              <button className="detail-expand-btn" onClick={() => setShowFullDesc(!showFullDesc)}>
                {showFullDesc ? "Mostra meno ↑" : "Leggi tutto ↓"}
              </button>
            )}
          </div>
        </div>

        {/* ▸ PRODOTTI CORRELATI */}
        {relatedProducts.length > 0 && (
          <section ref={relatedRef} className={`related-section mt-5 pt-5 fade-slide ${relatedVisible ? "visible" : ""}`}>
            <div className="related-head">
              <span className="section-eyebrow">Scopri anche</span>
              <h3 className="related-title">Potrebbe interessarti</h3>
            </div>
            <RelatedCarousel
              items={relatedProducts}
              getKey={p => p.productId}
              renderCard={p => (
                <div className="related-card text-center" onClick={() => navigate(`/prodotti/${p.productId}`)} style={{ cursor: "pointer" }}>
                  <div className="related-img-wrap mb-3">
                    <img src={p.images?.[0]} alt={p.name} className="img-fluid rounded-4" />
                  </div>
                  <h5>{p.name}</h5>
                  <p className="text-muted mb-0">{p.price.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</p>
                </div>
              )}
            />
          </section>
        )}

        <PayNowModal
          show={showPayNow}
          onHide={() => setShowPayNow(false)}
          product={product}
          qty={qty}
          user={user}
          accessToken={accessToken}
          onCheckoutAuth={handleCheckoutAuth}
          onCheckoutGuest={handleCheckoutGuest}
        />
      </Container>
    </>
  );
};

export default ProductDetail;
