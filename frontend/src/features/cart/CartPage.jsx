import { useDispatch, useSelector } from "react-redux";
import { Container, Row, Col, Spinner } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import CheckoutModal from "./CheckoutModal";
import { createCheckoutSession, createCheckoutSessionGuest } from "../../api/modules/stripe.api";
import { removeFromCart, updateCartQuantity } from "./slices/cart.slice";
import SEO from "../../components/common/SEO";
import MultiServiceBookingModal from "../bookings/MultiServiceBookingModal";
import openBookingSurface from "../bookings/openBookingSurface";
import useIsDesktop from "../../hooks/useIsDesktop";

const CartPage = () => {
  const items = useSelector(state => state.cart?.items ?? []);
  const totalPrice = useSelector(state => state.cart?.totalPrice ?? 0);
  const { accessToken, user } = useSelector(state => state.auth);
  const [showCheckout, setShowCheckout] = useState(false);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();

  const serviceItems = items.filter(i => i.type === "service");
  const productItems = items.filter(i => i.type === "product");
  const hasServices = serviceItems.length > 0;
  const hasProducts = productItems.length > 0;
  const [showMultiBooking, setShowMultiBooking] = useState(false);

  const handleStripeCheckoutAuth = async () => {
    try {
      setLoading(true);
      const orderData = {
        customerName: user?.name || "",
        customerSurname: user?.surname || "",
        customerEmail: user?.email || "",
        customerPhone: user?.phone || "",
        pickupNote: note,
        items: productItems.map(i => ({ productId: i.productId, quantity: i.quantity })),
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

  // Physical-pointer → side-drawer (unchanged). Virtual-keyboard device → push the
  // booking/checkout surface as a route. The authenticated direct-Stripe path is
  // unchanged on every device (no drawer, no route).
  const handleCheckout = () => {
    if (hasServices) {
      if (isDesktop) setShowMultiBooking(true);
      else navigate(...openBookingSurface({ type: "multi", services: serviceItems, products: productItems }));
      return;
    }
    if (accessToken) {
      handleStripeCheckoutAuth();
      return;
    }
    if (isDesktop) setShowCheckout(true);
    else
      navigate(
        ...openBookingSurface({
          type: "cart",
          cartItems: productItems,
          totalPrice: productItems.reduce((s, i) => s + i.price * i.quantity, 0),
          note,
        }),
      );
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

        <Row className="g-5 align-items-start">
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
              <h3 className="cart-summary-title">Il tuo ordine</h3>

              {/* Sezione Trattamenti */}
              {hasServices && (
                <>
                  <p className="cart-summary-section-label">Trattamenti</p>
                  <div className="cart-summary-rows">
                    {serviceItems.map(item => (
                      <div key={item.id} className="cart-summary-row">
                        <span>{item.name}</span>
                        <span>€ {item.price.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Sezione Prodotti */}
              {hasProducts && (
                <>
                  {hasServices && <div className="cart-summary-divider" />}
                  <p className="cart-summary-section-label">Prodotti</p>
                  <div className="cart-summary-rows">
                    {productItems.map(item => (
                      <div key={item.id} className="cart-summary-row">
                        <span>{item.name} ×{item.quantity}</span>
                        <span>€ {(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="cart-summary-divider" />

              <div className="cart-summary-total">
                <span>Totale</span>
                <span className="cart-total-price">€ {totalPrice.toFixed(2)}</span>
              </div>

              <p className="cart-summary-note">
                {hasServices && hasProducts
                  ? "Prenota la data · I prodotti si ritirano lo stesso giorno"
                  : hasServices
                    ? "Scegli data e orario · Pagamento sicuro"
                    : "Ritiro in negozio · Pagamento sicuro"}
              </p>

              <button
                className="cart-checkout-btn"
                onClick={handleCheckout}
                disabled={loading}
              >
                {loading
                  ? <Spinner animation="border" size="sm" />
                  : hasServices
                    ? "Procedi al pagamento →"
                    : "Procedi al pagamento"}
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
        totalPrice={productItems.reduce((s, i) => s + i.price * i.quantity, 0)}
        cartItems={productItems}
      />

      <MultiServiceBookingModal
        show={showMultiBooking}
        onHide={() => setShowMultiBooking(false)}
        services={serviceItems}
        products={productItems}
      />
    </div>
  );
};

export default CartPage;
