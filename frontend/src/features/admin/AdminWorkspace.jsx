import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { WorkspaceContext } from "./WorkspaceContext";
import WorkspaceSwitch from "./WorkspaceSwitch";
import { fetchExpiringCount } from "../../api/modules/postits.api";

// Lazy-split the heavy views (mirrors how App.jsx splits admin pages). Only the
// active one is ever mounted, so the inactive view's effects — the agenda's
// now-line interval, the clients' fetches — never run, and their fixed-position
// elements never coexist.
const AdminAgendaPage = lazy(() => import("../../components/admin/AdminAgendaPage"));
const ClientsHub = lazy(() => import("./clients/ClientsHub"));
const PostItPanel = lazy(() => import("./postit/PostItPanel"));

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
  const viewParam = searchParams.get("view");
  const view = viewParam === "clienti" ? "clienti" : viewParam === "postit" ? "postit" : "agenda";
  const customerId = searchParams.get("customerId");

  const setView = useCallback(
    next => {
      const sp = new URLSearchParams(searchParams);
      // "agenda" is the default → keep the URL clean (no ?view=). Preserve any
      // customerId deep-link param across the switch.
      if (next === "clienti" || next === "postit") sp.set("view", next);
      else sp.delete("view");
      setSearchParams(sp);
    },
    [searchParams, setSearchParams]
  );

  // Overdue post-it badge on the switch: single lightweight count (same source as
  // the NavBar badge). Refetched after any in-panel mutation via onMutate.
  const [postitCount, setPostitCount] = useState(0);
  const refreshPostitCount = useCallback(() => {
    fetchExpiringCount().then(setPostitCount).catch(() => {});
  }, []);
  useEffect(() => { refreshPostitCount(); }, [refreshPostitCount]);

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
        <WorkspaceSwitch postitBadge={postitCount} />
      </div>
      <Suspense fallback={<div className="aw-loading" />}>
        {/* key={view} re-triggers the opacity fade on every switch. */}
        <div key={view} className="aw-fade">
          {view === "agenda" ? (
            <AdminAgendaPage />
          ) : view === "clienti" ? (
            <ClientsHub customerId={customerId} />
          ) : (
            <PostItPanel onMutate={refreshPostitCount} />
          )}
        </div>
      </Suspense>
    </WorkspaceContext.Provider>
  );
}
