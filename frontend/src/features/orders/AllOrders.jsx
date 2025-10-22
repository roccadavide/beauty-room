import { useEffect, useState } from "react";
import { Container, Spinner, Card, Badge, ListGroup, Row, Col, Image, Button } from "react-bootstrap";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Trash2Fill } from "react-bootstrap-icons";
import DeleteOrderModal from "./DeleteOrderModal";
import { deleteOrder, fetchOrders } from "../../api/modules/orders.api";
import { fetchProductById } from "../../api/modules/products.api";

const AllOrders = () => {
  const [allOrders, setAllOrders] = useState([]);
  const [products, setProducts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const navigate = useNavigate();

  const { token } = useSelector(state => state.auth);

  // ---------- FETCH ORDINI ----------
  useEffect(() => {
    const loadData = async () => {
      try {
        const orders = await fetchOrders(token);
        setAllOrders(orders.content);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [token]);

  const getProduct = async id => {
    if (products[id]) return products[id];
    try {
      const prod = await fetchProductById(id);
      setProducts(prev => ({ ...prev, [id]: prod }));
      return prod;
    } catch (err) {
      console.error("Errore caricamento prodotto", err);
      return null;
    }
  };

  useEffect(() => {
    if (allOrders.length > 0) {
      allOrders.forEach(order => {
        order.orderItems.forEach(item => {
          getProduct(item.productId);
        });
      });
    }
  });

  // ---------- DELETE ----------
  const handleDeleteConfirm = async id => {
    try {
      await deleteOrder(id, token);
      setAllOrders(prev => prev.filter(o => o.orderId !== id));
      setDeleteModal(false);
      setSelectedOrder(null);
    } catch (err) {
      alert("Errore durante l'eliminazione: " + err.message);
    }
  };

  // ---------- UI ----------
  if (loading) {
    return (
      <Container className="text-center container-base">
        <Spinner animation="border" role="status" />
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="container-base">
        <p className="text-danger">{error}</p>
      </Container>
    );
  }

  return (
    <Container className="py-5 container-base flex-column">
      <h2 className="mb-4">📦 Tutti gli ordini</h2>

      {allOrders.length === 0 && <p>Non sono ancora stati effetuati ordini.</p>}

      {allOrders.map(order => (
        <Card key={order.orderId} className="mb-4 shadow-sm order-card w-100">
          <Card.Body>
            <Row>
              <Col md={5} className="mb-5">
                <h5>
                  {order.customerName} {order.customerSurname}
                </h5>
                <small className="text-muted">{new Date(order.createdAt).toLocaleString()}</small>
                <p className="mb-1">
                  <strong>Email:</strong> {order.customerEmail}
                </p>
                <p className="mb-1">
                  <strong>Telefono:</strong> {order.customerPhone}
                </p>
                <p className="mb-1">
                  <strong>Indirizzo:</strong> {order.shippingAddress}, {order.shippingCity} ({order.shippingZip}), {order.shippingCountry}
                </p>
                <strong>STATUS:</strong> <Badge bg="secondary">{order.orderStatus}</Badge>
              </Col>

              <Col md={7}>
                <div className="d-flex justify-content-between">
                  <h6>🛒 Prodotti:</h6>
                  <Button
                    variant="danger"
                    className="rounded-circle d-flex justify-content-center align-items-center"
                    onClick={e => {
                      e.stopPropagation();
                      setSelectedOrder(order);
                      setDeleteModal(true);
                    }}
                  >
                    <Trash2Fill />
                  </Button>
                </div>
                <ListGroup variant="flush">
                  {order.orderItems.map(item => {
                    const product = products[item.productId];

                    return (
                      <ListGroup.Item key={item.orderItemId} className="d-flex justify-content-between align-items-center">
                        <span style={{ width: "100%" }}>
                          <Row className="align-items-center border rounded card-cart">
                            <Col xs={3} md={2}>
                              {product ? (
                                <Image src={product.images} alt={product.name} fluid rounded />
                              ) : (
                                <div className="bg-light" style={{ height: "60px" }} />
                              )}
                            </Col>
                            <Col xs={9} md={6}>
                              <h6 onClick={() => navigate(`/prodotti/${product.productId}`)} className="cart-product-name">
                                {product ? product.name : "Caricamento..."}
                              </h6>
                              <p className="text-muted mb-1">€ {item.price.toFixed(2)} cad.</p>
                              <small>Quantità: {item.quantity}</small>
                            </Col>
                            <Col className="text-end">
                              <span>€ {(item.price * item.quantity).toFixed(2)}</span>
                            </Col>
                          </Row>
                        </span>
                      </ListGroup.Item>
                    );
                  })}
                </ListGroup>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      ))}
      <DeleteOrderModal show={deleteModal} onHide={() => setDeleteModal(false)} order={selectedOrder} onConfirm={handleDeleteConfirm} />
    </Container>
  );
};

export default AllOrders;
