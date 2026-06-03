import { Container } from "react-bootstrap";

export default function OccasioniPageSkeleton() {
  return (
    <Container fluid className="py-4 px-3">
      <div className="text-center mb-4">
        <div className="sk sk-eyebrow mx-auto mb-3" />
        <div className="sk sk-page-title mx-auto mb-3" style={{ maxWidth: 300 }} />
        <div className="sk sk-subtitle mx-auto" style={{ maxWidth: 420 }} />
      </div>

      <div className="of-tab-bar">
        <div className="sk sk-chip" />
        <div className="sk sk-chip" />
      </div>

      <Container>
        <div className="promo-grid">
          {[...Array(3)].map((_, i) => (
            <div key={i}>
              <div className="sk sk-img" />
              <div className="sk sk-title mt-3" />
              <div className="sk sk-line" style={{ width: "60%" }} />
              <div className="sk sk-btn" style={{ width: "50%" }} />
            </div>
          ))}
        </div>
      </Container>
    </Container>
  );
}
