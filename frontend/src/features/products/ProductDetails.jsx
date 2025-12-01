import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Container, Row, Col, Badge, Button, Image, Spinner } from "react-bootstrap";
import QuantitySelector from "../../components/layout/QuantitySelector";
import { fetchProducts } from "../../api/modules/products.api";
import { fetchCategories } from "../../api/modules/categories.api";

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
  const navigate = useNavigate();

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
        <p>Servizio non trovato.</p>
      </Container>
    );

  return (
    <Container fluid className="product-detail">
      <Row className="justify-content-center align-items-start gap-5 g-5">
        {/* ▸ IMMAGINE */}
        <Col md={5} className="d-flex justify-content-center position-relative">
          <div ref={imageRef} className={`product-image-glass fade-slide ${imageVisible ? "visible" : ""}`}>
            <Image src={product.images?.[0]} alt={product.name} fluid rounded />
          </div>
        </Col>

        {/* ▸ INFO */}
        <Col md={6} lg={5} className="product-info fade-slide visible">
          <h1 className="product-title">{product.name}</h1>

          <div className="d-flex align-items-center gap-2 mb-3">
            <Badge bg={badgeColors[product.categoryId] || "secondary"} className="text-uppercase">
              {categoriesMap[product.categoryId] || "Senza categoria"}
            </Badge>
            <small className="text-muted">{product.stock} disponibili</small>
          </div>

          <div className="product-price-wrap mb-3">
            <h3 className="product-price">{product.price.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</h3>

            <div className="scalapay-info" title="Paga in 3 rate con Scalapay">
              <img src="/scalapay.jpeg" alt="Scalapay" className="scalapay-logo" />
              <span>Pagamento a rate disponibile</span>
            </div>
          </div>

          <div className="trust-box mb-4">
            <p>✅ Ritiro in negozio (no spedizione)</p>
            <p>✅ Pagamenti sicuri (Carta, Stripe, Scalapay)</p>
            <p>✅ Nessun costo aggiuntivo al ritiro</p>
          </div>

          <QuantitySelector product={product} />

          <hr className="my-4" />

          <div className={`product-description ${showFullDesc ? "expanded" : ""}`}>
            <p>{product.description}</p>
          </div>

          {product.description?.length > 200 && (
            <Button variant="outline-dark" size="sm" className="rounded-pill mt-2" onClick={() => setShowFullDesc(!showFullDesc)}>
              {showFullDesc ? "Mostra meno" : "Mostra di più"}
            </Button>
          )}
        </Col>
      </Row>

      {/* ▸ PRODOTTI CORRELATI */}
      {relatedProducts.length > 0 && (
        <section ref={relatedRef} className={`related-section mt-5 pt-5 fade-slide ${relatedVisible ? "visible" : ""}`}>
          <h3 className="text-center mb-4">Ti potrebbe interessare anche</h3>
          <Row className="justify-content-center g-4">
            {relatedProducts.map(rp => (
              <Col key={rp.productId} xs={10} sm={6} md={4} lg={3}>
                <div className="related-card text-center" onClick={() => navigate(`/prodotti/${rp.productId}`)}>
                  <div className="related-img-wrap mb-3">
                    <img src={rp.images?.[0]} alt={rp.name} className="img-fluid rounded-4" />
                  </div>
                  <h5>{rp.name}</h5>
                  <p className="text-muted mb-0">{rp.price.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</p>
                </div>
              </Col>
            ))}
          </Row>
        </section>
      )}
    </Container>
  );
};

export default ProductDetail;
