import { Modal, Button } from "react-bootstrap";

const DeleteOrderModal = ({ show, onHide, order, onConfirm }) => {
  if (!order) return null;

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Conferma eliminazione</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        Sei sicuro di voler eliminare l'ordine <strong>{order.orderId}</strong>? Questa azione non può essere annullata.
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Annulla
        </Button>
        <Button variant="danger" onClick={() => onConfirm(order.orderId)}>
          Elimina
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default DeleteOrderModal;
