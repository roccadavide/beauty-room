import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Container, Row, Col, Badge, Button, Image, Spinner } from "react-bootstrap";
import BookingModal from "./BookingModal";
import { fetchCategories, fetchProducts } from "../api/api";
import QuantitySelector from "./QuantitySelector";

const ProductDetail = () => {
  const { productId } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const allProducts = await fetchProducts();
        const foundProduct = allProducts.find(p => p.productId === productId);
        setProduct(foundProduct || null);

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
    categories.forEach(c => {
      map[c.categoryId] = c.label;
    });
    return map;
  }, [categories]);

  const badgeColors = {
    "036f8d73-0d71-415f-b4cb-db4711c4c586": "primary", //Trucco permanente
    "1225ed9f-c5c8-4003-97b0-50a62874de4a": "success", //Piedi
    "89bbe501-6470-46a6-9187-1e19f9241bf4": "warning", //Mani
    "a8a1465f-032b-4481-8f47-160504b6036b": "info", //Corpo
    "f39e37ff-1210-4446-8968-610d2d1d6563": "danger", //Viso
  };

  if (loading) {
    return (
      <Container style={{ marginTop: "7rem" }}>
        <Spinner animation="border" role="status" />
      </Container>
    );
  }

  if (error) {
    return (
      <Container style={{ marginTop: "7rem" }}>
        <p>{error}</p>
      </Container>
    );
  }

  if (!product) {
    return (
      <Container style={{ marginTop: "7rem" }}>
        <p>Servizio non trovato.</p>
      </Container>
    );
  }

  return (
    <Container fluid style={{ marginTop: "112px" }}>
      <Row className="align-items-center g-4">
        <Col md={6}>
          <Image src={product.images?.[0]} alt={product.title} fluid rounded />
        </Col>
        <Col md={6}>
          <h1 className="mb-2">{product.name}</h1>
          <div className="d-flex align-items-center gap-2 mb-3">
            <Badge bg={badgeColors[product.categoryId] || "secondary"} className="text-uppercase">
              {categoriesMap[product.categoryId] || "Senza categoria"}
            </Badge>
            <small className="text-muted">{product.stock} rimanenti</small>
          </div>
          <p className="mb-3">{product.description}</p>
          <h4 className="mb-4">{product.price.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</h4>
          <QuantitySelector product={product} />
        </Col>
      </Row>
    </Container>
  );
};

export default ProductDetail;
