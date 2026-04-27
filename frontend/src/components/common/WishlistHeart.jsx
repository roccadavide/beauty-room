import { useEffect, useState, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import { checkWishlisted, toggleWishlist as apiToggle } from "../../api/modules/wishlist.api";
import { addItem, removeItem } from "../../features/wishlist/wishlistSlice";
import "./WishlistHeart.css";

// SVG cuore inline
const HeartIcon = ({ filled, className = "" }) => (
  <svg
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    className={`wh-icon ${filled ? "wh-icon-filled" : "wh-icon-empty"} ${className}`}
    aria-hidden="true"
  >
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

/**
 * WishlistHeart
 * @param {string}  itemType  — 'SERVICE' | 'PRODUCT' | 'PROMOTION' | 'PACKAGE'
 * @param {string}  itemId    — UUID dell'item
 * @param {'card'|'detail'} [variant='card']
 */
export default function WishlistHeart({ itemType, itemId, variant = "card" }) {
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
        className="wh-btn-card"
        onClick={handleClick}
        disabled={loading}
        data-tooltip={tooltip}
        aria-label={tooltip}
        aria-pressed={wishlisted}
      >
        <HeartIcon filled={wishlisted} className={popAnim ? "wh-pop" : ""} />
      </button>
      <div className={`wh-toast${toast.show ? " wh-toast--visible" : ""}`}>{toast.text}</div>
    </>
  );
}
