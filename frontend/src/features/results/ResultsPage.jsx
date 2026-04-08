import { useState, useEffect, useMemo } from "react";
import { Container, Spinner } from "react-bootstrap";
import { useSelector } from "react-redux";
import ResultCard from "./ResultCard";
import AdminAddButton from "../../components/common/AdminAddButton";
import ResultDrawer from "./ResultDrawer";
import DeleteResultModal from "./DeleteResultModal";
import { deleteResult, fetchResults } from "../../api/modules/results.api";
import { fetchCategories } from "../../api/modules/categories.api";
import SEO from "../../components/common/SEO";

export default function ResultsPage() {
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
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

  const filtered = useMemo(() => {
    const byCat = cat === "all" ? allResults : allResults.filter(r => r.categoryId === cat);
    if (!q.trim()) return byCat;
    const lower = q.trim().toLowerCase();
    return byCat.filter(r => r.title?.toLowerCase().includes(lower) || r.shortDescription?.toLowerCase().includes(lower));
  }, [allResults, cat, q]);

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
      <>
        <SEO
          title="Risultati"
          description="Guarda i risultati reali dei trattamenti laser e estetici di Beauty Room di Michela."
        />
        <div className="rp-loading">
          <Spinner animation="border" />
        </div>
      </>
    );

  if (error)
    return (
      <>
        <SEO
          title="Risultati"
          description="Guarda i risultati reali dei trattamenti laser e estetici di Beauty Room di Michela."
        />
        <div className="rp-loading">
          <p className="text-danger">{error}</p>
        </div>
      </>
    );

  return (
    <div className="results-root">
      <SEO
        title="Risultati"
        description="Guarda i risultati reali dei trattamenti laser e estetici di Beauty Room di Michela."
      />
      <Container fluid="xl" className="px-3 px-md-4">
        {/* ── Header centrato (come ProductsPage) ── */}
        <div className="sp-page-head">
          <span className="section-eyebrow">Portfolio</span>
          <h1 className="sp-page-title">I miei risultati</h1>
          <p className="section-subtitle mb-0">Trasformazioni reali delle nostre clienti, trattamento dopo trattamento.</p>
        </div>

        {/* ── Filtri categoria ── */}
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

        {/* ── Search bar + pulsante Nuovo (sotto la search, come ProductsPage) ── */}
        <div className="sp-search-wrap rp-search-wrap">
          <svg className="sp-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input className="sp-search-input" placeholder="Cerca risultato..." value={q} onChange={e => setQ(e.target.value)} />
          {q && (
            <button className="sp-search-clear" onClick={() => setQ("")} aria-label="Cancella">
              ×
            </button>
          )}
        </div>

        {isAdmin && (
          <div className="mb-4 d-flex align-items-center justify-content-center">
            <AdminAddButton
              label="Nuovo risultato"
              onClick={() => {
                setEditingResult(null);
                setOpen(true);
              }}
            />
          </div>
        )}

        {/* ── Lista risultati (verticale, piena larghezza) ── */}
        {filtered.length === 0 ? (
          <div className="rp-empty">
            <span className="rp-empty__icon">◆</span>
            <p className="rp-empty__text">Nessun risultato trovato.</p>
          </div>
        ) : (
          <div className="rp-list">
            {filtered.map((res, idx) => (
              <ResultCard
                key={res.resultId}
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
                onToggle={(id, newVal) => setAllResults(prev => prev.map(r => (r.resultId === id ? { ...r, active: newVal } : r)))}
              />
            ))}
          </div>
        )}
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
