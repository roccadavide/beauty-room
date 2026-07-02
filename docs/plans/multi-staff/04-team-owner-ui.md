# Prompt 04 — "Team" owner UI + STAFF login surface

**Read first:** `docs/plans/multi-staff/00-audit-report.md` (§1.A frontend auth, §2.2 matrix, §2.4). That report + this file are your only context. `FE:` = `frontend/src/`.

## Objective (one concern)

The owner-facing **Team** page (manage staff via prompt 03's API) plus the minimal frontend role plumbing so a STAFF login lands on the right screens. Frontend-only (no backend edits). With 1 active staff and no STAFF logins, every existing screen is pixel-identical (I1) — the only addition is the new owner-only page + NavBar entry.

## In scope
- New route `/admin/team` (lazy, wrapped in `PrivateRoute roles={["ADMIN"]}`) + NavBar entry visible to ADMIN only.
- `FE:features/admin/team/TeamPage.jsx` (+ small components + CSS module or scoped `.team-*` classes):
  - Staff list (active + inactive; color dot, display name, linked email, service count).
  - Create staff drawer/form: displayName, email, password, phone, color — POST `/admin/staff`; surface 409 (duplicate) inline.
  - Deactivate/reactivate toggle; on 409 show the returned list of blocking future bookings ("riassegna prima questi appuntamenti").
  - Service assignment editor: checklist of all services (reuse whatever catalog fetch the admin already uses), PUT replace-set.
  - Per-staff hours editor: 7-day morning/afternoon ranges + closed toggle — **reuse the UI pattern of the existing Impostazioni/agenda-settings hours editor** (find it; do not invent a new pattern), wired to `GET/PUT /admin/staff/{id}/working-hours`.
  - Absences: list + create per-staff `Closure` (`staffId` field) via the existing closures API; date range + optional time window, reusing the closures form pattern if one exists in Impostazioni.
- **Role plumbing for STAFF logins:**
  - `PrivateRoute` usages: shared screens → `roles={["ADMIN","STAFF"]}` for the AdminWorkspace route (`/profilo/admin/agenda`) and Notifiche; owner-only keep `["ADMIN"]`: Team, Impostazioni, agenda-settings, Report.
  - `FE:components/layout/NavBar.jsx`: STAFF sees Agenda + Notifiche only; ADMIN additionally sees Team, Impostazioni, Report.
  - Audit the other files with role checks (11 files per §0.4 — e.g. admin-only edit affordances on public pages like ProductsPage/ServicePage/ResultsPage): those are catalog-editing affordances → keep ADMIN-only (matrix rows 14–17). List each decision in your summary.
  - Login redirect: verify where post-login navigation decides ADMIN → admin area; extend so STAFF lands on `/profilo/admin/agenda` too.

## Out of scope
Backend (all done in 03). Agenda rendering (07). Drawer (08). Public flows (09). Any new npm dependency (if you think you need one, STOP and ask).

## Context budget
1. `FE:App.jsx` (routes + PrivateRoute usage), `FE:components/common/PrivateRoute.jsx`, `FE:components/layout/NavBar.jsx`.
2. The Impostazioni / agenda-settings pages (grep routes `agenda-settings`, `impostazioni`) — hours + closures editor patterns to reuse.
3. `FE:api/` client modules (httpClient + one admin api module as style reference) — add a `team.api.js` (or follow existing naming).
4. `FE:features/auth/` login redirect logic + auth slice (where `user.role` lives).
5. Grep list: `grep -rn '"ADMIN"' frontend/src` — the full role-check inventory.

## Preconditions — STOP rules
- Prompt 03 API reachable (check the controller exists in the backend tree). If endpoints differ from §2.3, adapt to reality and note it; if they're absent, STOP.
- If `PrivateRoute` doesn't support a roles array as described in §1.A, STOP and re-derive the guard mechanism before editing.

## Ordered steps
1. `team.api.js` + route + NavBar entry.
2. TeamPage list + create form + active toggle (409 handling).
3. Services checklist + hours editor + absences (reusing existing patterns).
4. Role plumbing sweep (PrivateRoute usages, NavBar, login redirect, affordance files) with a decision line per file.
5. Manual smoke via dev server: create a fake staff (against local backend), assign services, set hours, deactivate; login as that STAFF user → sees Agenda+Notifiche only, no Team/Impostazioni/Report; direct-URL to `/admin/team` as STAFF → redirected.

## Landmines (frontend conventions — CLAUDE.md)
- Drawers/overlays/toasts must `createPortal(document.body)` (PageTransition creates a containing block).
- No `window.scrollTo` — Lenis only; internal scrollables need `data-lenis-prevent`.
- Bootstrap grid intact; never wrap a Bootstrap col in `motion.div` directly (inner wrapper div).
- Viewport units: `svh`. No new npm deps. No `console.log` in final diff.
- After creating new files mid-session, Davide clears `node_modules/.vite` — note it in your summary.

## Acceptance criteria
- Owner can fully manage a staff member end-to-end from the UI.
- STAFF login: reduced NavBar, agenda reachable, owner-only routes redirect.
- With only Michela active and no STAFF user: zero visual/behavioral change outside the new page (I1).

## Test gate
`cd frontend && npm run build` green; `npx eslint` on changed files clean (3 pre-existing repo-wide errors are known — only YOUR files must be clean). Backend untouched: `./mvnw -q test-compile` still green.

## Expected diff size
~8 new FE files + ~6 edits. Total ≈ +900/−30.

**MERGE CHECKPOINT: yes** (new page owner-only; nothing else changes with 1 staff).
**Recommended model/effort:** standard model @ medium-high — mechanical UI wiring over a defined API.
**NEW CHAT: yes** — attach `00-audit-report.md` + this file only.
