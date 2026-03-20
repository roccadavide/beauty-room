import { useCallback, useEffect, useRef, useState } from "react";
import "./BeforeAfterSlider.css";

const BeforeAfterSlider = ({ beforeSrc, afterSrc, alt = "" }) => {
  const [sliderPos, setSliderPos] = useState(50);
  const containerRef = useRef(null);
  const dragging = useRef(false);

  const calcPos = useCallback((clientX) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const raw = ((clientX - rect.left) / rect.width) * 100;
    setSliderPos(Math.min(98, Math.max(2, raw)));
  }, []);

  const startDrag = useCallback((e) => {
    dragging.current = true;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    calcPos(clientX);
  }, [calcPos]);

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      calcPos(clientX);
    };
    const onUp = () => { dragging.current = false; };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onUp);

    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onUp);
    };
  }, [calcPos]);

  return (
    <div
      className="ba-root"
      ref={containerRef}
      onMouseDown={startDrag}
      onTouchStart={startDrag}
      style={{ "--ba-pos": `${sliderPos}%` }}
      role="img"
      aria-label={`Prima e dopo: ${alt}`}
    >
      <img src={beforeSrc} alt={`Prima - ${alt}`} className="ba-img ba-before" />

      <div className="ba-after-wrap">
        <img src={afterSrc} alt={`Dopo - ${alt}`} className="ba-img ba-after" />
      </div>

      <div className="ba-handle" aria-hidden="true">
        <div className="ba-handle-line" />
        <div className="ba-handle-pill">
          <span className="ba-label-before">Prima</span>
          <span className="ba-handle-dots">⟷</span>
          <span className="ba-label-after">Dopo</span>
        </div>
        <div className="ba-handle-line" />
      </div>

      <span className="ba-corner ba-corner--tl">Prima</span>
      <span className="ba-corner ba-corner--tr">Dopo</span>
    </div>
  );
};

export default BeforeAfterSlider;
