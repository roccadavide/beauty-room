import { useEffect, useState } from "react";
import { Modal, Button, Form, Badge, Spinner, Alert } from "react-bootstrap";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useSelector } from "react-redux";
import { createBooking, fetchAvailabilities } from "../api/api";
import { useNavigate } from "react-router-dom";

const BookingModal = ({ show, onHide, service }) => {
  const { token } = useSelector(state => state.auth);
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [date, setDate] = useState(new Date());
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState(null);

  const [slot, setSlot] = useState(null);
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "", notes: "" });

  const reset = () => {
    setStep(1);
    setSlot(null);
    setSlots([]);
    setCustomer({ name: "", email: "", phone: "", notes: "" });
  };

  useEffect(() => {
    if (step === 2 && service) {
      const loadSlots = async () => {
        try {
          setLoadingSlots(true);
          setError(null);

          const data = await fetchAvailabilities(service.serviceId, date.toISOString().split("T")[0]);

          setSlots(data.slots || []);
        } catch (err) {
          setError(err.message);
        } finally {
          setLoadingSlots(false);
        }
      };

      loadSlots();
    }
  }, [step, service, date, token]);

  const confirm = async () => {
    try {
      const payload = {
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        notes: customer.notes,
        startTime: `${date.toISOString().split("T")[0]}T${slot.start}:00`,
        endTime: `${date.toISOString().split("T")[0]}T${slot.end}:00`,
        serviceId: service.serviceId,
      };

      token ? await createBooking(payload, token) : await createBooking(payload);

      onHide();
      reset();
      navigate("/prenotazione-confermata");
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <Modal
      show={show}
      onHide={() => {
        onHide();
        reset();
      }}
      centered
      size="lg"
    >
      <Modal.Header closeButton>
        <Modal.Title>
          Prenotazione — {service?.title}{" "}
          <Badge bg="secondary" className="ms-2">
            {service?.durationMin} min
          </Badge>
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {step === 1 && (
          <>
            <h5 className="mb-3">1/4 — Seleziona la data</h5>
            <DatePicker selected={date} onChange={setDate} dateFormat="dd/MM/yyyy" minDate={new Date()} inline />
            <div className="d-flex justify-content-end mt-3">
              <Button variant="dark" onClick={() => setStep(2)}>
                Avanti
              </Button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h5 className="mb-3">2/4 — Seleziona l’orario</h5>
            {loadingSlots && <Spinner animation="border" />}
            {error && <Alert variant="danger">{error}</Alert>}
            <div className="d-flex flex-wrap gap-2">
              {slots.map(s => (
                <Button key={s.start} variant={slot?.start === s.start ? "dark" : "outline-dark"} className="rounded-pill" onClick={() => setSlot(s)}>
                  {s.start} - {s.end}
                </Button>
              ))}
              {slots.length === 0 && !loadingSlots && <p>Nessuno slot disponibile per questa data.</p>}
            </div>
            <div className="d-flex justify-content-between mt-3">
              <Button variant="outline-dark" onClick={() => setStep(1)}>
                Indietro
              </Button>
              <Button variant="dark" onClick={() => setStep(3)} disabled={!slot}>
                Avanti
              </Button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h5 className="mb-3">3/4 — I tuoi dati</h5>
            <Form className="row g-3">
              <div className="col-md-6">
                <Form.Label>Nome e Cognome</Form.Label>
                <Form.Control value={customer.name} onChange={e => setCustomer({ ...customer, name: e.target.value })} />
              </div>
              <div className="col-md-6">
                <Form.Label>Email</Form.Label>
                <Form.Control type="email" value={customer.email} onChange={e => setCustomer({ ...customer, email: e.target.value })} />
              </div>
              <div className="col-md-6">
                <Form.Label>Telefono</Form.Label>
                <Form.Control value={customer.phone} onChange={e => setCustomer({ ...customer, phone: e.target.value })} />
              </div>
              <div className="col-md-12">
                <Form.Label>Note (opzionale)</Form.Label>
                <Form.Control as="textarea" rows={3} value={customer.notes} onChange={e => setCustomer({ ...customer, notes: e.target.value })} />
              </div>
            </Form>
            <div className="d-flex justify-content-between mt-3">
              <Button variant="outline-dark" onClick={() => setStep(2)}>
                Indietro
              </Button>
              <Button variant="dark" onClick={() => setStep(4)} disabled={!customer.name || !customer.email || !customer.phone}>
                Avanti
              </Button>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h5 className="mb-3">4/4 — Riepilogo</h5>
            <ul className="list-unstyled">
              <li>
                <strong>Servizio:</strong> {service.title}
              </li>
              <li>
                <strong>Durata:</strong> {service.durationMin} min
              </li>
              <li>
                <strong>Prezzo:</strong> € {service.price}
              </li>
              <li>
                <strong>Data:</strong> {date.toLocaleDateString()}
              </li>
              <li>
                <strong>Orario:</strong> {slot?.start} - {slot?.end}
              </li>
              <li>
                <strong>Cliente:</strong> {customer.name} — {customer.phone}
              </li>
              <li>
                <strong>Email:</strong> {customer.email}
              </li>
              {customer.notes && (
                <li>
                  <strong>Note:</strong> {customer.notes}
                </li>
              )}
            </ul>
            <div className="d-flex justify-content-between mt-3">
              <Button variant="outline-dark" onClick={() => setStep(3)}>
                Indietro
              </Button>
              <Button variant="dark" onClick={confirm}>
                Conferma prenotazione
              </Button>
            </div>
          </>
        )}
      </Modal.Body>
    </Modal>
  );
};

export default BookingModal;
