import { Modal, Button } from "react-bootstrap";

const DeleteBookingModal = ({ show, onHide, booking, onConfirm }) => {
  if (!booking) return null;

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Conferma eliminazione</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        Sei sicuro di voler eliminare la prenotazione del <strong>{new Date(booking.startTime).toLocaleString()}</strong>? Questa azione non può essere
        annullata.
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Annulla
        </Button>
        <Button variant="danger" onClick={() => onConfirm(booking.bookingId)}>
          Elimina
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default DeleteBookingModal;
