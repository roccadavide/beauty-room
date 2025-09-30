import { useState, useEffect, useMemo, useRef } from "react";
import { Badge, Button, Card, Col, Container, Row, Spinner } from "react-bootstrap";
import { useSelector } from "react-redux";
import { PencilFill, Plus, Trash2Fill } from "react-bootstrap-icons";
import { fetchCategories, fetchResults, deleteResult } from "../api/api";
import ResultModal from "./ResultModal";
import DeleteResultModal from "./DeleteResultModal";

function ResultsPage() {
  const [cat, setCat] = useState("all");
  const [allResults, setAllResults] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [open, setOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);

  const [selectedResult, setSelectedResult] = useState(null);
  const [editingResult, setEditingResult] = useState(null);

  const { user, token } = useSelector(state => state.auth);

  const cardsRef = useRef([]);
  const [visibleMap, setVisibleMap] = useState({});

  // ---------- FETCH ----------
  useEffect(() => {
    const loadData = async () => {
      try {
        const [results, cats] = await Promise.all([fetchResults(), fetchCategories()]);
        setAllResults(results);
        setCategories(cats);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // ---------- OBSERVER ----------
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            setVisibleMap(prev => ({ ...prev, [e.target.dataset.id]: true }));
          }
        });
      },
      { threshold: 0.25 }
    );
    cardsRef.current.forEach(el => el && obs.observe(el));
    return () => cardsRef.current.forEach(el => el && obs.unobserve(el));
  }, [cat, allResults]);

  // ---------- CATEGORIES MAP ----------
  const categoriesMap = useMemo(() => {
    const map = {};
    categories.forEach(c => (map[c.categoryId] = c.label));
    return map;
  }, [categories]);

  // ---------- FILTER ----------
  const filtered = useMemo(() => {
    return allResults.filter(r => (cat === "all" ? true : r.categoryId === cat));
  }, [allResults, cat]);

  // ---------- DELETE ----------
  const handleDeleteConfirm = async id => {
    try {
      await deleteResult(id, token);
      setAllResults(prev => prev.filter(r => r.resultId !== id));
      setDeleteModal(false);
      setSelectedResult(null);
    } catch (err) {
      alert("Errore durante l'eliminazione: " + err.message);
    }
  };

  // ---------- EDIT ----------
  const handleEdit = result => {
    setEditingResult(result);
    setOpen(true);
  };

  // ---------- CREATE ----------
  const handleCreate = () => {
    setEditingResult(null);
    setOpen(true);
  };

  // ---------- UPDATE OR CREATE ----------
  const handleResultSaved = updatedResult => {
    if (editingResult) {
      setAllResults(prev => prev.map(r => (r.resultId === updatedResult.resultId ? updatedResult : r)));
    } else {
      setAllResults(prev => [...prev, updatedResult]);
    }
    setOpen(false);
    setEditingResult(null);
  };

  const badgeColors = {
    "036f8d73-0d71-415f-b4cb-db4711c4c586": "primary", //Trucco permanente
    "1225ed9f-c5c8-4003-97b0-50a62874de4a": "success", //Piedi
    "89bbe501-6470-46a6-9187-1e19f9241bf4": "warning", //Mani
    "a8a1465f-032b-4481-8f47-160504b6036b": "info", //Corpo
    "f39e37ff-1210-4446-8968-610d2d1d6563": "danger", //Viso
  };

  // ---------- UI ----------
  if (loading) {
    return (
      <Container className="container-base">
        <Spinner animation="border" role="status" />
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="container-base">
        <p className="text-danger">{error}</p>
      </Container>
    );
  }

  return (
    <Container fluid className="py-5 results-root" style={{ marginTop: "7rem" }}>
      <h1 className="text-center mb-3">I miei risultati</h1>
      <p className="text-center lead mb-5">Una raccolta di esempi reali dei miei trattamenti: viso, mani, make-up e altro.</p>

      <div className="d-flex flex-wrap justify-content-center gap-2 mb-4">
        <Button key="all" variant={cat === "all" ? "dark" : "outline-dark"} onClick={() => setCat("all")} className="rounded-pill px-3">
          Tutti
        </Button>
        {categories.map(c => (
          <Button
            key={c.categoryId}
            variant={cat === c.categoryId ? "dark" : "outline-dark"}
            onClick={() => setCat(c.categoryId)}
            className="rounded-pill px-3"
          >
            {c.label}
          </Button>
        ))}
      </div>

      {user?.role === "ADMIN" && (
        <div className="mb-4 d-flex align-items-center justify-content-center">
          <Button
            variant="success"
            className="rounded-circle d-flex align-items-center justify-content-center"
            style={{ width: "3rem", height: "3rem" }}
            onClick={handleCreate}
          >
            <Plus />
          </Button>
        </div>
      )}

      <Container>
        <Row className="g-4 justify-content-center">
          {filtered.map((res, idx) => (
            <Col key={res.resultId} xs={12} sm={6} md={4} lg={3} className="d-flex justify-content-center">
              <Card
                data-id={res.resultId}
                ref={el => (cardsRef.current[idx] = el)}
                className={`results-card border-0 rounded-4 shadow-sm ${visibleMap[res.resultId] ? "visible" : ""}`}
              >
                <Card.Img src={res.images?.[0]} alt={res.title} className="results-img rounded-top-4" />
                <Card.Body className="d-flex flex-column">
                  <Card.Title className="mb-1">{res.title}</Card.Title>
                  <div className="mb-2 d-flex align-items-center justify-content-between">
                    <Badge bg={badgeColors[res.categoryId] || "secondary"} className="text-uppercase">
                      {categoriesMap[res.categoryId] || "Altro"}
                    </Badge>
                    {res.date && <small className="text-muted">{new Date(res.date).toLocaleDateString()}</small>}
                  </div>
                  <Card.Text className="flex-grow-1 small text-muted">{res.shortDescription}</Card.Text>

                  {user?.role === "ADMIN" && (
                    <div className="d-flex gap-2 justify-content-end">
                      <Button
                        variant="secondary"
                        className="rounded-circle d-flex justify-content-center align-items-center"
                        onClick={e => {
                          e.stopPropagation();
                          handleEdit(res);
                        }}
                      >
                        <PencilFill />
                      </Button>
                      <Button
                        variant="danger"
                        className="rounded-circle d-flex justify-content-center align-items-center"
                        onClick={e => {
                          e.stopPropagation();
                          setSelectedResult(res);
                          setDeleteModal(true);
                        }}
                      >
                        <Trash2Fill />
                      </Button>
                    </div>
                  )}
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
        {filtered.length === 0 && <p className="text-center text-muted mt-4">Nessun risultato in questa categoria.</p>}
      </Container>

      {user?.role === "ADMIN" && (
        <>
          <ResultModal
            show={open}
            onHide={() => {
              setOpen(false);
              setEditingResult(null);
            }}
            categories={categories}
            result={editingResult}
            onResultSaved={handleResultSaved}
          />

          <DeleteResultModal show={deleteModal} onHide={() => setDeleteModal(false)} result={selectedResult} onConfirm={handleDeleteConfirm} />
        </>
      )}
    </Container>
  );
}

export default ResultsPage;
