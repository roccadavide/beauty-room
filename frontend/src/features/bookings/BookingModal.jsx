import { useEffect, useState } from "react";
import { Modal, Button, Form, Badge, Spinner, Alert } from "react-bootstrap";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useSelector } from "react-redux";
import { fetchAvailabilities } from "../../api/modules/availabilities.api";
import useLenisModalLock from "../../hooks/useLenisModalLock";
import { createBookingCheckoutSessionAuth, createBookingCheckoutSessionGuest } from "../../api/modules/stripe.api";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^\+?[0-9]{7,15}$/;

const BookingModal = ({ show, onHide, service }) => {
  const { accessToken, user } = useSelector(state => state.auth);

  const [step, setStep] = useState(1);
  const [date, setDate] = useState(new Date());
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState(null);

  const [slot, setSlot] = useState(null);
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "", notes: "" });
  const [errors, setErrors] = useState({});

  const reset = () => {
    setStep(1);
    setSlot(null);
    setSlots([]);
    setCustomer({ name: "", email: "", phone: "", notes: "" });
    setErrors({});
    setError(null);
  };

  useLenisModalLock(show);

  useEffect(() => {
    if (step === 2 && service) {
      const loadSlots = async () => {
        try {
          setLoadingSlots(true);
          setError(null);

          if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
            throw new Error("Data non valida selezionata.");
          }

          const day = date.toLocaleDateString("sv-SE");
          const data = await fetchAvailabilities(service.serviceId, day);

          setSlots(data.slots || []);
        } catch (err) {
          setError(err.message);
        } finally {
          setLoadingSlots(false);
        }
      };

      loadSlots();
    }
  }, [step, service, date]);

  const handleCustomerChange = (field, value) => {
    setCustomer(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: null }));
  };

  const validate = () => {
    const err = {};
    if (!customer.name.trim()) err.name = "Il nome è obbligatorio";
    if (!emailRegex.test(customer.email)) err.email = "Email non valida";
    if (!phoneRegex.test(customer.phone)) err.phone = "Numero di telefono non valido";
    return err;
  };

  const goToSummary = () => {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors);
      return;
    }
    setStep(4);
  };

  const confirm = async () => {
    try {
      setError(null);

      if (!service?.serviceId) throw new Error("Servizio non valido.");
      if (!slot?.start) throw new Error("Seleziona uno slot.");

      if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        throw new Error("Data non valida selezionata.");
      }

      const day = date.toLocaleDateString("sv-SE");

      const payload = {
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        notes: customer.notes,
        startTime: `${day}T${slot.start}:00`,
        serviceId: service.serviceId,
        serviceOptionId: null, // per ora (quando aggiungi opzioni lo colleghi)
      };

      // NIENTE token param: ci pensa httpClient/interceptor
      const res = accessToken ? await createBookingCheckoutSessionAuth(payload) : await createBookingCheckoutSessionGuest(payload);

      onHide();
      reset();
      window.location.href = res.url;
    } catch (err) {
      setError(err.message || "Si è verificato un errore durante la prenotazione. Riprova più tardi.");
    }
  };

  useEffect(() => {
    if (!show || step !== 3) return;
    if (!accessToken || !user) return;

    const fullName = user.name && user.surname ? `${user.name} ${user.surname}`.trim() : (user.name || user.fullName || "").trim();

    setCustomer(prev => ({
      ...prev,
      name: prev.name.trim() ? prev.name : fullName,
      email: prev.email.trim() ? prev.email : (user.email || "").trim(),
      phone: prev.phone.trim() ? prev.phone : (user.phone || user.telefono || "").trim(),
    }));
  }, [show, step, accessToken, user]);

  return (
    <Modal
      show={show}
      onHide={() => {
        onHide();
        reset();
      }}
      scrollable
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

      <Modal.Body
        data-lenis-prevent
        style={{
          maxHeight: "80vh",
          overflowY: "auto",
          overscrollBehavior: "contain",
        }}
      >
        {error && (
          <Alert variant="danger" className="mb-3">
            {error}
          </Alert>
        )}

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
                <Form.Control value={customer.name} onChange={e => handleCustomerChange("name", e.target.value)} isInvalid={!!errors.name} />
                <Form.Control.Feedback type="invalid">{errors.name}</Form.Control.Feedback>
              </div>
              <div className="col-md-6">
                <Form.Label>Email</Form.Label>
                <Form.Control type="email" value={customer.email} onChange={e => handleCustomerChange("email", e.target.value)} isInvalid={!!errors.email} />
                <Form.Control.Feedback type="invalid">{errors.email}</Form.Control.Feedback>
              </div>
              <div className="col-md-6">
                <Form.Label>Telefono</Form.Label>
                <Form.Control value={customer.phone} onChange={e => handleCustomerChange("phone", e.target.value)} isInvalid={!!errors.phone} />
                <Form.Control.Feedback type="invalid">{errors.phone}</Form.Control.Feedback>
              </div>
              <div className="col-md-12">
                <Form.Label>Note (opzionale)</Form.Label>
                <Form.Control as="textarea" rows={3} value={customer.notes} onChange={e => handleCustomerChange("notes", e.target.value)} />
              </div>
            </Form>
            <div className="d-flex justify-content-between mt-3">
              <Button variant="outline-dark" onClick={() => setStep(2)}>
                Indietro
              </Button>
              <Button variant="dark" onClick={goToSummary}>
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
                Vai al pagamento
              </Button>
            </div>
          </>
        )}
      </Modal.Body>
    </Modal>
  );
};

export default BookingModal;
