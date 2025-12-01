import { useEffect } from "react";
import { getLenis } from "./useLenis";

export default function useLenisModalLock(isOpen) {
  useEffect(() => {
    const lenis = getLenis();
    if (!lenis) return;

    if (isOpen) {
      lenis.stop();
    } else {
      lenis.start();
    }
  }, [isOpen]);
}
