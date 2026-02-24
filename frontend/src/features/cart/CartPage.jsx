import { useDispatch, useSelector } from "react-redux";
import { Container, Row, Col, ListGroup, Image, Button, Spinner } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import { Dash, Plus, Trash } from "react-bootstrap-icons";
import { useState } from "react";
import CheckoutModal from "./CheckoutModal";
import { createCheckoutSession, createCheckoutSessionGuest } from "../../api/modules/stripe.api";
import { removeFromCart, updateCartQuantity } from "./slices/cart.slice";

const CartPage = () => {
  const { items, totalPrice } = useSelector(state => state.cart);
  const { token, user } = useSelector(state => state.auth);
  const [showCheckout, setShowCheckout] = useState(false);
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // ---------- CHECKOUT UTENTE LOGGATO ----------
  const handleStripeCheckoutAuth = async () => {
    try {
      setLoading(true);
      const orderData = {
        customerName: user?.name || "",
        customerSurname: user?.surname || "",
        customerEmail: user?.email || "",
        customerPhone: user?.phone || "",
        pickupNote: "",
        items: items.map(i => ({
          productId: i.productId,
          quantity: i.quantity,
        })),
      };

      if (process.env.NODE_ENV !== "production") {
        console.debug("[checkout] endpoint: /checkout/create-session (auth)", { ...orderData, items: `[${orderData.items.length} items]` });
      }

      const { url } = await createCheckoutSession(orderData);
      window.location.href = url;
    } catch (err) {
      alert("Errore durante il pagamento: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ---------- CHECKOUT GUEST ----------
  const handleStripeCheckoutGuest = async orderData => {
    try {
      setLoading(true);
      const res = await createCheckoutSessionGuest(orderData);
      window.location.href = res.url;
    } catch (err) {
      alert("Errore durante il pagamento: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ---------- LOGICA DEL PULSANTE ----------
  const handleProceed = () => {
    if (token) handleStripeCheckoutAuth();
    else setShowCheckout(true);
  };

  // ---------- UI ----------
  if (items.length === 0) {
    return (
      <Container className="py-5 container-base flex-column">
        <h2>🛒 Il tuo carrello è vuoto</h2>
        <Link to="/prodotti">
          <Button variant="dark" className="mt-3">
            Vai ai prodotti
          </Button>
        </Link>
      </Container>
    );
  }

  return (
    <Container className="py-5 cotainer-base flex-column">
      <h2 className="mb-4">Il tuo carrello</h2>

      <ListGroup variant="flush">
        {items.map(item => (
          <ListGroup.Item key={item.productId} className="py-3">
            <Row className="align-items-center border rounded card-cart">
              <Col xs={3} md={2}>
                <Image src={item.image} alt={item.name} fluid rounded />
              </Col>

              <Col xs={9} md={4}>
                <h5 onClick={() => navigate(`/prodotti/${item.productId}`)} className="cart-product-name" style={{ cursor: "pointer" }}>
                  {item.name}
                </h5>
                <p className="text-muted mb-1">€ {item.price.toFixed(2)} cad.</p>
                <p className="text-muted small">Disponibilità: {item.stock}</p>
              </Col>

              <Col xs={6} md={3} className="d-flex align-items-center gap-2">
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => dispatch(updateCartQuantity({ productId: item.productId, quantity: Math.max(1, item.quantity - 1) }))}
                >
                  <Dash size={20} />
                </Button>

                <span>{item.quantity}</span>

                <Button
                  variant="outline-secondary"
                  size="sm"
                  disabled={item.quantity >= item.stock}
                  onClick={() => dispatch(updateCartQuantity({ productId: item.productId, quantity: item.quantity + 1 }))}
                >
                  <Plus size={20} />
                </Button>
              </Col>

              <Col xs={4} md={2}>
                <strong>€ {(item.price * item.quantity).toFixed(2)}</strong>
              </Col>

              <Col xs={2} md={1}>
                <Button variant="outline-danger" size="sm" onClick={() => dispatch(removeFromCart(item.productId))}>
                  <Trash size={24} />
                </Button>
              </Col>
            </Row>
          </ListGroup.Item>
        ))}
      </ListGroup>

      <div className="d-flex justify-content-end mt-4">
        <h4 className="cart-total">Totale: € {totalPrice.toFixed(2)}</h4>
      </div>

      <div className="d-flex justify-content-end mt-3">
        <Button variant="success" size="lg" className="cart-checkout-btn" onClick={handleProceed} disabled={loading}>
          {loading ? <Spinner animation="border" size="sm" /> : "Procedi al checkout"}
        </Button>
      </div>

      <CheckoutModal
        show={showCheckout}
        onHide={() => setShowCheckout(false)}
        onConfirm={handleStripeCheckoutGuest}
        totalPrice={totalPrice}
        cartItems={items}
      />
    </Container>
  );
};

export default CartPage;
