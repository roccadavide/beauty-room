import { useEffect } from "react";
import { popLenisLock, pushLenisLock } from "./useLenis";

// Ref-counted Lenis lock for overlay surfaces (UnifiedDrawer, PromoDetailDrawer, …).
// Delegates to the shared pushLenisLock/popLenisLock counter so it can't fight the
// other lock holders (EstimatoModal, the appointment drawer, …): Lenis is stopped
// while ≥1 surface is open and restarted only when the LAST one releases.
//
// The release lives in the effect *cleanup*, so it runs whether the surface animates
// closed (isOpen → false) OR is unmounted outright — e.g. the agenda rate drawer,
// rendered as `{cond && <Drawer/>}`, which unmounts with isOpen still true. The old
// body-only lenis.stop()/start() skipped the release on unmount and leaked a permanent
// lock (and spuriously start()ed Lenis whenever any consumer mounted closed).
export default function useLenisModalLock(isOpen) {
  useEffect(() => {
    if (!isOpen) return undefined;
    pushLenisLock();
    return popLenisLock;
  }, [isOpen]);
}
