import { Container, Row, Col } from "react-bootstrap";

function SkCard() {
  return (
    <Col xs={12} sm={6} xl={4} className="d-flex">
      <div style={{
        background: "#fffdf8",
        borderRadius: 20,
        border: "1px solid rgba(184,151,106,0.15)",
        overflow: "hidden",
        width: "100%",
      }}>
        <div className="sk sk-card-img" />
        <div className="sk-card-body">
          <div className="sk sk-line" style={{ width: "60%" }} />
          <div className="sk sk-line" style={{ width: "90%" }} />
          <div className="sk sk-line" style={{ width: "75%" }} />
          <div className="sk sk-line" style={{ width: "35%", marginTop: 8 }} />
        </div>
      </div>
    </Col>
  );
}

export default function ServicePageSkeleton() {
  return (
    <Container fluid className="pb-5 container-base flex-column">
      <div className="sp-page-head">
        <div className="sk sk-eyebrow" style={{ margin: "0 auto 12px" }} />
        <div className="sk sk-page-title" style={{ maxWidth: 320, margin: "0 auto 14px" }} />
        <div className="sk sk-subtitle" style={{ maxWidth: 420, margin: "0 auto" }} />
      </div>
      <div className="sp-filter-bar">
        {[1, 2, 3, 4].map(i => <div key={i} className="sk sk-chip" />)}
      </div>
      <Container fluid="xxl">
        <Row className="g-4 g-xl-5">
          {[1, 2, 3, 4, 5, 6].map(i => <SkCard key={i} />)}
        </Row>
      </Container>
    </Container>
  );
}
