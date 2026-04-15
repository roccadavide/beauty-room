import { Container } from "react-bootstrap";

export default function MyOrdersSkeleton() {
  return (
    <div className="mo-page">
      <Container>
        <div className="mo-header">
          <div className="sk sk-eyebrow" />
          <div className="sk sk-title" />
          <div className="sk sk-line" style={{ width: "40%" }} />
        </div>

        <div className="mo-list">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="mo-card">
              <div className="mo-card-header d-flex justify-content-between align-items-center">
                <div className="sk sk-line" style={{ width: "40%", marginBottom: 0 }} />
                <div className="sk sk-pill" />
              </div>
              <div className="mo-items-preview">
                {[...Array(3)].map((_, j) => (
                  <div key={j} className="sk" style={{ width: 56, height: 56, borderRadius: 8, flexShrink: 0 }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Container>
    </div>
  );
}
