import { useState, useEffect, useMemo } from "react";
import { Container, Spinner } from "react-bootstrap";
import { useSelector } from "react-redux";
import ResultCard from "./ResultCard";
import AdminAddButton from "../../components/common/AdminAddButton";
import ResultDrawer from "./ResultDrawer";
import DeleteResultModal from "./DeleteResultModal";
import { deleteResult, fetchResults } from "../../api/modules/results.api";
import { fetchCategories } from "../../api/modules/categories.api";

function DiamondDivider() {
  return (
    <div className="rc-diamond-divider" aria-hidden="true">
      <div className="rc-diamond-divider__line" />
      <div className="rc-diamond-divider__gem">◆</div>
      <div className="rc-diamond-divider__line" />
    </div>
  );
}

export default function ResultsPage() {
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
  const isAdmin = user?.role === "ADMIN";

  useEffect(() => {
    const load = async () => {
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
    load();
  }, []);

  const categoriesMap = useMemo(() => {
    const map = {};
    categories.forEach(c => (map[c.categoryId] = c.label));
    return map;
  }, [categories]);

  const filtered = useMemo(() => allResults.filter(r => cat === "all" || r.categoryId === cat), [allResults, cat]);

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

  if (loading)
    return (
      <div className="rp-loading">
        <Spinner animation="border" />
      </div>
    );

  if (error)
    return (
      <div className="rp-loading">
        <p className="text-danger">{error}</p>
      </div>
    );

  return (
    <div className="results-root">
      <Container fluid="xl" className="px-3 px-md-4">
        {/* ── Header ── */}
        <div className="ra-page-head sp-page-head">
          <span className="section-eyebrow">Portfolio</span>
          <h1 className="ra-page-title">I miei risultati</h1>
          <p className="section-subtitle">Trasformazioni reali delle nostre clienti, trattamento dopo trattamento.</p>

          {/* + Nuovo risultato — in cima, visibile solo ad admin */}
          {isAdmin && (
            <AdminAddButton
              label="Nuovo risultato"
              onClick={() => {
                setEditingResult(null);
                setOpen(true);
              }}
            />
          )}
        </div>

        {/* ── Filtri sticky ── */}
        <div className="rp-filters-sticky">
          <div className="sp-filter-bar">
            <button className={`sp-chip ${cat === "all" ? "sp-chip--active" : ""}`} onClick={() => setCat("all")}>
              <span className="sp-chip-label">Tutti</span>
            </button>
            {categories.map(c => (
              <button key={c.categoryId} className={`sp-chip ${cat === c.categoryId ? "sp-chip--active" : ""}`} onClick={() => setCat(c.categoryId)}>
                <span className="sp-chip-label">{c.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Lista risultati ── */}
        <div className="rp-list">
          {filtered.length === 0 ? (
            <div className="rp-empty">
              <span className="rp-empty__icon">◆</span>
              <p className="rp-empty__text">Nessun risultato in questa categoria.</p>
            </div>
          ) : (
            filtered.map((res, idx) => (
              <div key={res.resultId}>
                <ResultCard
                  result={res}
                  categoryLabel={categoriesMap[res.categoryId]}
                  index={idx}
                  isAdmin={isAdmin}
                  onEdit={r => {
                    setEditingResult(r);
                    setOpen(true);
                  }}
                  onDelete={r => {
                    setSelectedResult(r);
                    setDeleteModal(true);
                  }}
                  onToggle={(id, newVal) =>
                    setAllResults(prev => prev.map(r => r.resultId === id ? { ...r, active: newVal } : r))
                  }
                />
                {idx < filtered.length - 1 && <DiamondDivider />}
              </div>
            ))
          )}
        </div>
      </Container>

      {isAdmin && (
        <>
          <ResultDrawer
            show={open}
            onHide={() => {
              setOpen(false);
              setEditingResult(null);
            }}
            categories={categories}
            result={editingResult}
            onResultSaved={updated => {
              setAllResults(prev => {
                const exists = prev.some(r => r.resultId === updated.resultId);
                return exists ? prev.map(r => (r.resultId === updated.resultId ? updated : r)) : [...prev, updated];
              });
              setOpen(false);
              setEditingResult(null);
            }}
          />
          <DeleteResultModal show={deleteModal} onHide={() => setDeleteModal(false)} result={selectedResult} onConfirm={handleDeleteConfirm} />
        </>
      )}
    </div>
  );
}
