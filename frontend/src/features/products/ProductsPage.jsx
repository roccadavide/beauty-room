import { useState, useEffect, useMemo } from "react";
import { Badge, Button, Card, Col, Container, Row, Spinner } from "react-bootstrap";
import { useSelector } from "react-redux";
import { PencilFill, Plus, Trash2Fill } from "react-bootstrap-icons";
import { useNavigate } from "react-router-dom";
import DeleteProductModal from "./DeleteProductModal";
import ProductModal from "./ProductModal";
import { fetchCategories } from "../../api/modules/categories.api";
import { deleteProduct, fetchProducts } from "../../api/modules/products.api";

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

  const { user, accessToken } = useSelector(state => state.auth);

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
      await deleteProduct(id, accessToken);
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
    "b5915bb8-869c-46b3-a2cc-82114e8fdeb1": "success", //Piedi
    "95b6d339-a765-4569-9aee-08107d27516b": "warning", //Mani
    "7f1255a7-7c26-4bf6-972b-d285b5bc6c36": "info", //Corpo
    "ddd9e4af-8343-42ce-8f93-1b48e2d4537c": "danger", //Viso
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
    <Container fluid className="py-5 container-base flex-column">
      <div className="sp-page-head">
        <span className="section-eyebrow">Prodotti</span>
        <h1 className="sp-page-title">La mia selezione</h1>
        <p className="section-subtitle">Prodotti selezionati con cura per prolungare i risultati dei tuoi trattamenti.</p>
      </div>

      <div className="sp-filter-bar">
        <button className={`sp-chip ${cat === "all" ? "sp-chip--active" : ""}`} onClick={() => setCat("all")}>
          <span className="sp-chip-label">Tutti</span>
        </button>

        {categories
          .filter(c => c.label !== "Trucco Permanente")
          .map(c => (
            <button
              key={c.categoryId}
              className={`sp-chip ${cat === c.categoryId ? "sp-chip--active" : ""}`}
              onClick={() => setCat(c.categoryId)}
            >
              <span className="sp-chip-label">{c.label}</span>
            </button>
          ))}
      </div>

      <div className="sp-search-wrap">
        <svg className="sp-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input className="sp-search-input" placeholder="Cerca..." value={q} onChange={e => setQ(e.target.value)} />
        {q && (
          <button className="sp-search-clear" onClick={() => setQ("")} aria-label="Cancella">
            ×
          </button>
        )}
      </div>

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

      <Container fluid="xxl">
        <Row className="g-4 g-xl-5">
          {filtered.map(p => (
            <Col key={p.productId} xs={12} sm={6} lg={6} xl={4} className="d-flex">
              <Card
                className={`br-card beauty-product-card h-100${p.stock === 0 ? " bpc--sold-out" : ""}`}
                onClick={() => navigate(`/prodotti/${p.productId}`)}
              >
                <div className="bpc-img-wrap">
                  <Card.Img src={p.images?.[0]} alt={p.name} />
                  {p.stock === 0 && (
                    <div className="bpc-sold-out-overlay">
                      <span className="bpc-sold-out-label">Esaurito</span>
                    </div>
                  )}
                </div>
                <Card.Body className="d-flex flex-column">
                  <div className="bpc-accent-line" />
                  <Card.Title className="bpc-title mb-1">{p.name}</Card.Title>
                  <div className="mb-2 d-flex align-items-center gap-2">
                    <Badge bg={badgeColors[p.categoryId] || "secondary"} className="text-uppercase">
                      {categoriesMap[p.categoryId] || "Senza categoria"}
                    </Badge>
                    <small className="text-muted">{p.stock > 0 ? `${p.stock} rimanenti` : "Esaurito"}</small>
                  </div>
                  <Card.Text className="flex-grow-1">{p.shortDescription}</Card.Text>
                  <div className="d-flex justify-content-between align-items-center mt-2">
                    <span className="bpc-price">{p.price.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</span>
                    {p.stock === 0 && <span className="bpc-out-pill">Non disponibile</span>}
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
