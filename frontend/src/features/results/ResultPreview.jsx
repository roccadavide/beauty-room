import { useEffect, useState, useMemo } from "react";
import { Container, Spinner } from "react-bootstrap";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import ResultCard from "./ResultCard";
import ResultDrawer from "./ResultDrawer";
import DeleteResultModal from "./DeleteResultModal";
import { fetchCategories } from "../../api/modules/categories.api";
import { deleteResult, fetchResults, patchResultFeatured } from "../../api/modules/results.api";

const MAX_FEATURED = 2;

function DiamondDivider() {
  return (
    <div className="rc-diamond-divider" aria-hidden="true">
      <div className="rc-diamond-divider__line" />
      <div className="rc-diamond-divider__gem">◆</div>
      <div className="rc-diamond-divider__line" />
    </div>
  );
}

export default function ResultsPreview() {
  const [allResults, setAllResults] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [open, setOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null);
  const [editingResult, setEditingResult] = useState(null);

  const { user, accessToken } = useSelector(state => state.auth);
  const isAdmin = user?.role === "ADMIN";
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        const [res, cats] = await Promise.all([fetchResults(), fetchCategories()]);
        setAllResults(res);
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
    categories.forEach(c => {
      map[c.categoryId] = c.label;
    });
    return map;
  }, [categories]);

  const featured = useMemo(() => allResults.filter(r => r.featured), [allResults]);

  const toggleFeatured = async id => {
    const result = allResults.find(r => r.resultId === id);
    if (!result) return;
    const newValue = !result.featured;
    if (newValue && allResults.filter(r => r.featured).length >= MAX_FEATURED) return;
    try {
      const updated = await patchResultFeatured(id, newValue, accessToken);
      setAllResults(prev => prev.map(r => (r.resultId === id ? updated : r)));
    } catch (err) {
      alert("Errore: " + err.message);
    }
  };

  if (loading)
    return (
      <section className="rprev-section">
        <div className="d-flex justify-content-center py-5">
          <Spinner animation="border" />
        </div>
      </section>
    );

  if (error || featured.length === 0) return null;

  return (
    <section className="rprev-section">
      <Container fluid="xl" className="px-3 px-md-4">
        <div className="rp-head text-center mb-5">
          <span className="section-eyebrow">Prima &amp; Dopo</span>
          <h2 className="section-title">Risultati in evidenza</h2>
          <p className="section-subtitle">Trasformazioni reali delle nostre clienti, trattamento dopo trattamento.</p>
          {isAdmin && (
            <button className="rprev-picker-toggle" onClick={() => setPickerOpen(p => !p)}>
              {pickerOpen ? "✕ Chiudi selezione" : "⭐ Scegli i risultati in evidenza"}
            </button>
          )}
        </div>

        {/* Picker admin */}
        {isAdmin && pickerOpen && (
          <div className="rprev-picker">
            <p className="rprev-picker__hint">
              Seleziona fino a {MAX_FEATURED} risultati da mostrare in home.
              <span className="rprev-picker__count">
                {" "}
                ({allResults.filter(r => r.featured).length}/{MAX_FEATURED})
              </span>
            </p>
            <div className="rprev-picker__grid">
              {allResults.map(r => {
                const isFeatured = r.featured;
                const isDisabled = !isFeatured && allResults.filter(res => res.featured).length >= MAX_FEATURED;
                return (
                  <button
                    key={r.resultId}
                    className={`rprev-picker__item ${isFeatured ? "is-featured" : ""} ${isDisabled ? "is-disabled" : ""}`}
                    onClick={() => !isDisabled && toggleFeatured(r.resultId)}
                    title={isDisabled ? `Massimo ${MAX_FEATURED} risultati` : isFeatured ? "Rimuovi dall'evidenza" : "Metti in evidenza"}
                  >
                    <div className="rprev-picker__thumb">
                      {r.images?.[0] ? <img src={r.images[0]} alt={r.title} /> : <span className="rprev-picker__no-img">◆</span>}
                      <span className="rprev-picker__star">{isFeatured ? "★" : "☆"}</span>
                    </div>
                    <span className="rprev-picker__name">{r.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Cards */}
        <div className="rp-list">
          {featured.map((res, idx) => (
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
              />
              {idx < featured.length - 1 && <DiamondDivider />}
            </div>
          ))}
        </div>

        <div className="rprev-cta">
          <button className="rprev-cta__btn" onClick={() => navigate("/risultati")}>
            Scopri tutti i risultati
            <span className="rprev-cta__arrow">→</span>
          </button>
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
          <DeleteResultModal
            show={deleteModal}
            onHide={() => setDeleteModal(false)}
            result={selectedResult}
            onConfirm={async id => {
              try {
                await deleteResult(id);
                setAllResults(prev => prev.filter(r => r.resultId !== id));
                setDeleteModal(false);
                setSelectedResult(null);
              } catch (err) {
                alert("Errore: " + err.message);
              }
            }}
          />
        </>
      )}
    </section>
  );
}
