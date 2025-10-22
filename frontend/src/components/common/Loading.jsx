import { Spinner } from "react-bootstrap";

export default function Loading({ message = "Caricamento in corso..." }) {
  return (
    <div className="d-flex flex-column align-items-center justify-content-center py-5 text-center" style={{ minHeight: "40vh" }}>
      <Spinner animation="border" role="status" variant="primary" style={{ width: "3rem", height: "3rem" }} className="mb-3" />
      <p className="text-muted fw-medium">{message}</p>
    </div>
  );
}
