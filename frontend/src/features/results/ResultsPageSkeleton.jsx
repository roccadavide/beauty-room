import { Container } from "react-bootstrap";

export default function ResultsPageSkeleton() {
  return (
    <div className="results-root">
      <Container fluid="xl" className="px-3 px-md-4">
        <div className="sp-page-head">
          <div className="sk sk-eyebrow mx-auto" />
          <div className="sk sk-page-title mx-auto" style={{ maxWidth: 300 }} />
          <div className="sk sk-subtitle mx-auto" style={{ maxWidth: 500 }} />
        </div>

        <div className="sp-filter-bar">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="sk sk-chip" />
          ))}
        </div>

        <div className="sp-search-wrap">
          <div className="sk sk-line w-100" style={{ height: 44, borderRadius: 14, marginBottom: 0 }} />
        </div>

        <div className="rp-list">
          {[...Array(4)].map((_, i) => (
            <div key={i}>
              <div className="sk sk-img" style={{ aspectRatio: "3/2" }} />
              <div className="sk sk-title mt-3" />
              <div className="sk sk-line" />
              <div className="sk sk-line" style={{ width: "70%" }} />
            </div>
          ))}
        </div>
      </Container>
    </div>
  );
}
