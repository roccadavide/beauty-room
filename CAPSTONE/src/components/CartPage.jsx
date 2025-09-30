import { useDispatch, useSelector } from "react-redux";
import { Container, Row, Col, ListGroup, Image, Button } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import { Dash, Plus, Trash } from "react-bootstrap-icons";
import { removeFromCart, updateCartQuantity } from "../redux/action/cartActions";
import { useState } from "react";
import CheckoutModal from "./CheckoutModal";

const CartPage = () => {
  const { items, totalPrice } = useSelector(state => state.cart);
  const { user } = useSelector(state => state.auth);
  const [showCheckout, setShowCheckout] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <Container className="py-5 container-base flex-column">
        <h2>🛒 Il tuo carrello è vuoto </h2>
        <Link to="/prodotti">
          <Button variant="dark" className="mt-3">
            Vai ai prodotti
          </Button>
        </Link>
      </Container>
    );
  }

  return (
    <Container className="py-5" style={{ marginTop: "7rem" }}>
      <h2 className="mb-4">Il tuo carrello</h2>
      <ListGroup variant="flush">
        {items.map(item => (
          <ListGroup.Item key={item.productId} className="py-3">
            <Row className="align-items-center border rounded card-cart">
              <Col xs={3} md={2}>
                <Image src={item.image} alt={item.name} fluid rounded />
              </Col>

              <Col xs={9} md={4}>
                <h5 onClick={() => navigate(`/prodotti/${item.productId}`)} className="cart-product-name">
                  {item.name}
                </h5>
                <p className="text-muted mb-1">€ {item.price.toFixed(2)} cad.</p>
                <p className="text-muted small">Disponibilità: {item.stock}</p>
              </Col>

              <Col xs={6} md={3} className="d-flex align-items-center gap-2">
                <Button
                  variant="outline-secondary"
                  className="d-flex align-items-center justify-content-center"
                  size="sm"
                  onClick={() => dispatch(updateCartQuantity(item.productId, Math.max(1, item.quantity - 1)))}
                >
                  <Dash size={20} />
                </Button>

                <span>{item.quantity}</span>

                <Button
                  variant="outline-secondary"
                  size="sm"
                  className="d-flex align-items-center justify-content-center"
                  disabled={item.quantity >= item.stock}
                  onClick={() => dispatch(updateCartQuantity(item.productId, item.quantity + 1))}
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
        <Button variant="success" size="lg" className="cart-checkout-btn" onClick={() => setShowCheckout(true)}>
          Procedi al checkout
        </Button>
      </div>

      <CheckoutModal show={showCheckout} onHide={() => setShowCheckout(false)} user={user} />
    </Container>
  );
};

export default CartPage;
