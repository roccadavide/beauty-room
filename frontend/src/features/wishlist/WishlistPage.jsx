import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { Container } from "react-bootstrap";
import { setItems, setLoading, removeItem, setFilter } from "./wishlistSlice";
import { fetchWishlist, toggleWishlist as apiToggle } from "../../api/modules/wishlist.api";
import SEO from "../../components/common/SEO";

const FILTER_LABELS = {
  ALL: "Tutti",
  SERVICE: "Trattamenti",
  PRODUCT: "Prodotti",
  PROMOTION: "Promozioni",
  PACKAGE: "Pacchetti",
};

const ITEM_TYPE_LABEL = {
  SERVICE: "Trattamento",
  PRODUCT: "Prodotto",
  PROMOTION: "Promozione",
  PACKAGE: "Pacchetto",
};

function itemLink(item) {
  switch (item.itemType) {
    case "SERVICE":   return `/trattamenti/${item.itemId}`;
    case "PRODUCT":   return `/prodotti/${item.itemId}`;
    case "PROMOTION": return `/occasioni`;
    default:          return `/occasioni`;
  }
}

function ctaLabel(item) {
  switch (item.itemType) {
    case "SERVICE":   return "Prenota →";
    case "PRODUCT":   return "Acquista →";
    case "PROMOTION": return "Scopri →";
    default:          return "Vedi →";
  }
}

export default function WishlistPage() {
  const dispatch = useDispatch();
  const { items, loaded, loading, filter } = useSelector(s => s.wishlist);
  const { user } = useSelector(s => s.auth);

  useEffect(() => {
    if (!user || loaded) return;
    dispatch(setLoading(true));
    fetchWishlist()
      .then(data => dispatch(setItems(data.items ?? [])))
      .catch(() => dispatch(setLoading(false)));
  }, [user, loaded, dispatch]);

  const filtered = filter === "ALL" ? items : items.filter(i => i.itemType === filter);

  const handleRemove = async item => {
    try {
      await apiToggle(item.itemType, item.itemId);
      dispatch(removeItem({ itemType: item.itemType, itemId: item.itemId }));
    } catch {
      // silently ignore
    }
  };

  return (
    <>
      <SEO title="La tua Wishlist — Beauty Room" description="I trattamenti e i prodotti che hai salvato." />

      <Container className="wl-page">
        {/* Header */}
        <div className="wl-header">
          <h1 className="wl-title">✦ La tua Wishlist</h1>
        </div>

        {/* Filtri pill */}
        <div className="wl-filters">
          {Object.entries(FILTER_LABELS).map(([key, label]) => (
            <button
              key={key}
              className={`wl-filter-pill${filter === key ? " wl-filter-pill--active" : ""}`}
              onClick={() => dispatch(setFilter(key))}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="wl-loading">
            {[1, 2, 3].map(i => <div key={i} className="wl-skeleton-card" />)}
          </div>
        )}

        {/* Empty state */}
        {!loading && items.length === 0 && (
          <div className="wl-empty">
            <div className="wl-empty-heart">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </div>
            <h2 className="wl-empty-title">La tua wishlist è vuota</h2>
            <p className="wl-empty-sub">Salva i trattamenti e i prodotti che ti incuriosiscono</p>
            <Link to="/trattamenti" className="wl-empty-cta">Esplora i trattamenti</Link>
          </div>
        )}

        {/* Filtered empty (ha item ma nessuno del filtro selezionato) */}
        {!loading && items.length > 0 && filtered.length === 0 && (
          <div className="wl-empty wl-empty--filter">
            <p className="wl-empty-sub">Nessun elemento salvato in questa categoria.</p>
          </div>
        )}

        {/* Lista item */}
        {!loading && filtered.length > 0 && (
          <div className="wl-list">
            {filtered.map(item => (
              <div key={`${item.itemType}-${item.itemId}`} className="wl-card">
                {/* Thumbnail */}
                <div className="wl-card-thumb">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} loading="lazy" />
                  ) : (
                    <div className="wl-card-thumb-placeholder" />
                  )}
                </div>

                {/* Info */}
                <div className="wl-card-info">
                  <span className="wl-card-type">{ITEM_TYPE_LABEL[item.itemType] ?? item.itemType}</span>
                  <span className="wl-card-name">{item.name}</span>

                  <div className="wl-card-meta">
                    {item.price != null && (
                      <span className="wl-card-price">
                        {Number(item.price).toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
                      </span>
                    )}
                    {item.durationMin != null && (
                      <span className="wl-card-duration">⏱ {item.durationMin} min</span>
                    )}
                  </div>

                  {!item.isActive && (
                    <div className="wl-card-inactive-wrap">
                      <span className="wl-card-inactive-badge">Non disponibile</span>
                      <span className="wl-card-inactive-note">Ti avviseremo quando tornerà disponibile</span>
                    </div>
                  )}
                </div>

                {/* Azioni */}
                <div className="wl-card-actions">
                  {item.isActive && (
                    <Link to={itemLink(item)} className="wl-card-cta">
                      {ctaLabel(item)}
                    </Link>
                  )}
                  <button
                    className="wl-card-remove"
                    onClick={() => handleRemove(item)}
                    aria-label="Rimuovi dalla wishlist"
                    title="Rimuovi"
                  >
                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Container>
    </>
  );
}
