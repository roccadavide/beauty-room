import { lazy, Suspense, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { WorkspaceContext } from "./WorkspaceContext";
import WorkspaceSwitch from "./WorkspaceSwitch";

// Lazy-split the two heavy views (mirrors how App.jsx splits admin pages). Only
// the active one is ever mounted, so the inactive view's effects — the agenda's
// now-line interval, the clients' fetches — never run, and their fixed-position
// elements never coexist.
const AdminAgendaPage = lazy(() => import("../../components/admin/AdminAgendaPage"));
const ClientsHub = lazy(() => import("./clients/ClientsHub"));

/**
 * Thin shell hosting the admin workspace at /profilo/admin/agenda. Holds the
 * `view` state synced to the `?view=` query param (default "agenda") and HARD-SWAPS
 * between the agenda and the clients hub — exactly one is mounted at a time.
 *
 * The incoming view fades in with OPACITY ONLY (see .aw-fade): the fade wrapper must
 * never set transform/filter/perspective/backdrop-filter/contain/will-change:transform,
 * any of which would create a containing block that captures the inline
 * position:fixed elements (agenda FAB/snackbar/confirm-overlay; clients
 * ep-backdrop/verify-toast) and drift them to the page bottom.
 */
export default function AdminWorkspace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get("view") === "clienti" ? "clienti" : "agenda";
  const customerId = searchParams.get("customerId");

  const setView = useCallback(
    next => {
      const sp = new URLSearchParams(searchParams);
      // "agenda" is the default → keep the URL clean (no ?view=). Preserve any
      // customerId deep-link param across the switch.
      if (next === "clienti") sp.set("view", "clienti");
      else sp.delete("view");
      setSearchParams(sp);
    },
    [searchParams, setSearchParams]
  );

  const ctx = useMemo(() => ({ view, setView }), [view, setView]);

  return (
    <WorkspaceContext.Provider value={ctx}>
      {/* Persistent workspace switch — lifted out of both views so it no longer
          relocates on swap. It is a DOM SIBLING of .aw-fade (never a parent): the
          bar must not become a transformed/filtered ancestor of the views' inline
          position:fixed elements (it stays a plain in-flow block — see .aw-topbar).
          data-view drives a per-view background so the bar blends into the active
          page instead of reading as a separate floating bar. */}
      <div className="aw-topbar" data-view={view}>
        <WorkspaceSwitch />
      </div>
      <Suspense fallback={<div className="aw-loading" />}>
        {/* key={view} re-triggers the opacity fade on every switch. */}
        <div key={view} className="aw-fade">
          {view === "agenda" ? <AdminAgendaPage /> : <ClientsHub customerId={customerId} />}
        </div>
      </Suspense>
    </WorkspaceContext.Provider>
  );
}
