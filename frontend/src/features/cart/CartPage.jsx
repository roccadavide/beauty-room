import { useDispatch, useSelector } from "react-redux";
import { Container, Row, Col, Spinner } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import CheckoutModal from "./CheckoutModal";
import { createCheckoutSession, createCheckoutSessionGuest } from "../../api/modules/stripe.api";
import { removeFromCart, updateCartQuantity } from "./slices/cart.slice";
import SEO from "../../components/common/SEO";

const CartPage = () => {
  const items = useSelector(state => state.cart?.items ?? []);
  const totalPrice = useSelector(state => state.cart?.totalPrice ?? 0);
  const { accessToken, user } = useSelector(state => state.auth);
  const [showCheckout, setShowCheckout] = useState(false);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const hasNonProducts = items.some(i => i.type !== "product");

  const handleStripeCheckoutAuth = async () => {
    try {
      setLoading(true);
      const orderData = {
        customerName: user?.name || "",
        customerSurname: user?.surname || "",
        customerEmail: user?.email || "",
        customerPhone: user?.phone || "",
        pickupNote: note,
        // TODO: endpoint misto pacchetti — for now only product items go to Stripe
        items: items
          .filter(i => i.type === "product")
          .map(i => ({ productId: i.productId, quantity: i.quantity })),
      };
      const { url } = await createCheckoutSession(orderData);
      window.location.href = url;
    } catch (err) {
      alert("Errore durante il pagamento: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStripeCheckoutGuest = async orderData => {
    try {
      setLoading(true);
      const res = await createCheckoutSessionGuest({ ...orderData, pickupNote: note });
      window.location.href = res.url;
    } catch (err) {
      alert("Errore durante il pagamento: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleProceed = () => {
    if (accessToken) handleStripeCheckoutAuth();
    else setShowCheckout(true);
  };

  if (items.length === 0) {
    return (
      <>
        <SEO
          title="Carrello"
          description="Il tuo carrello Beauty Room. Riepilogo prodotti selezionati per l'acquisto."
          noindex={true}
        />
        <div className="cart-empty-page">
          <Container>
            <div className="cart-empty-inner">
              <div className="cart-empty-icon">✦</div>
              <h2 className="cart-empty-title">Il tuo carrello è vuoto</h2>
              <p className="cart-empty-sub">Scopri i nostri prodotti e trattamenti selezionati</p>
              <div className="cart-empty-ctas">
                <Link to="/prodotti" className="cart-empty-btn">Esplora Prodotti</Link>
                <Link to="/trattamenti" className="cart-empty-btn cart-empty-btn--outline">Vedi Trattamenti</Link>
              </div>
            </div>
          </Container>
        </div>
      </>
    );
  }

  return (
    <div className="cart-page">
      <SEO
        title="Carrello"
        description="Il tuo carrello Beauty Room. Riepilogo prodotti selezionati per l'acquisto."
        noindex={true}
      />
      <Container>
        <div className="cart-header">
          <span className="section-eyebrow">Il tuo</span>
          <h1 className="cart-title">Carrello</h1>
        </div>

        <Row className="g-5">
          <Col lg={7} xl={8}>
            <div className="cart-items-list">
              {items.map((item, idx) => (
                <div key={item.id} className="cart-item" style={{ animationDelay: `${idx * 0.07}s` }}>
                  <div
                    className="cart-item-img"
                    onClick={() => item.type === "product" && navigate(`/prodotti/${item.productId}`)}
                  >
                    <img src={item.image} alt={item.name} />
                  </div>
                  <div className="cart-item-info">
                    <h3
                      className="cart-item-name"
                      onClick={() => item.type === "product" && navigate(`/prodotti/${item.productId}`)}
                    >
                      {item.name}
                    </h3>
                    <p className="cart-item-price-unit">€ {item.price.toFixed(2)} cad.</p>
                    {item.type === "package" && (
                      <span className="cart-item-type-pill">Pacchetto · {item.sessions} sed.</span>
                    )}
                    {item.type === "promotion" && (
                      <span className="cart-item-type-pill">{item.discountLabel}</span>
                    )}
                    {item.type === "product" && item.stock && (
                      <p className="cart-item-stock">{item.stock} disponibili</p>
                    )}
                  </div>
                  <div className="cart-item-controls">
                    {item.type === "product" ? (
                      <div className="cart-qty-wrap">
                        <button
                          className="cart-qty-btn"
                          onClick={() => dispatch(updateCartQuantity({ id: item.id, quantity: Math.max(1, item.quantity - 1) }))}
                          aria-label="Riduci quantità"
                        >−</button>
                        <span className="cart-qty-num">{item.quantity}</span>
                        <button
                          className="cart-qty-btn"
                          disabled={item.quantity >= item.stock}
                          onClick={() => dispatch(updateCartQuantity({ id: item.id, quantity: item.quantity + 1 }))}
                          aria-label="Aumenta quantità"
                        >+</button>
                      </div>
                    ) : (
                      <span className="cart-qty-num">× 1</span>
                    )}
                    <p className="cart-item-subtotal">€ {(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                  <button
                    className="cart-item-remove"
                    onClick={() => dispatch(removeFromCart(item.id))}
                    aria-label="Rimuovi dal carrello"
                  >×</button>
                </div>
              ))}
            </div>

            <div className="cart-note-wrap">
              <label className="cart-note-label">Nota per il ritiro (opzionale)</label>
              <textarea
                className="cart-note-input"
                rows={2}
                placeholder="Es. orario preferito, richieste particolari..."
                value={note}
                onChange={e => setNote(e.target.value)}
              />
            </div>
          </Col>

          <Col lg={5} xl={4}>
            <div className="cart-summary">
              <h3 className="cart-summary-title">Riepilogo ordine</h3>
              <div className="cart-summary-rows">
                {items.map(item => (
                  <div key={item.id} className="cart-summary-row">
                    <span>{item.name} ×{item.quantity}</span>
                    <span>€ {(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="cart-summary-divider" />
              <div className="cart-summary-total">
                <span>Totale</span>
                <span className="cart-total-price">€ {totalPrice.toFixed(2)}</span>
              </div>
              {hasNonProducts && (
                <p className="cart-summary-notice">
                  ⚠️ I pacchetti richiedono conferma telefonica. Sarai contattata dopo il pagamento.
                </p>
              )}
              <p className="cart-summary-note">Ritiro in negozio · Pagamento sicuro</p>
              <button
                className="cart-checkout-btn"
                onClick={handleProceed}
                disabled={loading}
              >
                {loading ? <Spinner animation="border" size="sm" /> : "Procedi al pagamento"}
              </button>
              <Link to="/prodotti" className="cart-continue-link">← Continua lo shopping</Link>
            </div>
          </Col>
        </Row>
      </Container>

      <CheckoutModal
        show={showCheckout}
        onHide={() => setShowCheckout(false)}
        onConfirm={handleStripeCheckoutGuest}
        totalPrice={totalPrice}
        cartItems={items}
      />
    </div>
  );
};

export default CartPage;
