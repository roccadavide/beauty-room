import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { Container, Spinner } from "react-bootstrap";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import ResultDrawer from "./ResultDrawer";
import DeleteResultModal from "./DeleteResultModal";
import DiamondDivider from "../../components/common/DiamondDivider";
import LikeBurst from "../../components/common/LikeBurst";
import { useLike } from "../../hooks/useLike";
import { fetchCategories } from "../../api/modules/categories.api";
import { deleteResult, fetchResults, patchResultFeatured } from "../../api/modules/results.api";

const MAX_FEATURED = 2;

function PreviewCard({ res, categoriesMap, isAdmin, onEdit, onDelete, navigate }) {
  const { count, liked, burst, triggerLike, showHint } = useLike("RESULT", res.resultId, res.likesCount ?? 0);
  const lastTapRef = useRef(0);
  const navTimerRef = useRef(null);

  const handleClick = useCallback(() => {
    const now = Date.now();
    const delta = now - lastTapRef.current;
    lastTapRef.current = now;

    if (delta < 350 && delta > 0) {
      clearTimeout(navTimerRef.current);
      triggerLike();
    } else {
      navTimerRef.current = setTimeout(() => {
        navigate(`/risultati?highlight=${res.resultId}`);
      }, 360);
    }
  }, [triggerLike, navigate, res.resultId]);

  return (
    <article
      className="rprev-card"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === "Enter" && navigate(`/risultati?highlight=${res.resultId}`)}
    >
      <div className="rprev-card__images">
        <div className="rprev-card__slot">
          {res.images?.[0]
            ? <img src={res.images[0]} alt={`Prima - ${res.title}`} loading="lazy" />
            : <div className="rprev-card__placeholder">◆</div>
          }
          <span className="rprev-card__label rprev-card__label--before">Prima</span>
        </div>
        <div className="rprev-card__divider" aria-hidden="true" />
        <div className="rprev-card__slot">
          {res.images?.[1]
            ? <img src={res.images[1]} alt={`Dopo - ${res.title}`} loading="lazy" />
            : <div className="rprev-card__placeholder">◆</div>
          }
          <span className="rprev-card__label rprev-card__label--after">Dopo</span>
        </div>
        <LikeBurst active={burst} />
        <div className="rprev-card__likes">
          <span className="rprev-card__likes-icon">♥</span>
          <span className="rprev-card__likes-count">{count}</span>
        </div>
        {showHint && (
          <div className="rprev-like-hint">Tocca due volte per mettere mi piace</div>
        )}
      </div>

      <div className="rprev-card__overlay">
        {categoriesMap[res.categoryId] && (
          <span className="rprev-card__eyebrow">{categoriesMap[res.categoryId]}</span>
        )}
        <h3 className="rprev-card__title">{res.title}</h3>
        <span className="rprev-card__cta">
          Scopri il risultato <span className="rprev-card__arrow">→</span>
        </span>
      </div>

      {isAdmin && (
        <div className="rprev-card__admin" onClick={e => e.stopPropagation()}>
          <button
            className="rc-admin-btn btn btn-sm btn-light"
            onClick={() => onEdit(res)}
            title="Modifica"
          >✎</button>
          <button
            className="rc-admin-btn btn btn-sm btn-light"
            onClick={() => onDelete(res)}
            title="Elimina"
          >✕</button>
        </div>
      )}
    </article>
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

  const featured = useMemo(() => {
    const f = allResults.filter(r => r.featured);
    return f.length > 0 ? f : allResults.slice(0, 2);
  }, [allResults]);

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

  if (error || allResults.length === 0) return null;

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
        <div className="rprev-cards">
          {featured.map((res, idx) => (
            <div key={res.resultId}>
              <PreviewCard
                res={res}
                categoriesMap={categoriesMap}
                isAdmin={isAdmin}
                onEdit={r => { setEditingResult(r); setOpen(true); }}
                onDelete={r => { setSelectedResult(r); setDeleteModal(true); }}
                navigate={navigate}
              />
              {idx < featured.length - 1 && <DiamondDivider />}
            </div>
          ))}
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
