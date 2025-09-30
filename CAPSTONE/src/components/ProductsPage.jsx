import { useState, useEffect, useMemo } from "react";
import { Badge, Button, Card, Col, Container, Form, Row, Spinner } from "react-bootstrap";
import { deleteProduct, fetchCategories, fetchProducts } from "../api/api";
import { useSelector } from "react-redux";
import { PencilFill, Plus, Trash2Fill } from "react-bootstrap-icons";
import { Link, useNavigate } from "react-router-dom";
import DeleteProductModal from "./DeleteProductModal";
import ProductModal from "./ProductModal";

function ProductsPage() {
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const [allProducts, setAllProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [open, setOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);

  const { user, token } = useSelector(state => state.auth);

  const navigate = useNavigate();

  // ---------- FETCH ----------
  useEffect(() => {
    const loadData = async () => {
      try {
        const [products, cats] = await Promise.all([fetchProducts(), fetchCategories()]);
        setAllProducts(products);
        setCategories(cats);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // ---------- CATEGORIES MAP ----------
  const categoriesMap = useMemo(() => {
    const map = {};
    categories.forEach(c => {
      map[c.categoryId] = c.label;
    });
    return map;
  }, [categories]);

  // ---------- FILTER ----------
  const filtered = useMemo(() => {
    return allProducts
      .filter(p => (cat === "all" ? true : p.categoryId === cat))
      .filter(p => p.name.toLowerCase().includes(q.toLowerCase()) || p.description.toLowerCase().includes(q.toLowerCase()));
  }, [allProducts, cat, q]);

  // ---------- DELETE ----------
  const handleDeleteConfirm = async id => {
    try {
      await deleteProduct(id, token);
      setAllProducts(prev => prev.filter(p => p.productId !== id));
      setDeleteModal(false);
      setSelectedProduct(null);
    } catch (err) {
      alert("Errore durante l'eliminazione: " + err.message);
    }
  };

  // ---------- EDIT ----------
  const handleEdit = product => {
    setEditingProduct(product);
    setOpen(true);
  };

  // ---------- CREATE ----------
  const handleCreate = () => {
    setEditingProduct(null);
    setOpen(true);
  };

  // ---------- UPDATE OR CREATE ----------
  const handleProductSaved = updatedProduct => {
    if (editingProduct) {
      setAllProducts(prev => prev.map(p => (p.productId === updatedProduct.productId ? updatedProduct : p)));
    } else {
      setAllProducts(prev => [...prev, updatedProduct]);
    }
    setOpen(false);
    setEditingProduct(null);
  };

  const badgeColors = {
    "036f8d73-0d71-415f-b4cb-db4711c4c586": "primary", //Trucco permanente
    "1225ed9f-c5c8-4003-97b0-50a62874de4a": "success", //Piedi
    "89bbe501-6470-46a6-9187-1e19f9241bf4": "warning", //Mani
    "a8a1465f-032b-4481-8f47-160504b6036b": "info", //Corpo
    "f39e37ff-1210-4446-8968-610d2d1d6563": "danger", //Viso
  };

  // ---------- UI ----------
  if (loading) {
    return (
      <Container className="container-base">
        <Spinner animation="border" role="status" />
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="container-base">
        <p>{error}</p>
      </Container>
    );
  }

  return (
    <Container fluid className="py-5 d-flex flex-column align-items-center" style={{ marginTop: "7rem" }}>
      <h1 className="text-center mb-3">La mia selezione di prodotti</h1>

      <div className="d-flex flex-wrap justify-content-center gap-2 mb-4">
        <Button key="all" variant={cat === "all" ? "dark" : "outline-dark"} onClick={() => setCat("all")} className="rounded-pill px-3">
          Tutti
        </Button>

        {categories
          .filter(c => c.label !== "Trucco permanente")
          .map(c => (
            <Button
              key={c.categoryId}
              variant={cat === c.categoryId ? "dark" : "outline-dark"}
              onClick={() => setCat(c.categoryId)}
              className="rounded-pill px-3"
            >
              {c.label}
            </Button>
          ))}
      </div>

      <Container className="mb-4">
        <Form.Control placeholder="Cerca un prodotto..." value={q} onChange={e => setQ(e.target.value)} />
      </Container>

      {user?.role === "ADMIN" && (
        <div className="mb-4 d-flex align-items-center justify-content-center">
          <Button
            variant="success"
            className="rounded-circle d-flex align-items-center justify-content-center"
            style={{ width: "3rem", height: "3rem" }}
            onClick={handleCreate}
          >
            <Plus />
          </Button>
        </div>
      )}

      <Container>
        <Row className="g-4 justify-content-center">
          {filtered.map(p => (
            <Col key={p.productId} xs={12} sm={6} md={4} lg={3} className="d-flex justify-content-center">
              <Card className="h-100 shadow-sm" onClick={() => navigate(`/prodotti/${p.productId}`)}>
                <Card.Img src={p.images?.[0]} alt={p.name} />
                <Card.Body className="d-flex flex-column">
                  <Card.Title className="mb-1">{p.name}</Card.Title>
                  <div className="mb-2 d-flex align-items-center gap-2">
                    <Badge bg={badgeColors[p.categoryId] || "secondary"} className="text-uppercase">
                      {categoriesMap[p.categoryId] || "Senza categoria"}
                    </Badge>
                    <small className="text-muted">{p.stock} rimanenti</small>
                  </div>
                  <Card.Text className="flex-grow-1">{p.shortDescription}</Card.Text>
                  <div className="d-flex justify-content-between align-items-center mt-2">
                    <strong>{p.price.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</strong>
                    {user?.role === "ADMIN" && (
                      <div className="d-flex gap-2 ms-auto">
                        <Button
                          variant="secondary"
                          className="rounded-circle d-flex justify-content-center align-items-center"
                          onClick={e => {
                            e.stopPropagation();
                            handleEdit(p);
                          }}
                        >
                          <PencilFill />
                        </Button>
                        <Button
                          variant="danger"
                          className="rounded-circle d-flex justify-content-center align-items-center"
                          onClick={e => {
                            e.stopPropagation();
                            setSelectedProduct(p);
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
          ))}
        </Row>
      </Container>

      {user?.role === "ADMIN" && (
        <>
          <ProductModal
            show={open}
            onHide={() => {
              setOpen(false);
              setEditingProduct(null);
            }}
            categories={categories}
            product={editingProduct}
            onProductSaved={handleProductSaved}
          />

          <DeleteProductModal show={deleteModal} onHide={() => setDeleteModal(false)} product={selectedProduct} onConfirm={handleDeleteConfirm} />
        </>
      )}
    </Container>
  );
}

export default ProductsPage;
