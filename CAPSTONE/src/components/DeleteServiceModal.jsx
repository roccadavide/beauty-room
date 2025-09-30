import { Modal, Button } from "react-bootstrap";

const DeleteServiceModal = ({ show, onHide, service, onConfirm }) => {
  if (!service) return null;

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Conferma eliminazione</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        Sei sicuro di voler eliminare il servizio <strong>{service.title}</strong>? Questa azione non può essere annullata.
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Annulla
        </Button>
        <Button variant="danger" onClick={() => onConfirm(service.serviceId)}>
          Elimina
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default DeleteServiceModal;
