import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import AdminToggle from "../../components/common/AdminToggle";
import { EditButton, DeleteButton } from "../../components/common/AdminActionButtons";
import { useLike } from "../../hooks/useLike";
import LikePill from "../../components/common/LikePill";

/**
 * ResultCard — layout editoriale alternato Prima/Dopo
 *
 * Props:
 *   result        → { resultId, title, shortDescription, images[], categoryId }
 *   categoryLabel → string
 *   index         → number (0-based) — determina left/right
 *   isAdmin       → bool
 *   onEdit        → fn(result)
 *   onDelete      → fn(result)
 *   onToggle      → fn(resultId, newActiveValue)
 */
export default function ResultCard({ result, categoryLabel, index, isAdmin, onEdit, onDelete, onToggle }) {
  const rowRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const isEven = index % 2 === 0;
  const { count, liked, triggerLike } = useLike("RESULT", result.resultId, result.likesCount ?? 0);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const images = result.images ?? [];
  const hasBoth = images.length >= 2;
  const hasOne = images.length === 1;

  const ImagesBlock = (
    <div className="rc-images">
      {hasBoth ? (
        <>
          <div className="rc-img-slot">
            <img src={images[0]} alt={`${result.title} — prima`} loading="lazy" />
            <span className="rc-label rc-label--before">Prima</span>
          </div>
          <div className="rc-divider-v" aria-hidden="true" />
          <div className="rc-img-slot">
            <img src={images[1]} alt={`${result.title} — dopo`} loading="lazy" />
            <span className="rc-label rc-label--after">Dopo</span>
          </div>
        </>
      ) : hasOne ? (
        <div className="rc-img-slot rc-img-slot--single">
          <img src={images[0]} alt={result.title} loading="lazy" />
        </div>
      ) : (
        <div className="rc-img-slot rc-img-slot--placeholder">
          <span className="rc-placeholder-text">Foto in arrivo</span>
        </div>
      )}
    </div>
  );

  const InfoBlock = (
    <div className={`rc-info ${isEven ? "rc-info--right" : "rc-info--left"}`}>
      <div className="rc-info__inner">
        <span className="rc-eyebrow">{categoryLabel || "Risultato"}</span>
        <div className="rc-accent-line" />
        <h3 className="rc-title">{result.title}</h3>
        <p className="rc-desc">{result.description}</p>

        {result.linkedServiceId && (
          <Link
            to={`/trattamenti/${result.linkedServiceId}`}
            className="rc-service-link"
            onClick={e => e.stopPropagation()}
          >
            Scopri il trattamento →
          </Link>
        )}
      </div>
      <div className="rc-likes">
        <LikePill count={count} liked={liked} onClick={triggerLike} />
      </div>
    </div>
  );

  return (
    <div
      ref={rowRef}
      className={`rc-row ${visible ? "rc-row--visible" : ""} ${isEven ? "rc-row--even" : "rc-row--odd"}${isAdmin && !(result.active ?? true) ? " admin-entity--inactive" : ""}`}
      data-index={index}
    >
      {isAdmin && (
        <div className="rc-admin-floating" onClick={e => e.stopPropagation()}>
          {onToggle && (
            <AdminToggle
              entityId={result.resultId}
              isActive={result.active ?? true}
              endpoint="/results"
              onToggleSuccess={newVal => onToggle(result.resultId, newVal)}
            />
          )}
          <EditButton onClick={() => onEdit(result)} />
          <DeleteButton onClick={() => onDelete(result)} />
        </div>
      )}
      {/* Desktop: alterna immagini/testo. Mobile: sempre immagini sopra, testo sotto */}
      <div className="rc-row__desktop">
        {isEven ? (
          <>
            {ImagesBlock}
            {InfoBlock}
          </>
        ) : (
          <>
            {InfoBlock}
            {ImagesBlock}
          </>
        )}
      </div>
      <div className="rc-row__mobile">
        {ImagesBlock}
        {InfoBlock}
      </div>
    </div>
  );
}
