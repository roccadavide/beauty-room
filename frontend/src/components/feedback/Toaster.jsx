import { Toast, ToastContainer } from "react-bootstrap";
import { useEffect, useState } from "react";

export default function Toaster({
  text = "Operazione completata con successo!",
  variant = "success",
  delay = 3000,
  show = true,
  onClose,
  position = "top-end",
}) {
  const [visible, setVisible] = useState(show);

  useEffect(() => setVisible(show), [show]);

  const handleClose = () => {
    setVisible(false);
    onClose?.();
  };

  const isLightBg = variant === "warning" || variant === "light" || variant === "info";
  const textClass = isLightBg ? "text-dark" : "text-white";

  return (
    <ToastContainer position={position} className="p-3">
      <Toast bg={variant} show={visible} onClose={handleClose} delay={delay} autohide className="shadow-lg border-0 rounded-3">
        <Toast.Body className={`${textClass} fw-semibold`}>{text}</Toast.Body>
      </Toast>
    </ToastContainer>
  );
}
