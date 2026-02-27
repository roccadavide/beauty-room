import { useState, useEffect, useMemo, useRef } from "react";
import { Badge, Button, Card, Col, Container, Row, Spinner } from "react-bootstrap";
import { useSelector } from "react-redux";
import { PencilFill, Plus, Trash2Fill } from "react-bootstrap-icons";
import ResultModal from "./ResultModal";
import DeleteResultModal from "./DeleteResultModal";
import { deleteResult, fetchResults } from "../../api/modules/results.api";
import { fetchCategories } from "../../api/modules/categories.api";

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

  const { user, accessToken } = useSelector(state => state.auth);

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
    const targets = [...cardsRef.current].filter(Boolean);
    targets.forEach(el => obs.observe(el));
    return () => {
      targets.forEach(el => obs.unobserve(el));
      obs.disconnect();
    };
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
      await deleteResult(id, accessToken);
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
    "2ab17c92-da9c-4b18-a04a-549eaa643ad3": "primary", //Trucco permanente
    "b5915bb8-869c-46b3-a2cc-82114e8fdeb1": "success", //Piedi
    "95b6d339-a765-4569-9aee-08107d27516b": "warning", //Mani
    "7f1255a7-7c26-4bf6-972b-d285b5bc6c36": "info", //Corpo
    "ddd9e4af-8343-42ce-8f93-1b48e2d4537c": "danger", //Viso
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
    <Container fluid className="py-5 results-root conatiner-base flex-column">
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
