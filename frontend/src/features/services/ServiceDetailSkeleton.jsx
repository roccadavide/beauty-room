import { Container } from "react-bootstrap";

export default function ServiceDetailSkeleton() {
  return (
    <Container fluid className="service-detail">
      <div className="sd-layout-grid">
        <div className="sd-col-img">
          <div className="sk sk-img" />
        </div>
        <div className="sd-col-info" style={{ paddingTop: "0.5rem" }}>
          <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem" }}>
            <div className="sk sk-badge" />
            <div className="sk sk-badge" style={{ width: 70 }} />
          </div>
          <div className="sk sk-title" />
          <div className="sk sk-line" style={{ width: "30%" }} />
          <div style={{ marginBottom: "1.5rem" }}>
            <div className="sk sk-price" />
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "2rem" }}>
            <div className="sk sk-pill" />
            <div className="sk sk-pill" />
            <div className="sk sk-pill" />
          </div>
          <div className="sk sk-btn" />
        </div>
      </div>
    </Container>
  );
}
