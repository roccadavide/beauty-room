import { useEffect } from "react";

export function useSplashScreen() {
  useEffect(() => {
    const minDelay = new Promise(resolve => setTimeout(resolve, 2000));
    const fontsReady = document.fonts.ready;

    Promise.all([minDelay, fontsReady]).then(() => {
      const splash = document.getElementById("splash-screen");
      const root = document.getElementById("root");

      if (splash) {
        splash.classList.add("splash-hidden");
        splash.addEventListener("transitionend", () => splash.remove(), { once: true });
      }

      if (root) {
        root.classList.add("app-visible");
      }
    });
  }, []);
}
