import { Toast, ToastContainer } from "react-bootstrap";
import { useState, useEffect } from "react";

export default function Toaster({ text = "Operazione completata con successo!", variant = "success", delay = 3000, show = true, onClose }) {
  const [visible, setVisible] = useState(show);

  useEffect(() => {
    setVisible(show);
  }, [show]);

  const handleClose = () => {
    setVisible(false);
    if (onClose) onClose();
  };

  return (
    <ToastContainer position="top-end" className="p-3">
      <Toast bg={variant} show={visible} onClose={handleClose} delay={delay} autohide className="shadow-lg border-0 rounded-3">
        <Toast.Body className="text-white fw-semibold">{text}</Toast.Body>
      </Toast>
    </ToastContainer>
  );
}
