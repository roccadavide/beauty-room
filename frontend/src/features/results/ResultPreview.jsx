import { useEffect, useState, useMemo } from "react";
import { Container, Row, Col, Card, Badge, Button, Spinner } from "react-bootstrap";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Plus, PencilFill, Trash2Fill } from "react-bootstrap-icons";
import ResultModal from "./ResultModal";
import DeleteResultModal from "./DeleteResultModal";
import { fetchCategories } from "../../api/modules/categories.api";
import { deleteResult, fetchResults } from "../../api/modules/results.api";

const FEATURED_RESULT_IDS = ["b01da695-f333-49dd-a337-907ccd2f01c9", "result-id-2", "result-id-3"];

const ResultsPreview = () => {
  const [results, setResults] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [open, setOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);

  const [selectedResult, setSelectedResult] = useState(null);
  const [editingResult, setEditingResult] = useState(null);

  const { user, accessToken } = useSelector(state => state.auth);
  const navigate = useNavigate();

  // ---------- FETCH ----------
  useEffect(() => {
    const loadData = async () => {
      try {
        const [allResults, cats] = await Promise.all([fetchResults(), fetchCategories()]);
        setCategories(cats);
        const featured = allResults.filter(r => FEATURED_RESULT_IDS.includes(r.resultId));
        setResults(featured);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // ---------- CATEGORIES MAP ----------
  const categoriesMap = useMemo(() => {
    const map = {};
    categories.forEach(c => {
      map[c.categoryId] = c.label;
    });
    return map;
  }, [categories]);

  // ---------- DELETE ----------
  const handleDeleteConfirm = async id => {
    try {
      await deleteResult(id, accessToken);
      setResults(prev => prev.filter(r => r.resultId !== id));
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
      setResults(prev => prev.map(r => (r.resultId === updatedResult.resultId ? updatedResult : r)));
    } else {
      setResults(prev => [...prev, updatedResult]);
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
    <Container className="py-5">
      <div className="rp-head">
        <span className="section-eyebrow">Prima &amp; Dopo</span>
        <h2 className="section-title">Risultati in evidenza</h2>
        <p className="section-subtitle">
          Trasformazioni reali delle nostre clienti, trattamento dopo trattamento.
        </p>
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

      <Row className="g-4 justify-content-evenly">
        {results.map(r => (
          <Col key={r.resultId} xs={12} sm={6} lg={4} className="d-flex">
            <div className="rp-card" onClick={() => navigate(`/risultati/${r.resultId}`)}>
              <div className="rp-img-wrap">
                <img src={r.images?.[0]} alt={r.title} />
                <div className="rp-img-overlay">
                  {r.date && (
                    <span className="rp-date">
                      {new Date(r.date).toLocaleDateString("it-IT", { month: "short", year: "numeric" })}
                    </span>
                  )}
                </div>
              </div>
              <div className="rp-body">
                <div className="rp-accent-line" />
                <h3 className="rp-title">{r.title}</h3>
                <Badge bg={badgeColors[r.categoryId] || "secondary"} className="text-uppercase rp-badge">
                  {categoriesMap[r.categoryId] || "Altro"}
                </Badge>
                <p className="rp-desc">{r.shortDescription}</p>
                {user?.role === "ADMIN" && (
                  <div
                    className="rp-admin"
                    onClick={e => {
                      e.stopPropagation();
                    }}
                  >
                    <Button
                      variant="secondary"
                      size="sm"
                      className="rounded-circle d-flex justify-content-center align-items-center"
                      onClick={() => handleEdit(r)}
                    >
                      <PencilFill />
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      className="rounded-circle d-flex justify-content-center align-items-center"
                      onClick={() => {
                        setSelectedResult(r);
                        setDeleteModal(true);
                      }}
                    >
                      <Trash2Fill />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Col>
        ))}
      </Row>

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
};

export default ResultsPreview;
