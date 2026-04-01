import { useRef, useState } from "react";
import { compressImage } from "../../api/utils/multipart";

/**
 * Componente riusabile per upload multi-immagine con:
 * - drag-and-drop, compressione Canvas, preview thumbnail
 * - rimozione immagini esistenti (Cloudinary), riordino nuove immagini
 *
 * Props (stato gestito dal PARENT — componente uncontrolled):
 *   files            File[]      – nuove immagini selezionate (già compresse)
 *   existingUrls     string[]    – URL immagini già salvate (default [])
 *   onChange         (File[]) => void
 *   onRemoveExisting (url: string) => void
 *   maxFiles         number      – default 8
 *   label            string      – default "Immagini"
 */
const MultiImageUpload = ({ files = [], existingUrls = [], onChange, onRemoveExisting, maxFiles = 8, label = "Immagini" }) => {
  const inputRef = useRef(null);
  const [compressing, setCompressing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const totalCount = existingUrls.length + files.length;
  const remaining = maxFiles - totalCount;

  // ── File input / drop ──────────────────────────────────────────
  const processFiles = async incoming => {
    const allowed = Math.max(0, maxFiles - totalCount);
    if (!allowed) return;
    const toProcess = Array.from(incoming).slice(0, allowed);
    setCompressing(true);
    try {
      const compressed = await Promise.all(toProcess.map(f => compressImage(f)));
      onChange([...files, ...compressed]);
    } finally {
      setCompressing(false);
    }
  };

  const handleDrop = e => {
    e.preventDefault();
    setDragOver(false);
    processFiles(e.dataTransfer.files);
  };

  const handleInputChange = e => {
    processFiles(e.target.files);
    // Reset value so the same file can be re-selected
    e.target.value = "";
  };

  // ── Drag-to-reorder new images ─────────────────────────────────
  const handleDragStart = (e, idx) => {
    setDragIndex(idx);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(idx));
  };

  const handleDragOver = (e, idx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (idx !== dragIndex) {
      setDragOverIndex(idx);
      // Real-time swap
      if (dragIndex !== null && idx !== dragIndex) {
        const next = [...files];
        const [moved] = next.splice(dragIndex, 1);
        next.splice(idx, 0, moved);
        onChange(next);
        setDragIndex(idx);
      }
    }
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  // ── Helpers ────────────────────────────────────────────────────
  const formatSize = bytes => {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    return `${Math.round(bytes / 1024)}KB`;
  };

  const isFirstExisting = existingUrls.length > 0;

  return (
    <div className="miu-root">
      {label && <div className="miu-label">{label}</div>}

      {/* ── Thumbnail grid ── */}
      {(existingUrls.length > 0 || files.length > 0) && (
        <div className="miu-grid">
          {/* Existing images (Cloudinary) */}
          {existingUrls.map((url, i) => (
            <div key={url} className="miu-item miu-item--existing">
              <img src={url} alt={`Immagine ${i + 1}`} className="miu-img" />
              {i === 0 && <span className="miu-badge">Principale</span>}
              <button type="button" className="miu-remove" onClick={() => onRemoveExisting(url)} aria-label="Rimuovi immagine">
                ×
              </button>
            </div>
          ))}

          {/* New files */}
          {files.map((file, i) => {
            const isPrimary = !isFirstExisting && i === 0;
            const preview = URL.createObjectURL(file);
            return (
              <div
                key={i}
                className={[
                  "miu-item",
                  "miu-item--new",
                  dragIndex === i ? "miu-item--dragging" : "",
                  dragOverIndex === i && dragIndex !== i ? "miu-item--dragover" : "",
                ].join(" ")}
                draggable
                onDragStart={e => handleDragStart(e, i)}
                onDragOver={e => handleDragOver(e, i)}
                onDragEnd={handleDragEnd}
              >
                <img src={preview} alt={`Nuova ${i + 1}`} className="miu-img" />
                {isPrimary && <span className="miu-badge">Principale</span>}
                <span className="miu-size">{formatSize(file.size)}</span>
                <div className="miu-handle" aria-hidden="true">
                  ⠿
                </div>
                <button type="button" className="miu-remove" onClick={() => onChange(files.filter((_, j) => j !== i))} aria-label="Rimuovi immagine">
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Compression indicator ── */}
      {compressing && <div className="miu-compressing">Comprimo le immagini…</div>}

      {/* ── Drop zone ── */}
      {totalCount >= maxFiles ? (
        <p className="miu-limit">Limite di {maxFiles} immagini raggiunto.</p>
      ) : (
        <div
          className={["miu-drop", dragOver ? "miu-drop--over" : ""].join(" ")}
          onClick={() => inputRef.current?.click()}
          onDragOver={e => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === "Enter" && inputRef.current?.click()}
          aria-label="Carica immagini"
        >
          <div className="miu-drop__icon">📷</div>
          <div className="miu-drop__hint">
            <strong>Clicca o trascina</strong> le immagini qui
            {remaining < maxFiles && (
              <>
                {" "}
                · ancora <strong>{remaining}</strong> slot{remaining !== 1 ? "" : ""}
              </>
            )}
          </div>
        </div>
      )}

      <input ref={inputRef} type="file" multiple accept="image/*" style={{ display: "none" }} onChange={handleInputChange} />
    </div>
  );
};

export default MultiImageUpload;
