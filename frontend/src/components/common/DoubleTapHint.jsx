import { useEffect, useRef, useState } from "react";
import "./DoubleTapHint.css";

const LS_KEY = "br_dtap_hint_seen";

const DoubleTapHint = () => {
  const [visible, setVisible] = useState(false);
  const [cardRect, setCardRect] = useState(null);
  const observerRef = useRef(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(LS_KEY)) return;
    } catch {}

    let showTimer, hideTimer;

    const tryObserve = () => {
      const card = document.querySelector(".g-4 > *, .g-xl-5 > *");
      if (!card) {
        setTimeout(tryObserve, 300);
        return;
      }

      observerRef.current = new IntersectionObserver(
        entries => {
          if (!entries[0].isIntersecting) return;
          observerRef.current?.disconnect();

          const rect = card.getBoundingClientRect();
          setCardRect({
            top: rect.top + window.scrollY,
            left: rect.left + window.scrollX,
            width: rect.width,
            height: rect.height,
          });

          showTimer = setTimeout(() => setVisible(true), 400);
          hideTimer = setTimeout(() => {
            setVisible(false);
            try {
              localStorage.setItem(LS_KEY, "1");
            } catch {}
          }, 7000);
        },
        { threshold: 0.6 },
      );
      observerRef.current.observe(card);
    };

    tryObserve();
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      observerRef.current?.disconnect();
    };
  }, []);

  if (!visible || !cardRect) return null;

  const cx = cardRect.left + cardRect.width / 2;
  const cy = cardRect.top + cardRect.height / 2;

  return (
    <div className="dth-overlay" style={{ top: cy, left: cx }}>
      <div className="dth-tap dth-tap--1" />
      <div className="dth-tap dth-tap--2" />
      <div className="dth-badge">
        <span className="dth-heart">❤</span>
        <span className="dth-label">Doppio tap per mettere mi piace</span>
      </div>
    </div>
  );
};

export default DoubleTapHint;
