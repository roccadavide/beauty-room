import { useEffect, useState } from "react";
import { Container, Spinner, Card, Badge, Row, Col, Button, Image } from "react-bootstrap";
import { useSelector } from "react-redux";
import { Trash2Fill } from "react-bootstrap-icons";
import DeleteBookingModal from "./DeleteBookingModal";
import { fetchBookings, fetchServiceById, deleteBooking } from "../api/api";
import { useNavigate } from "react-router-dom";

const AllBookings = () => {
  const [allBookings, setAllBookings] = useState([]);
  const [services, setServices] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [deleteModal, setDeleteModal] = useState(false);

  const navigate = useNavigate();

  const { token } = useSelector(state => state.auth);

  // ---------- FETCH PRENOTAZIONI ----------
  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await fetchBookings(token);
        setAllBookings(res.content || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [token]);

  // ---------- FETCH SERVIZIO LEGATO ----------
  const getService = async id => {
    if (services[id]) return services[id];
    try {
      const service = await fetchServiceById(id);

      setServices(prev => ({ ...prev, [id]: service }));
      return service;
    } catch (err) {
      console.error("Errore caricamento servizio", err);
      return null;
    }
  };

  useEffect(() => {
    if (allBookings.length > 0) {
      allBookings.forEach(b => {
        if (b.serviceId) getService(b.serviceId);
      });
    }
  });

  // ---------- DELETE ----------
  const handleDeleteConfirm = async id => {
    try {
      await deleteBooking(id, token);
      setAllBookings(prev => prev.filter(b => b.bookingId !== id));
      setDeleteModal(false);
      setSelectedBooking(null);
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
      <h2 className="mb-4">📅 Tutte le prenotazioni</h2>

      {allBookings.map(booking => {
        const service = services[booking.serviceId];

        return (
          <Card key={booking.bookingId} className="mb-4 shadow-sm order-card w-100">
            <Card.Body>
              <Row>
                <Col md={5} className="mb-5">
                  <h5>{booking.customerName}</h5>
                  <small className="text-muted">Creata il {new Date(booking.createdAt).toLocaleString()}</small>
                  <p className="mb-1">
                    <strong>Email:</strong> {booking.customerEmail}
                  </p>
                  <p className="mb-1">
                    <strong>Telefono:</strong> {booking.customerPhone}
                  </p>
                  <p className="mb-1">
                    <strong>Inizio:</strong> {new Date(booking.startTime).toLocaleString()}
                  </p>
                  <p className="mb-1">
                    <strong>Fine:</strong> {new Date(booking.endTime).toLocaleString()}
                  </p>
                  {booking.notes && (
                    <p className="mb-1">
                      <strong>Note:</strong> {booking.notes}
                    </p>
                  )}
                  <strong>STATUS:</strong> <Badge bg="secondary">{booking.bookingStatus}</Badge>
                </Col>

                <Col md={7}>
                  <div className="d-flex justify-content-between align-items-center">
                    <h6>🛎 Servizio prenotato:</h6>
                    <Button
                      variant="danger"
                      className="rounded-circle d-flex justify-content-center align-items-center"
                      onClick={e => {
                        e.stopPropagation();
                        setSelectedBooking(booking);
                        setDeleteModal(true);
                      }}
                    >
                      <Trash2Fill />
                    </Button>
                  </div>
                  {service ? (
                    <Row className="align-items-center g-4">
                      <Col md={6}>
                        <Image src={service.images?.[0]} alt={service.title} fluid rounded />
                      </Col>
                      <Col md={6}>
                        <h1 className="mb-2 service-title" onClick={() => navigate(`/trattamenti/${service.serviceId}`)}>
                          {service.title}
                        </h1>
                        <div className="d-flex align-items-center gap-2 mb-3">
                          <small className="text-muted fs-5">{service.durationMin} min</small>
                        </div>
                        <h4 className="mb-4"> {service.price.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</h4>
                      </Col>
                    </Row>
                  ) : (
                    <p className="text-muted mt-2">Caricamento servizio...</p>
                  )}
                </Col>
              </Row>
            </Card.Body>
          </Card>
        );
      })}

      <DeleteBookingModal show={deleteModal} onHide={() => setDeleteModal(false)} booking={selectedBooking} onConfirm={handleDeleteConfirm} />
    </Container>
  );
};

export default AllBookings;
