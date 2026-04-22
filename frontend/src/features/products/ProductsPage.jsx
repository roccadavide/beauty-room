import { useState, useEffect, useMemo, useRef } from "react";
import { Container, Row } from "react-bootstrap";
import ProductsPageSkeleton from "./ProductsPageSkeleton";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import DeleteProductModal from "./DeleteProductModal";
import ProductModal from "./ProductModal";
import AdminAddButton from "../../components/common/AdminAddButton";
import SEO from "../../components/common/SEO";
import { fetchCategories } from "../../api/modules/categories.api";
import { deleteProduct, fetchProducts } from "../../api/modules/products.api";
import useScrollRestore from "../../hooks/useScrollRestore";
import ProductCard from "./ProductCard";

function ProductsPage() {
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const [allProducts, setAllProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const { save } = useScrollRestore("products-page");
  const [error, setError] = useState(null);

  const [open, setOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);

  const { user, accessToken } = useSelector(state => state.auth);
  const isAdmin = user?.role === "ADMIN";

  const navigate = useNavigate();
  const rowRef = useRef(null);

  // ---------- FETCH ----------
  useEffect(() => {
    const loadData = async () => {
      try {
        const [products, cats] = await Promise.all([fetchProducts(isAdmin), fetchCategories()]);
        setAllProducts(products);
        setCategories(cats);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [isAdmin]);

  // ---------- CATEGORIES MAP ----------
  const categoriesMap = useMemo(() => {
    const map = {};
    categories.forEach(c => {
      map[c.categoryId] = c.label;
    });
    return map;
  }, [categories]);

  const allowedCategoryLabels = useMemo(() => new Set(["corpo", "mani", "piedi", "viso"]), []);

  const allowedCategoryIds = useMemo(() => {
    return new Set(categories.filter(c => allowedCategoryLabels.has((c.label || "").trim().toLowerCase())).map(c => c.categoryId));
  }, [categories, allowedCategoryLabels]);

  const categoryIdsWithProducts = useMemo(() => {
    return new Set(allProducts.map(p => p.categoryId));
  }, [allProducts]);

  const visibleCategories = useMemo(() => {
    return categories.filter(c => allowedCategoryIds.has(c.categoryId) && categoryIdsWithProducts.has(c.categoryId));
  }, [categories, allowedCategoryIds, categoryIdsWithProducts]);

  // ---------- FILTER ----------
  const filtered = useMemo(() => {
    return allProducts
      .filter(p => allowedCategoryIds.has(p.categoryId))
      .filter(p => (cat === "all" ? true : p.categoryId === cat))
      .filter(p => p.name.toLowerCase().includes(q.toLowerCase()) || p.description.toLowerCase().includes(q.toLowerCase()));
  }, [allProducts, cat, q, allowedCategoryIds]);

  // Stampa data-scroll-id sui figli del Row dopo il render
  useEffect(() => {
    if (!rowRef.current || loading) return;
    const children = rowRef.current.children;
    filtered.forEach((p, i) => {
      if (children[i]) {
        children[i].setAttribute("data-scroll-id", p.productId);
      }
    });
  }, [filtered, loading]);

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

  // ---------- UI ----------
  if (loading) return <ProductsPageSkeleton />;

  if (error) {
    return (
      <Container className="container-base">
        <p>{error}</p>
      </Container>
    );
  }

  return (
    <Container fluid className="pb-5 container-base flex-column">
      <SEO
        title="Prodotti"
        description="Acquista i prodotti professionali di Beauty Room: creme, sieri e trattamenti selezionati per la cura di viso e corpo."
      />
      <div className="sp-page-head">
        <span className="section-eyebrow">Prodotti</span>
        <h1 className="sp-page-title">La mia selezione</h1>
        <p className="section-subtitle">Prodotti selezionati con cura per prolungare i risultati dei tuoi trattamenti.</p>
      </div>

      <div className="sp-filter-bar">
        <button className={`sp-chip ${cat === "all" ? "sp-chip--active" : ""}`} onClick={() => setCat("all")}>
          <span className="sp-chip-label">Tutti</span>
        </button>

        {visibleCategories.map(c => (
          <button key={c.categoryId} className={`sp-chip ${cat === c.categoryId ? "sp-chip--active" : ""}`} onClick={() => setCat(c.categoryId)}>
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

      {isAdmin && (
        <div className="mb-4 d-flex align-items-center justify-content-center">
          <AdminAddButton onClick={handleCreate} label="Nuovo prodotto" />
        </div>
      )}

      <Container fluid="xxl">
        <Row ref={rowRef} className="g-4 g-xl-5">
          {filtered.map(p => (
            <ProductCard
              key={p.productId}
              p={p}
              isAdmin={isAdmin}
              categoriesMap={categoriesMap}
              onCardClick={() => {
                save(p.productId);
                navigate(`/prodotti/${p.productId}`);
              }}
              onEdit={() => handleEdit(p)}
              onDelete={() => {
                setSelectedProduct(p);
                setDeleteModal(true);
              }}
              onToggleActive={newVal => setAllProducts(prev => prev.map(pr => (pr.productId === p.productId ? { ...pr, active: newVal } : pr)))}
            />
          ))}
        </Row>
      </Container>

      {isAdmin && (
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
