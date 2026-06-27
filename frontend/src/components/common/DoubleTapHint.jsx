import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./DoubleTapHint.css";

const SESSION_KEY = "br_dtap_hint_session";

const DoubleTapHint = () => {
  const [pos, setPos] = useState(null); // viewport coords {x, y} or null = hidden
  const timers = useRef([]);
  const observerRef = useRef(null);

  useEffect(() => {
    try {
      if (localStorage.getItem("br_like_seen")) return; // utente ha già scoperto i like
      if (sessionStorage.getItem(SESSION_KEY)) return; // già mostrato in questa sessione
    } catch {}

    let pollId = null;

    const showNow = () => {
      const isWide = window.matchMedia("(min-width: 768px)").matches;
      let x, y;
      if (isWide) {
        // tablet + desktop: centro viewport
        x = window.innerWidth / 2;
        y = window.innerHeight / 2;
      } else {
        // phone: centro della prima card, in coordinate viewport (overlay ora fixed)
        const card = document.querySelector(".g-4 > *, .g-xl-5 > *");
        if (!card) return;
        const r = card.getBoundingClientRect();
        x = r.left + r.width / 2;
        y = r.top + r.height / 2;
      }
      setPos({ x, y });
      try {
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch {}
      timers.current.push(setTimeout(() => setPos(null), 7000));
    };

    const tryObserve = () => {
      const card = document.querySelector(".g-4 > *, .g-xl-5 > *");
      if (!card) {
        pollId = setTimeout(tryObserve, 300);
        return;
      }

      observerRef.current = new IntersectionObserver(
        entries => {
          if (!entries[0].isIntersecting) return;
          observerRef.current?.disconnect();
          timers.current.push(setTimeout(showNow, 400));
        },
        { threshold: 0.6 },
      );
      observerRef.current.observe(card);
    };

    tryObserve();
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      if (pollId) clearTimeout(pollId);
      observerRef.current?.disconnect();
    };
  }, []);

  if (!pos) return null;

  return createPortal(
    <div className="dth-overlay" style={{ top: pos.y, left: pos.x }}>
      <div className="dth-tap dth-tap--1" />
      <div className="dth-tap dth-tap--2" />
      <div className="dth-badge">
        <span className="dth-heart">❤</span>
        <span className="dth-label">Doppio tap per mettere mi piace</span>
      </div>
    </div>,
    document.body,
  );
};

export default DoubleTapHint;
