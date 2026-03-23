import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Container, Row, Col, Badge, Spinner } from "react-bootstrap";
import { fetchProducts } from "../../api/modules/products.api";
import { fetchCategories } from "../../api/modules/categories.api";
import { createCheckoutSession } from "../../api/modules/stripe.api";
import { addToCart } from "../cart/slices/cart.slice";
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

  const categoriesMap = useMemo(() => {
    const map = {};
    categories.forEach(c => (map[c.categoryId] = c.label));
    return map;
  }, [categories]);

  const badgeColors = {
    "b5915bb8-869c-46b3-a2cc-82114e8fdeb1": "success",
    "95b6d339-a765-4569-9aee-08107d27516b": "warning",
    "7f1255a7-7c26-4bf6-972b-d285b5bc6c36": "info",
    "ddd9e4af-8343-42ce-8f93-1b48e2d4537c": "danger",
  };

  const relatedProducts = useMemo(() => {
    if (!product || !allProducts.length) return [];
    const sameCat = allProducts.filter(p => p.categoryId === product.categoryId && p.productId !== product.productId);
    return sameCat.sort(() => 0.5 - Math.random()).slice(0, 3);
  }, [product, allProducts]);

  const [relatedRef, relatedVisible] = useInView();
  const [imageRef, imageVisible] = useInView();

  const handleAddToCart = () => {
    dispatch(addToCart({
      id: product.productId,
      type: "product",
      productId: product.productId,
      name: product.name,
      price: product.price,
      quantity: qty,
      image: product.images?.[0],
      stock: product.stock,
    }));
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 1800);
  };

  const handlePayNow = async () => {
    if (!accessToken) {
      navigate("/login", { state: { from: `/prodotti/${product.productId}` } });
      return;
    }
    try {
      setPayLoading(true);
      const orderData = {
        customerName: user?.name || "",
        customerSurname: user?.surname || "",
        customerEmail: user?.email || "",
        customerPhone: user?.phone || "",
        pickupNote: "",
        items: [{ productId: product.productId, quantity: qty }],
      };
      const { url } = await createCheckoutSession(orderData);
      window.location.href = url;
    } catch (err) {
      alert("Errore: " + err.message);
    } finally {
      setPayLoading(false);
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
    <Container fluid="xxl" className="product-detail">
      <Row className="justify-content-center align-items-start g-4 g-md-5">
        {/* ▸ IMMAGINE */}
        <Col md={5} lg={5} className="d-flex justify-content-center">
          <div ref={imageRef} className={`detail-img-hero fade-slide ${imageVisible ? "visible" : ""}`}>
            <img src={product.images?.[0]} alt={product.name} />
            <div className="detail-img-shimmer" />
          </div>
        </Col>

        {/* ▸ INFO */}
        <Col md={6} lg={5} className="detail-info fade-slide visible">
          <div className="detail-meta">
            <Badge bg={badgeColors[product.categoryId] || "secondary"} className="text-uppercase detail-badge">
              {categoriesMap[product.categoryId] || "Senza categoria"}
            </Badge>
            <span className="detail-duration">{product.stock} disponibili</span>
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

          {/* Selettore quantità */}
          <div className="detail-qty-wrap">
            <span className="so-label">Quantità</span>
            <div className="detail-qty-controls">
              <button
                className="cart-qty-btn"
                onClick={() => setQty(q => Math.max(1, q - 1))}
                disabled={qty <= 1}
              >−</button>
              <span className="cart-qty-num">{qty}</span>
              <button
                className="cart-qty-btn"
                onClick={() => setQty(q => Math.min(product.stock, q + 1))}
                disabled={qty >= product.stock}
              >+</button>
            </div>
          </div>

          {/* Dual CTA */}
          <div className="detail-cart-actions">
            <button
              className="detail-pay-btn"
              onClick={handlePayNow}
              disabled={payLoading || product.stock === 0}
            >
              {payLoading ? "..." : "Paga ora"}
            </button>
            <button
              className={`detail-cart-btn${addedFeedback ? " added" : ""}`}
              onClick={handleAddToCart}
              disabled={product.stock === 0}
            >
              {addedFeedback ? "✓ Aggiunto" : "Aggiungi al carrello"}
            </button>
          </div>

          <div className="detail-divider" />

          <div className={`detail-description ${showFullDesc ? "expanded" : ""}`}>
            <p>{product.description}</p>
          </div>

          {product.description?.length > 200 && (
            <button className="detail-expand-btn" onClick={() => setShowFullDesc(!showFullDesc)}>
              {showFullDesc ? "Mostra meno ↑" : "Leggi tutto ↓"}
            </button>
          )}
        </Col>
      </Row>

      {/* ▸ PRODOTTI CORRELATI */}
      {relatedProducts.length > 0 && (
        <section
          ref={relatedRef}
          className={`related-section mt-5 pt-5 fade-slide ${relatedVisible ? "visible" : ""}`}
        >
          <div className="related-head">
            <span className="section-eyebrow">Scopri anche</span>
            <h3 className="related-title">Potrebbe interessarti</h3>
          </div>
          <RelatedCarousel
            items={relatedProducts}
            getKey={p => p.productId}
            renderCard={p => (
              <div
                className="related-card text-center"
                onClick={() => navigate(`/prodotti/${p.productId}`)}
                style={{ cursor: "pointer" }}
              >
                <div className="related-img-wrap mb-3">
                  <img src={p.images?.[0]} alt={p.name} className="img-fluid rounded-4" />
                </div>
                <h5>{p.name}</h5>
                <p className="text-muted mb-0">
                  {p.price.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
                </p>
              </div>
            )}
          />
        </section>
      )}
    </Container>
  );
};

export default ProductDetail;
