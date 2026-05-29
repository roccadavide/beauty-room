import { useEffect, useState } from "react";

// Physical pointer + hover (mouse/trackpad+keyboard) → side-drawer.
// Everything else (touch, virtual keyboard) → route page. NO width clause:
// a small laptop qualifies, a 13" iPad does NOT. A device's screen size is
// irrelevant — what matters is whether it pops a virtual keyboard.
const QUERY = "(hover: hover) and (pointer: fine)";

export default function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== "undefined" && window.matchMedia(QUERY).matches);

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const onChange = e => setIsDesktop(e.matches);
    mq.addEventListener("change", onChange);
    setIsDesktop(mq.matches);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return isDesktop;
}
