import { useState, useEffect, useMemo, useRef } from "react";
import { Badge, Button, Container, Spinner } from "react-bootstrap";
import { useSelector } from "react-redux";
import { PencilFill, Plus, Trash2Fill } from "react-bootstrap-icons";
import ResultDrawer from "./ResultDrawer";
import DeleteResultModal from "./DeleteResultModal";
import BeforeAfterSlider from "./BeforeAfterSlider";
import { deleteResult, fetchResults } from "../../api/modules/results.api";
import { fetchCategories } from "../../api/modules/categories.api";

function ResultsPage() {
  const [cat, setCat] = useState("all");
  const [allResults, setAllResults] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [open, setOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null);
  const [editingResult, setEditingResult] = useState(null);

  const { user } = useSelector(state => state.auth);

  const itemRefs = useRef([]);
  const [visibleMap, setVisibleMap] = useState({});

  useEffect(() => {
    const loadData = async () => {
      try {
        const [results, cats] = await Promise.all([fetchResults(), fetchCategories()]);
        setAllResults(results);
        setCategories(cats);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) setVisibleMap(prev => ({ ...prev, [e.target.dataset.id]: true }));
      }),
      { threshold: 0.15 }
    );
    const targets = [...itemRefs.current].filter(Boolean);
    targets.forEach(el => obs.observe(el));
    return () => { targets.forEach(el => obs.unobserve(el)); obs.disconnect(); };
  }, [cat, allResults]);

  const categoriesMap = useMemo(() => {
    const map = {};
    categories.forEach(c => (map[c.categoryId] = c.label));
    return map;
  }, [categories]);

  const badgeColors = {
    "2ab17c92-da9c-4b18-a04a-549eaa643ad3": "primary",
    "b5915bb8-869c-46b3-a2cc-82114e8fdeb1": "success",
    "95b6d339-a765-4569-9aee-08107d27516b": "warning",
    "7f1255a7-7c26-4bf6-972b-d285b5bc6c36": "info",
    "ddd9e4af-8343-42ce-8f93-1b48e2d4537c": "danger",
  };

  const filtered = useMemo(() => {
    return allResults.filter(r => (cat === "all" ? true : r.categoryId === cat));
  }, [allResults, cat]);

  const handleDeleteConfirm = async id => {
    try {
      await deleteResult(id);
      setAllResults(prev => prev.filter(r => r.resultId !== id));
      setDeleteModal(false);
      setSelectedResult(null);
    } catch (err) {
      alert("Errore durante l'eliminazione: " + err.message);
    }
  };

  const handleEdit = result => { setEditingResult(result); setOpen(true); };
  const handleCreate = () => { setEditingResult(null); setOpen(true); };

  const handleResultSaved = updatedResult => {
    setAllResults(prev => {
      const exists = prev.some(r => r.resultId === updatedResult.resultId);
      return exists
        ? prev.map(r => (r.resultId === updatedResult.resultId ? updatedResult : r))
        : [...prev, updatedResult];
    });
    setOpen(false);
    setEditingResult(null);
  };

  if (loading) {
    return (
      <Container className="container-base d-flex justify-content-center py-5">
        <Spinner animation="border" role="status" />
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="container-base py-5">
        <p className="text-danger text-center">{error}</p>
      </Container>
    );
  }

  return (
    <Container fluid className="results-root px-3 px-md-4">
      <div className="ra-page-head sp-page-head">
        <span className="section-eyebrow">Portfolio</span>
        <h1 className="ra-page-title">I miei risultati</h1>
        <p className="section-subtitle">
          Trasformazioni reali delle nostre clienti, trattamento dopo trattamento.
        </p>
      </div>

      <div className="sp-filter-bar">
        <button className={`sp-chip ${cat === "all" ? "sp-chip--active" : ""}`} onClick={() => setCat("all")}>
          <span className="sp-chip-label">Tutti</span>
        </button>
        {categories.map(c => (
          <button
            key={c.categoryId}
            className={`sp-chip ${cat === c.categoryId ? "sp-chip--active" : ""}`}
            onClick={() => setCat(c.categoryId)}
          >
            <span className="sp-chip-label">{c.label}</span>
          </button>
        ))}
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

      <div className="ra-gallery">
        {filtered.map((res, idx) => (
          <div
            key={res.resultId}
            data-id={res.resultId}
            ref={el => (itemRefs.current[idx] = el)}
            className={`ra-item${visibleMap[res.resultId] ? " visible" : ""}`}
          >
            {res.images?.length >= 2 ? (
              <BeforeAfterSlider
                beforeSrc={res.images[0]}
                afterSrc={res.images[1]}
                alt={res.title}
              />
            ) : (
              <div className="ra-single-img">
                <img src={res.images?.[0]} alt={res.title} />
              </div>
            )}

            <div className="ra-item-body">
              <Badge
                bg={badgeColors[res.categoryId] || "secondary"}
                className="text-uppercase rp-badge"
              >
                {categoriesMap[res.categoryId] || "Altro"}
              </Badge>
              <h3 className="ra-item-title">{res.title}</h3>
              <p className="ra-item-desc">{res.shortDescription}</p>

              {user?.role === "ADMIN" && (
                <div className="ra-item-admin">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="rounded-circle d-flex justify-content-center align-items-center"
                    onClick={e => { e.stopPropagation(); handleEdit(res); }}
                  >
                    <PencilFill />
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    className="rounded-circle d-flex justify-content-center align-items-center"
                    onClick={e => { e.stopPropagation(); setSelectedResult(res); setDeleteModal(true); }}
                  >
                    <Trash2Fill />
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-muted mt-4">Nessun risultato in questa categoria.</p>
      )}

      {user?.role === "ADMIN" && (
        <>
          <ResultDrawer
            show={open}
            onHide={() => { setOpen(false); setEditingResult(null); }}
            categories={categories}
            result={editingResult}
            onResultSaved={handleResultSaved}
          />
          <DeleteResultModal
            show={deleteModal}
            onHide={() => setDeleteModal(false)}
            result={selectedResult}
            onConfirm={handleDeleteConfirm}
          />
        </>
      )}
    </Container>
  );
}

export default ResultsPage;
