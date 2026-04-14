import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

export default function ImageGallery({ images = [], alt = "", aspectRatio = "4/3" }) {
  const safeImages = useMemo(() => images.filter(Boolean), [images]);
  const [current, setCurrent] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [touchStartX, setTouchStartX] = useState(null);

  const hasMany = safeImages.length > 1;
  const currentImage = safeImages[current] || safeImages[0] || "";

  useEffect(() => {
    if (current >= safeImages.length) setCurrent(0);
  }, [current, safeImages.length]);

  const prev = useCallback(() => {
    if (!hasMany) return;
    setCurrent(i => (i - 1 + safeImages.length) % safeImages.length);
  }, [hasMany, safeImages.length]);

  const next = useCallback(() => {
    if (!hasMany) return;
    setCurrent(i => (i + 1) % safeImages.length);
  }, [hasMany, safeImages.length]);

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
    window.__lenis?.start();
    document.documentElement.style.overflow = "";
  }, []);

  useEffect(() => {
    if (!lightboxOpen) return undefined;
    const onKeyDown = e => {
      if (e.key === "Escape") closeLightbox();
      if (!hasMany) return;
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightboxOpen, hasMany, closeLightbox, prev, next]);

  const openLightbox = () => {
    if (window.innerWidth < 768 || !currentImage) return;
    window.__lenis?.stop();
    document.documentElement.style.overflow = "hidden";
    setLightboxOpen(true);
  };

  const onTouchStart = e => setTouchStartX(e.changedTouches?.[0]?.clientX ?? null);
  const onTouchEnd = e => {
    if (!hasMany || touchStartX == null) return;
    const endX = e.changedTouches?.[0]?.clientX ?? touchStartX;
    const delta = endX - touchStartX;
    if (Math.abs(delta) < 50) return;
    if (delta > 0) prev();
    else next();
  };

  return (
    <div className="ig-wrap">
      <div
        className="ig-main"
        style={{ aspectRatio: aspectRatio.replace("/", " / ") }}
        onClick={openLightbox}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {currentImage ? <img src={currentImage} alt={alt} /> : <div className="ig-empty" />}
        {hasMany && (
          <>
            <button
              type="button"
              className="ig-arrow ig-arrow--prev"
              onClick={e => {
                e.stopPropagation();
                prev();
              }}
              aria-label="Immagine precedente"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              type="button"
              className="ig-arrow ig-arrow--next"
              onClick={e => {
                e.stopPropagation();
                next();
              }}
              aria-label="Immagine successiva"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </>
        )}
      </div>

      {hasMany && (
        <div className="ig-thumbs">
          {safeImages.map((url, i) => (
            <button
              type="button"
              key={`${url}-${i}`}
              className={`ig-thumb ${i === current ? "active" : ""}`}
              onClick={() => setCurrent(i)}
              aria-label={`Vai immagine ${i + 1}`}
            >
              <img src={url} alt={`${alt} ${i + 1}`} />
            </button>
          ))}
        </div>
      )}

      {lightboxOpen &&
        createPortal(
          <div className="ig-lightbox" onClick={closeLightbox}>
            <button type="button" className="ig-lightbox__close" onClick={closeLightbox} aria-label="Chiudi galleria">
              ×
            </button>
            {hasMany && (
              <>
                <button
                  type="button"
                  className="ig-arrow ig-arrow--prev"
                  onClick={e => {
                    e.stopPropagation();
                    prev();
                  }}
                  aria-label="Immagine precedente"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="ig-arrow ig-arrow--next"
                  onClick={e => {
                    e.stopPropagation();
                    next();
                  }}
                  aria-label="Immagine successiva"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </>
            )}
            <div className="ig-lightbox__img-wrap" onClick={e => e.stopPropagation()}>
              <img src={currentImage} alt={alt} />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
