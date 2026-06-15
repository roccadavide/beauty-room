import { useEffect, useState, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import { checkWishlisted, toggleWishlist as apiToggle } from "../../api/modules/wishlist.api";
import { addItem, removeItem } from "../../features/wishlist/wishlistSlice";
import "./WishlistHeart.css";

// SVG stella inline
const HeartIcon = ({ filled, className = "" }) => (
  <svg
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    className={`wh-icon ${filled ? "wh-icon-filled" : "wh-icon-empty"} ${className}`}
    aria-hidden="true"
  >
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

/**
 * WishlistHeart
 * @param {string}  itemType  — 'SERVICE' | 'PRODUCT' | 'PROMOTION' | 'PACKAGE'
 * @param {string}  itemId    — UUID dell'item
 * @param {'card'|'detail'} [variant='card']
 * @param {string}  [label]   — opt-in: rende la variante 'card' come pill cuore + testo
 *                              (es. "Salva nei preferiti"). Senza label resta l'icona tonda.
 */
export default function WishlistHeart({ itemType, itemId, variant = "card", label = null }) {
  const { user } = useSelector(s => s.auth);
  const dispatch = useDispatch();

  const [wishlisted, setWishlisted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [popAnim, setPopAnim] = useState(false);
  const [toast, setToast] = useState({ show: false, text: "" });

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    checkWishlisted(itemType, itemId)
      .then(val => { if (!cancelled) setWishlisted(val); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user, itemType, itemId]);

  const showToast = useCallback(text => {
    setToast({ show: true, text });
    setTimeout(() => setToast({ show: false, text: "" }), 2500);
  }, []);

  const handleClick = useCallback(async e => {
    e.stopPropagation();
    if (loading) return;

    // Optimistic update
    const prev = wishlisted;
    setWishlisted(!prev);
    setLoading(true);

    try {
      const res = await apiToggle(itemType, itemId);
      setWishlisted(res.wishlisted);

      if (res.wishlisted) {
        dispatch(addItem({ itemType, itemId, createdAt: new Date().toISOString() }));
      } else {
        dispatch(removeItem({ itemType, itemId }));
      }

      // Animazione cuore al fill
      if (res.wishlisted) {
        setPopAnim(true);
        setTimeout(() => setPopAnim(false), 350);
      }
    } catch (err) {
      // Ripristina stato precedente
      setWishlisted(prev);
      if (err?.response?.status === 401) {
        showToast("Accedi per salvare nella wishlist");
      } else {
        showToast("Impossibile aggiornare la wishlist");
      }
    } finally {
      setLoading(false);
    }
  }, [loading, wishlisted, itemType, itemId, dispatch, showToast]);

  // Early return DOPO tutti gli hook
  if (!user) return null;

  const tooltip = wishlisted ? "Rimuovi dalla wishlist" : "Aggiungi alla wishlist";

  if (variant === "detail") {
    return (
      <>
        <button
          className={`wh-btn-detail${wishlisted ? " wh-active" : ""}`}
          onClick={handleClick}
          disabled={loading}
          aria-label={tooltip}
          aria-pressed={wishlisted}
        >
          <HeartIcon filled={wishlisted} className={popAnim ? "wh-pop" : ""} />
          {wishlisted ? "Salvato" : "Wishlist"}
        </button>
        <div className={`wh-toast${toast.show ? " wh-toast--visible" : ""}`}>{toast.text}</div>
      </>
    );
  }

  return (
    <>
      <button
        className={`wh-btn-card${label ? " wh-btn-card--labeled" : ""}`}
        onClick={handleClick}
        disabled={loading}
        data-tooltip={tooltip}
        aria-label={tooltip}
        aria-pressed={wishlisted}
      >
        <HeartIcon filled={wishlisted} className={popAnim ? "wh-pop" : ""} />
        {label && <span className="wh-btn-card-label">{wishlisted ? "Salvato" : label}</span>}
      </button>
      <div className={`wh-toast${toast.show ? " wh-toast--visible" : ""}`}>{toast.text}</div>
    </>
  );
}
